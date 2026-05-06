/**
 * Standalone pronunciation generation endpoint (Phase 2 — Ticket 2.1 & 2.4).
 *
 * Generates (or regenerates) pronunciation entries for a book without touching
 * narration. Walks every page of the book, gathers unique normalized tokens,
 * skips tokens already covered by existing book-level entries (unless
 * `force: true`), runs the shared generation pipeline, and persists results to
 * `book_pronunciations`. Returns a coverage report derived from that table.
 *
 * Body:
 *   {
 *     voice?: string,
 *     voiceSettings?: { speed, style, useSpeakerBoost },
 *     force?: boolean,              // regenerate existing entries
 *     maxWords?: number             // cap per run (safety valve)
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  normalizeVoiceSettings,
  resolveElevenLabsVoice,
} from "@/lib/elevenlabs";
import { extractPageNarrationTokens } from "@/lib/overlayText";
import {
  collectMissingTokens,
  entryCoverageStatus,
  generatePronunciationEntries,
  type BookPronunciationRow,
} from "@/lib/pronunciationGeneration";

function parseBookIdParam(bookId: string): bigint | null {
  try {
    return BigInt(bookId);
  } catch {
    return null;
  }
}

function parseBooleanLike(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

function parsePositiveIntegerLike(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

type CoveragePageReport = {
  pageId: string;
  pageNumber: number;
  total: number;
  covered: number;
  fullWordOnly: number;
  missing: number;
  missingWords: string[];
  status: "empty" | "missing" | "partial" | "complete";
};

type CoveragePageInput = {
  id: bigint;
  page_number: number;
  text_content: string | null;
  page_overlay_text_entries?: Array<{
    text_content: string | null;
    include_in_narration: boolean | null;
    sort_order: number | null;
  }>;
};

function summarizeCoverage(
  perPage: CoveragePageReport[],
  uniqueBookTokens: number,
  coveredBookWide: number
) {
  const pagesTotal = perPage.length;
  const pagesComplete = perPage.filter(
    (page) => page.status === "complete"
  ).length;
  const pagesEmpty = perPage.filter((page) => page.status === "empty").length;
  const pagesWithMissing = perPage.filter((page) => page.missing > 0).length;
  const pagesPartial = perPage.filter(
    (page) => page.status === "partial"
  ).length;
  const missingBookWide = Math.max(0, uniqueBookTokens - coveredBookWide);

  return {
    uniqueBookTokens,
    coveredBookWide,
    missingBookWide,
    ratio:
      uniqueBookTokens > 0
        ? Number((coveredBookWide / uniqueBookTokens).toFixed(4))
        : 1,
    pagesTotal,
    pagesComplete,
    pagesPartial,
    pagesEmpty,
    pagesWithMissing,
    fullCoverage: missingBookWide === 0,
  };
}

function buildRowByWord(rows: BookPronunciationRow[]) {
  const rowByWord = new Map<string, BookPronunciationRow>();
  for (const row of rows) {
    if (row.normalized_word) {
      rowByWord.set(row.normalized_word, row);
    }
  }
  return rowByWord;
}

function buildCoverageReport(
  pages: CoveragePageInput[],
  rows: BookPronunciationRow[]
): {
  uniqueTokens: Set<string>;
  coveredBookWide: number;
  perPage: CoveragePageReport[];
} {
  const rowByWord = buildRowByWord(rows);
  const uniqueTokens = new Set<string>();
  const perPage: CoveragePageReport[] = [];

  for (const page of pages) {
    const pageTokens = extractPageNarrationTokens(
      page.text_content ?? "",
      page.page_overlay_text_entries?.map((entry) => ({
        text: entry.text_content,
        includeInNarration: entry.include_in_narration,
        sortOrder: entry.sort_order,
      }))
    );
    let covered = 0;
    let fullWordOnly = 0;
    const missingWords: string[] = [];

    for (const token of pageTokens) {
      uniqueTokens.add(token);
      const status = entryCoverageStatus(rowByWord.get(token));
      if (status === "covered") covered += 1;
      else if (status === "full-word-only") fullWordOnly += 1;
      else missingWords.push(token);
    }

    const missing = missingWords.length;
    const status: CoveragePageReport["status"] =
      pageTokens.length === 0
        ? "empty"
        : missing === 0 && fullWordOnly === 0
          ? "complete"
          : covered > 0 || fullWordOnly > 0
            ? "partial"
            : "missing";

    perPage.push({
      pageId: page.id.toString(),
      pageNumber: page.page_number,
      total: pageTokens.length,
      covered,
      fullWordOnly,
      missing,
      missingWords,
      status,
    });
  }

  let coveredBookWide = 0;
  for (const token of uniqueTokens) {
    if (entryCoverageStatus(rowByWord.get(token)) !== "missing") {
      coveredBookWide += 1;
    }
  }

  return { uniqueTokens, coveredBookWide, perPage };
}

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function buildSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = buildSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration." },
      { status: 500 }
    );
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "Missing ElevenLabs API key." },
      { status: 500 }
    );
  }

  const { id: bookId } = await params;
  const parsedBookId = parseBookIdParam(bookId);

  if (parsedBookId === null) {
    return NextResponse.json(
      { error: "Invalid book ID.", code: "invalid_book_id" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const payload = body && typeof body === "object" ? body : {};
  const { voice, voiceSettings } = payload as {
    voice?: unknown;
    voiceSettings?: unknown;
  };
  const force = parseBooleanLike((payload as { force?: unknown }).force, false);
  const rawMaxWords = (payload as { maxWords?: unknown }).maxWords;
  const maxWords = parsePositiveIntegerLike(rawMaxWords);

  if (rawMaxWords !== undefined && maxWords === undefined) {
    return NextResponse.json(
      {
        error: "maxWords must be a positive integer.",
        code: "invalid_max_words",
      },
      { status: 400 }
    );
  }

  try {
    const pages = await prisma.pages.findMany({
      where: { book_id: parsedBookId },
      orderBy: { page_number: "asc" },
      select: {
        id: true,
        page_number: true,
        text_content: true,
        page_overlay_text_entries: {
          where: { include_in_narration: true },
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
          select: {
            text_content: true,
            include_in_narration: true,
            sort_order: true,
          },
        },
      },
    });

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No pages found for this book." },
        { status: 404 }
      );
    }

    const existingRows = (await prisma.book_pronunciations.findMany({
      where: { book_id: parsedBookId },
    })) as BookPronunciationRow[];

    const tokensByPage = pages.map((page) =>
      extractPageNarrationTokens(
        page.text_content ?? "",
        page.page_overlay_text_entries?.map((entry) => ({
          text: entry.text_content,
          includeInNarration: entry.include_in_narration,
          sortOrder: entry.sort_order,
        }))
      )
    );
    let tokensToProcess = collectMissingTokens(tokensByPage, existingRows, {
      force,
    });
    const totalMissingBeforeRun = tokensToProcess.length;
    const totalUniqueTokens = new Set(tokensByPage.flat()).size;

    if (typeof maxWords === "number" && maxWords > 0) {
      tokensToProcess = tokensToProcess.slice(0, maxWords);
    }

    const { voiceId, voiceName } = await resolveElevenLabsVoice(
      typeof voice === "string" ? voice : undefined
    );
    const normalizedVoiceSettings = normalizeVoiceSettings(voiceSettings);
    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
      "storia-storage";

    const genResult = await generatePronunciationEntries({
      supabase,
      bucket,
      bookId,
      voiceId,
      voiceSettings: normalizedVoiceSettings,
      force,
      words: tokensToProcess,
    });

    const coverageReport = buildCoverageReport(pages, genResult.rows);
    const summary = summarizeCoverage(
      coverageReport.perPage,
      totalUniqueTokens,
      coverageReport.coveredBookWide
    );

    return NextResponse.json({
      bookId,
      voice: { id: voiceId, name: voiceName },
      request: {
        force,
        maxWords: maxWords ?? null,
      },
      stats: genResult.stats,
      coverage: {
        uniqueBookTokens: totalUniqueTokens,
        coveredBookWide: coverageReport.coveredBookWide,
        ratio: summary.ratio,
        perPage: coverageReport.perPage,
      },
      summary: {
        ...summary,
        requestedTokens: tokensToProcess.length,
        remainingTokensAfterRun: summary.missingBookWide,
        limitedByMaxWords:
          maxWords !== undefined && tokensToProcess.length < totalMissingBeforeRun,
      },
      force,
    });
  } catch (error) {
    console.error(
      "[admin/books/[id]/pronunciations/generate] failed:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Pronunciation generation failed.",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Read-only coverage report (no generation).
  const { id: bookId } = await params;
  const parsedBookId = parseBookIdParam(bookId);

  if (parsedBookId === null) {
    return NextResponse.json(
      { error: "Invalid book ID.", code: "invalid_book_id" },
      { status: 400 }
    );
  }

  try {
    const pages = await prisma.pages.findMany({
      where: { book_id: parsedBookId },
      orderBy: { page_number: "asc" },
      select: {
        id: true,
        page_number: true,
        text_content: true,
        page_overlay_text_entries: {
          where: { include_in_narration: true },
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
          select: {
            text_content: true,
            include_in_narration: true,
            sort_order: true,
          },
        },
      },
    });

    const rows = (await prisma.book_pronunciations.findMany({
      where: { book_id: parsedBookId },
      orderBy: { normalized_word: "asc" },
    })) as BookPronunciationRow[];

    const coverageReport = buildCoverageReport(pages, rows);
    const summary = summarizeCoverage(
      coverageReport.perPage,
      coverageReport.uniqueTokens.size,
      coverageReport.coveredBookWide
    );

    return NextResponse.json({
      bookId,
      coverage: {
        uniqueBookTokens: coverageReport.uniqueTokens.size,
        coveredBookWide: coverageReport.coveredBookWide,
        ratio: summary.ratio,
        perPage: coverageReport.perPage,
      },
      summary,
    });
  } catch (error) {
    console.error(
      "[admin/books/[id]/pronunciations/generate][GET] failed:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load pronunciation coverage.",
      },
      { status: 500 }
    );
  }
}

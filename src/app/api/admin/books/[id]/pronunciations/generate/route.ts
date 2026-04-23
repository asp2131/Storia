/**
 * Standalone pronunciation generation endpoint (Phase 2 — Ticket 2.1 & 2.4).
 *
 * Generates (or regenerates) pronunciation entries for a book without touching
 * narration. Walks every page of the book, gathers unique normalized tokens,
 * skips tokens already covered by existing entries (unless `force: true`),
 * runs the shared generation pipeline, and persists per-page
 * `word_pronunciations`. Returns a coverage report.
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
import { Prisma } from "@prisma/client";
import {
  normalizeVoiceSettings,
  resolveElevenLabsVoice,
} from "@/lib/elevenlabs";
import {
  entryHasAudio,
  extractUniquePronunciationTokens,
  normalizePronunciationToken,
  type WordPronunciationEntry,
  type WordPronunciationMap,
} from "@/lib/pronunciation";
import {
  collectMissingTokens,
  entryCoverageStatus,
  generatePronunciationEntries,
} from "@/lib/pronunciationGeneration";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  "";

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
  const body = await request.json().catch(() => ({}));
  const { voice, voiceSettings, force = false, maxWords } = body ?? {};

  try {
    const pages = await prisma.pages.findMany({
      where: { book_id: BigInt(bookId) },
      orderBy: { page_number: "asc" },
      select: {
        id: true,
        page_number: true,
        text_content: true,
        word_pronunciations: true,
      },
    });

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No pages found for this book." },
        { status: 404 }
      );
    }

    const pagesForCollector = pages.map((p) => ({
      textContent: p.text_content,
      entries: (p.word_pronunciations as WordPronunciationMap | null) ?? {},
    }));

    let tokensToProcess = collectMissingTokens(pagesForCollector, { force });
    const totalUniqueTokens = Array.from(
      new Set(
        pages.flatMap((p) =>
          extractUniquePronunciationTokens(p.text_content ?? "")
        )
      )
    ).length;

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

    // Existing entries across the whole book, merged (manifest-style) for
    // skip-existing logic inside the generator.
    const bookLevelExisting: WordPronunciationMap = {};
    for (const p of pages) {
      const map = (p.word_pronunciations as WordPronunciationMap | null) ?? {};
      for (const [rawKey, entry] of Object.entries(map)) {
        const key = normalizePronunciationToken(rawKey);
        if (!key) continue;
        if (!entryHasAudio(bookLevelExisting[key])) {
          bookLevelExisting[key] = entry;
        }
      }
    }

    const genResult = await generatePronunciationEntries({
      supabase,
      bucket,
      bookId,
      voiceId,
      voiceSettings: normalizedVoiceSettings,
      existingEntries: bookLevelExisting,
      force,
      words: tokensToProcess,
    });

    // Persist merged entries per page: for each page, take its original tokens
    // and look them up in the newly-merged manifest.
    const now = new Date();
    const perPageReport: Array<{
      pageId: string;
      pageNumber: number;
      total: number;
      covered: number;
      missing: number;
    }> = [];

    for (const page of pages) {
      const pageTokens = extractUniquePronunciationTokens(page.text_content ?? "");
      const pageEntries: WordPronunciationMap = {};
      let covered = 0;

      for (const token of pageTokens) {
        const entry = genResult.pronunciationMap[token];
        if (entry) {
          pageEntries[token] = entry;
          if (entryHasAudio(entry)) covered += 1;
        }
      }

      await prisma.pages.update({
        where: { id: page.id },
        data: {
          word_pronunciations: pageEntries as Prisma.InputJsonValue,
          updated_at: now,
        },
      });

      perPageReport.push({
        pageId: page.id.toString(),
        pageNumber: page.page_number,
        total: pageTokens.length,
        covered,
        missing: pageTokens.length - covered,
      });
    }

    const coveredBookWide = Object.values(genResult.pronunciationMap).filter(
      (e: WordPronunciationEntry | undefined) => entryHasAudio(e)
    ).length;

    const coverageRatio =
      totalUniqueTokens > 0 ? coveredBookWide / totalUniqueTokens : 1;

    return NextResponse.json({
      bookId,
      voice: { id: voiceId, name: voiceName },
      stats: genResult.stats,
      coverage: {
        uniqueBookTokens: totalUniqueTokens,
        coveredBookWide,
        ratio: Number(coverageRatio.toFixed(4)),
        perPage: perPageReport,
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

  const pages = await prisma.pages.findMany({
    where: { book_id: BigInt(bookId) },
    orderBy: { page_number: "asc" },
    select: {
      id: true,
      page_number: true,
      text_content: true,
      word_pronunciations: true,
    },
  });

  const perPage: Array<{
    pageId: string;
    pageNumber: number;
    total: number;
    covered: number;
    fullWordOnly: number;
    missing: number;
    missingWords: string[];
  }> = [];

  const uniqueTokens = new Set<string>();
  let coveredBookWide = 0;

  for (const page of pages) {
    const pageTokens = extractUniquePronunciationTokens(page.text_content ?? "");
    const entries = (page.word_pronunciations as WordPronunciationMap | null) ?? {};

    let covered = 0;
    let fullWordOnly = 0;
    const missingWords: string[] = [];

    for (const token of pageTokens) {
      uniqueTokens.add(token);
      const status = entryCoverageStatus(entries[token]);
      if (status === "covered") covered += 1;
      else if (status === "full-word-only") fullWordOnly += 1;
      else missingWords.push(token);
    }

    perPage.push({
      pageId: page.id.toString(),
      pageNumber: page.page_number,
      total: pageTokens.length,
      covered,
      fullWordOnly,
      missing: missingWords.length,
      missingWords,
    });
  }

  for (const token of uniqueTokens) {
    for (const page of pages) {
      const entries =
        (page.word_pronunciations as WordPronunciationMap | null) ?? {};
      if (entryHasAudio(entries[token])) {
        coveredBookWide += 1;
        break;
      }
    }
  }

  return NextResponse.json({
    bookId,
    coverage: {
      uniqueBookTokens: uniqueTokens.size,
      coveredBookWide,
      ratio:
        uniqueTokens.size > 0
          ? Number((coveredBookWide / uniqueTokens.size).toFixed(4))
          : 1,
      perPage,
    },
  });
}

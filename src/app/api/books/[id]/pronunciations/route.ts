import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  type BookPronunciationManifest,
  type PronunciationBreakdownSegment,
  type PronunciationSource,
  type PronunciationStatus,
  type PublishedWordPronunciation,
} from "@/lib/pronunciation";

export type ManifestEntry = PublishedWordPronunciation;
export type Manifest = BookPronunciationManifest;

const VALID_SOURCES: ReadonlySet<PronunciationSource> = new Set([
  "override",
  "lexicon",
  "tts",
]);

const VALID_STATUSES: ReadonlySet<PronunciationStatus> = new Set([
  "generated",
  "failed",
  "reviewed",
]);

function parseBookIdParam(bookId: string): bigint | null {
  try {
    return BigInt(bookId);
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      strings.push(item);
    }
  }
  return strings.length > 0 ? strings : undefined;
}

function toBreakdownSegmentArray(
  value: unknown
): PronunciationBreakdownSegment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const segments: PronunciationBreakdownSegment[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const chunk = typeof obj.chunk === "string" ? obj.chunk : undefined;
      const spoken =
        typeof obj.spoken === "string" ? obj.spoken : chunk;
      const index =
        typeof obj.index === "number" ? obj.index : segments.length;
      if (!chunk || spoken === undefined) continue;
      const segment: PronunciationBreakdownSegment = { index, chunk, spoken };
      if (typeof obj.startMs === "number") segment.startMs = obj.startMs;
      if (typeof obj.endMs === "number") segment.endMs = obj.endMs;
      segments.push(segment);
    } else if (typeof item === "string" && item.length > 0) {
      // Legacy: bare chunk string. Promote to object for forward compat.
      segments.push({
        index: segments.length,
        chunk: item,
        spoken: item,
      });
    }
  }
  return segments.length > 0 ? segments : undefined;
}

function toRowEntry(row: {
  id: bigint;
  normalized_word: string;
  display_word: string | null;
  phonetic_display: string | null;
  syllables: unknown;
  breakdown_segments: unknown;
  full_word_url: string | null;
  breakdown_url: string | null;
  source: string;
  status: string;
  confidence: number | null;
  human_reviewed: boolean;
  updated_at: Date;
}): ManifestEntry {
  const normalizedWord = row.normalized_word;
  const displayWord = row.display_word ?? normalizedWord;

  const syllables = toStringArray(row.syllables);
  const breakdownSegments = toBreakdownSegmentArray(row.breakdown_segments);

  const source = VALID_SOURCES.has(row.source as PronunciationSource)
    ? (row.source as PronunciationSource)
    : undefined;
  const status = VALID_STATUSES.has(row.status as PronunciationStatus)
    ? (row.status as PronunciationStatus)
    : undefined;

  const hasFullWord =
    typeof row.full_word_url === "string" && row.full_word_url.length > 0;
  const hasBreakdown =
    typeof row.breakdown_url === "string" && row.breakdown_url.length > 0;

  const audio: PublishedWordPronunciation["audio"] = {
    ...(hasFullWord ? { fullWord: { url: row.full_word_url as string } } : {}),
    ...(hasBreakdown ? { breakdown: { url: row.breakdown_url as string } } : {}),
  };

  return {
    id: row.id.toString(),
    normalizedWord,
    displayWord,
    ...(row.phonetic_display ? { phoneticDisplay: row.phonetic_display } : {}),
    ipa: null,
    ...(syllables ? { syllables } : {}),
    ...(breakdownSegments ? { breakdownSegments } : {}),
    ...(source ? { source } : {}),
    ...(typeof row.confidence === "number"
      ? { confidence: row.confidence }
      : {}),
    humanReviewed: row.human_reviewed,
    ...(status ? { status } : {}),
    audio,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;
  const parsedBookId = parseBookIdParam(bookId);

  if (parsedBookId === null) {
    return NextResponse.json(
      { error: { code: "invalid_book_id", message: "Invalid book ID." } },
      { status: 400 }
    );
  }

  try {
    const rows = await prisma.book_pronunciations.findMany({
      where: { book_id: parsedBookId },
      orderBy: { normalized_word: "asc" },
    });

    const entries: Record<string, ManifestEntry> = {};
    for (const row of rows) {
      entries[row.normalized_word] = toRowEntry(row);
    }

    const manifest: Manifest = {
      bookId,
      version: 1,
      locale: "en-US",
      defaultPlaybackMode: "breakdown_then_word",
      entries,
    };

    return NextResponse.json(manifest);
  } catch (error) {
    console.error("[pronunciations] failed to fetch manifest", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to fetch pronunciations" } },
      { status: 500 }
    );
  }
}

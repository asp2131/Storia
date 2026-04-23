import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizePronunciationToken,
  type BookPronunciationManifest,
  type PublishedWordPronunciation,
  type WordPronunciationEntry,
} from "@/lib/pronunciation";

export type ManifestEntry = PublishedWordPronunciation;
export type Manifest = BookPronunciationManifest;

function entryScore(entry: WordPronunciationEntry): number {
  if (typeof entry === "string") return 1;
  const hasBreakdown = typeof entry.breakdown === "string" && entry.breakdown.length > 0;
  const hasFullWord = typeof entry.fullWord === "string" && entry.fullWord.length > 0;
  if (hasBreakdown && hasFullWord) return 3;
  if (hasBreakdown) return 2;
  if (hasFullWord) return 1;
  return 0;
}

function toManifestEntry(
  bookId: string,
  normalizedKey: string,
  entry: WordPronunciationEntry
): ManifestEntry {
  if (typeof entry === "string") {
    return {
      id: `${bookId}:${normalizedKey}`,
      normalizedWord: normalizedKey,
      displayWord: normalizedKey,
      humanReviewed: false,
      updatedAt: new Date(0).toISOString(),
      audio: {
        fullWord: {
          url: entry,
        },
      },
    };
  }

  const humanReviewed = entry.status === "reviewed" || entry.source === "override";

  return {
    id: `${bookId}:${normalizedKey}`,
    normalizedWord: normalizedKey,
    displayWord: normalizedKey,
    ...(entry.source ? { source: entry.source } : {}),
    ...(typeof entry.confidence === "number" ? { confidence: entry.confidence } : {}),
    ...(entry.status ? { status: entry.status } : {}),
    humanReviewed,
    updatedAt: entry.generatedAt ?? new Date(0).toISOString(),
    audio: {
      ...(typeof entry.fullWord === "string" && entry.fullWord.length > 0
        ? {
            fullWord: {
              url: entry.fullWord,
            },
          }
        : {}),
      ...(typeof entry.breakdown === "string" && entry.breakdown.length > 0
        ? {
            breakdown: {
              url: entry.breakdown,
            },
          }
        : {}),
    },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;

  try {
    const pages = await prisma.pages.findMany({
      where: { book_id: BigInt(bookId) },
      select: { word_pronunciations: true },
    });

    const merged: Record<string, { entry: WordPronunciationEntry; score: number }> = {};

    for (const page of pages) {
      if (!page.word_pronunciations) continue;
      const map = page.word_pronunciations as Record<string, WordPronunciationEntry>;

      for (const [rawKey, rawEntry] of Object.entries(map)) {
        const normalizedKey = normalizePronunciationToken(rawKey);
        if (!normalizedKey) continue;

        const score = entryScore(rawEntry);
        const existing = merged[normalizedKey];

        if (!existing || score > existing.score) {
          merged[normalizedKey] = { entry: rawEntry, score };
        }
      }
    }

    const entries: Record<string, ManifestEntry> = {};
    for (const [key, { entry }] of Object.entries(merged)) {
      entries[key] = toManifestEntry(bookId, key, entry);
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizePronunciationToken,
  type WordPronunciationEntry,
} from "@/lib/pronunciation";

export type ManifestEntry = {
  word: string;
  fullWord?: string;
  breakdown?: string;
};

export type Manifest = {
  bookId: string;
  version: 1;
  entries: Record<string, ManifestEntry>;
};

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
  normalizedKey: string,
  entry: WordPronunciationEntry
): ManifestEntry {
  if (typeof entry === "string") {
    return { word: normalizedKey, fullWord: entry };
  }

  const result: ManifestEntry = { word: normalizedKey };

  if (typeof entry.fullWord === "string" && entry.fullWord.length > 0) {
    result.fullWord = entry.fullWord;
  }

  if (typeof entry.breakdown === "string" && entry.breakdown.length > 0) {
    result.breakdown = entry.breakdown;
  }

  return result;
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
      entries[key] = toManifestEntry(key, entry);
    }

    const manifest: Manifest = {
      bookId,
      version: 1,
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

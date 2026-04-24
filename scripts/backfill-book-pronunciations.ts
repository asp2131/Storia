/**
 * Backfill script: migrate per-page `pages.word_pronunciations` JSON into the
 * new `book_pronunciations` table (Ticket 3.3 Part A).
 *
 * For every book, walks every page's `word_pronunciations` map, merges
 * duplicates across pages by picking the "richest" entry (covered >
 * full-word-only > reviewed-source > higher-confidence > newer generatedAt),
 * normalizes the key, and upserts into `book_pronunciations`.
 *
 * Idempotent: rerunning is safe.
 * - Rows with `human_reviewed = true` are NEVER touched (editor overrides win).
 * - Rows with `source = "override"` or `status = "reviewed"` are NEVER touched.
 * - Otherwise existing rows are updated only when the candidate from page JSON
 *   is strictly richer than the current DB row.
 *
 * Usage:
 *   npx tsx scripts/backfill-book-pronunciations.ts               # dry-run, print plan
 *   npx tsx scripts/backfill-book-pronunciations.ts --apply       # actually upsert rows
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { writeFileSync } from "node:fs";
import {
  normalizePronunciationToken,
  type WordPronunciationEntry,
  type WordPronunciationMap,
} from "../src/lib/pronunciation";

const APPLY = process.argv.includes("--apply");

interface Candidate {
  normalizedWord: string;
  fullWordUrl?: string;
  breakdownUrl?: string;
  source?: string;
  confidence?: number;
  status?: string;
  generatedAt?: string;
}

interface BookReport {
  bookId: string;
  title: string;
  pageCount: number;
  tokensSeen: number;
  candidates: number;
  inserted: number;
  updated: number;
  skippedExistingReviewed: number;
  skippedNotRicher: number;
  legacyStringUpgrades: number;
}

function entryRichnessScore(c: Candidate): number {
  let score = 0;
  if (c.fullWordUrl) score += 2;
  if (c.breakdownUrl) score += 3;
  if (c.status === "reviewed" || c.source === "override") score += 4;
  else if (c.status === "generated") score += 1;
  if (typeof c.confidence === "number") score += c.confidence;
  return score;
}

function preferCandidate(current: Candidate | undefined, next: Candidate): Candidate {
  if (!current) return next;
  const cs = entryRichnessScore(current);
  const ns = entryRichnessScore(next);
  if (ns > cs) return next;
  if (ns < cs) return current;
  if ((next.generatedAt ?? "") > (current.generatedAt ?? "")) return next;
  return current;
}

function toCandidate(
  normalizedWord: string,
  entry: WordPronunciationEntry
): { candidate: Candidate; wasLegacyString: boolean } {
  if (typeof entry === "string") {
    const url = entry.trim();
    return {
      candidate: {
        normalizedWord,
        fullWordUrl: url.length > 0 ? url : undefined,
      },
      wasLegacyString: true,
    };
  }
  return {
    candidate: {
      normalizedWord,
      fullWordUrl: entry.fullWord?.trim() || undefined,
      breakdownUrl: entry.breakdown?.trim() || undefined,
      source: entry.source,
      confidence: typeof entry.confidence === "number" ? entry.confidence : undefined,
      status: entry.status,
      generatedAt: entry.generatedAt,
    },
    wasLegacyString: false,
  };
}

async function backfillBook(
  prisma: PrismaClient,
  book: { id: bigint; title: string }
): Promise<BookReport> {
  const report: BookReport = {
    bookId: book.id.toString(),
    title: book.title,
    pageCount: 0,
    tokensSeen: 0,
    candidates: 0,
    inserted: 0,
    updated: 0,
    skippedExistingReviewed: 0,
    skippedNotRicher: 0,
    legacyStringUpgrades: 0,
  };

  const pages = await prisma.pages.findMany({
    where: { book_id: book.id },
    select: { word_pronunciations: true },
  });
  report.pageCount = pages.length;

  const merged = new Map<string, Candidate>();

  for (const page of pages) {
    const map = (page.word_pronunciations as WordPronunciationMap | null) ?? {};
    for (const [rawKey, entry] of Object.entries(map)) {
      report.tokensSeen += 1;
      const normalized = normalizePronunciationToken(rawKey);
      if (!normalized) continue;
      if (entry === undefined || entry === null) continue;
      const { candidate, wasLegacyString } = toCandidate(normalized, entry);
      if (wasLegacyString) report.legacyStringUpgrades += 1;
      merged.set(normalized, preferCandidate(merged.get(normalized), candidate));
    }
  }

  report.candidates = merged.size;

  if (!APPLY) return report;

  const existingRows = await prisma.book_pronunciations.findMany({
    where: { book_id: book.id },
    select: {
      id: true,
      normalized_word: true,
      full_word_url: true,
      breakdown_url: true,
      source: true,
      status: true,
      confidence: true,
      human_reviewed: true,
      generated_at: true,
    },
  });
  const existingByWord = new Map(existingRows.map((r) => [r.normalized_word, r]));

  for (const candidate of merged.values()) {
    const existing = existingByWord.get(candidate.normalizedWord);

    if (existing) {
      if (
        existing.human_reviewed ||
        existing.source === "override" ||
        existing.status === "reviewed"
      ) {
        report.skippedExistingReviewed += 1;
        continue;
      }

      const existingScore = entryRichnessScore({
        normalizedWord: candidate.normalizedWord,
        fullWordUrl: existing.full_word_url ?? undefined,
        breakdownUrl: existing.breakdown_url ?? undefined,
        source: existing.source,
        confidence: existing.confidence ?? undefined,
        status: existing.status,
        generatedAt: existing.generated_at?.toISOString(),
      });

      if (entryRichnessScore(candidate) <= existingScore) {
        report.skippedNotRicher += 1;
        continue;
      }

      await prisma.book_pronunciations.update({
        where: { id: existing.id },
        data: {
          full_word_url: candidate.fullWordUrl ?? null,
          breakdown_url: candidate.breakdownUrl ?? null,
          source: candidate.source ?? existing.source,
          status: candidate.status ?? existing.status,
          confidence:
            typeof candidate.confidence === "number"
              ? candidate.confidence
              : existing.confidence,
          generated_at: candidate.generatedAt
            ? new Date(candidate.generatedAt)
            : existing.generated_at,
        },
      });
      report.updated += 1;
      continue;
    }

    await prisma.book_pronunciations.create({
      data: {
        book_id: book.id,
        normalized_word: candidate.normalizedWord,
        full_word_url: candidate.fullWordUrl ?? null,
        breakdown_url: candidate.breakdownUrl ?? null,
        source: candidate.source ?? "tts",
        status: candidate.status ?? "generated",
        confidence:
          typeof candidate.confidence === "number" ? candidate.confidence : null,
        human_reviewed: false,
        generated_at: candidate.generatedAt
          ? new Date(candidate.generatedAt)
          : null,
      } satisfies Prisma.book_pronunciationsUncheckedCreateInput,
    });
    report.inserted += 1;
  }

  return report;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const books = await prisma.books.findMany({
      orderBy: { id: "asc" },
      select: { id: true, title: true },
    });

    console.log(
      `[backfill-book-pronunciations] mode=${APPLY ? "apply" : "dry-run"} books=${books.length}`
    );

    const reports: BookReport[] = [];
    for (const book of books) {
      const report = await backfillBook(prisma, book);
      reports.push(report);
      console.log(
        `[backfill] ${report.bookId} "${report.title}" pages=${report.pageCount} tokens=${report.tokensSeen} candidates=${report.candidates} inserted=${report.inserted} updated=${report.updated} skipped-reviewed=${report.skippedExistingReviewed} skipped-not-richer=${report.skippedNotRicher} legacy-upgrades=${report.legacyStringUpgrades}`
      );
    }

    const aggregate = reports.reduce(
      (acc, r) => ({
        books: acc.books + 1,
        pageCount: acc.pageCount + r.pageCount,
        tokensSeen: acc.tokensSeen + r.tokensSeen,
        candidates: acc.candidates + r.candidates,
        inserted: acc.inserted + r.inserted,
        updated: acc.updated + r.updated,
        skippedExistingReviewed:
          acc.skippedExistingReviewed + r.skippedExistingReviewed,
        skippedNotRicher: acc.skippedNotRicher + r.skippedNotRicher,
        legacyStringUpgrades: acc.legacyStringUpgrades + r.legacyStringUpgrades,
      }),
      {
        books: 0,
        pageCount: 0,
        tokensSeen: 0,
        candidates: 0,
        inserted: 0,
        updated: 0,
        skippedExistingReviewed: 0,
        skippedNotRicher: 0,
        legacyStringUpgrades: 0,
      }
    );

    const output = {
      mode: APPLY ? "apply" : "dry-run",
      timestamp: new Date().toISOString(),
      aggregate,
      books: reports,
    };

    const outPath = "scripts/backfill-book-pronunciations-report.json";
    writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log("---");
    console.log(
      `[backfill] aggregate books=${aggregate.books} pages=${aggregate.pageCount} candidates=${aggregate.candidates} inserted=${aggregate.inserted} updated=${aggregate.updated}`
    );
    console.log(`[backfill] report written to ${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill-book-pronunciations] fatal:", err);
  process.exit(1);
});

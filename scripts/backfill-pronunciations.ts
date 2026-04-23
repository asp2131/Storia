/**
 * Pronunciation backfill script (Phase 2 — Ticket 2.4).
 *
 * Iterates every published book, invokes the standalone pronunciation
 * generation endpoint, and writes a coverage report to stdout and
 * `scripts/backfill-pronunciations-report.json`.
 *
 * Requires the Next dev/prod server to be running at BASE_URL
 * (default http://localhost:3000) because generation needs
 * ELEVENLABS_API_KEY + Supabase service role; those live in the server
 * process env, not here.
 *
 * Usage:
 *   npx tsx scripts/backfill-pronunciations.ts             # dry-run coverage report only
 *   npx tsx scripts/backfill-pronunciations.ts --generate  # actually generate missing
 *   npx tsx scripts/backfill-pronunciations.ts --generate --force  # regenerate all
 *   BASE_URL=http://localhost:3000 npx tsx scripts/backfill-pronunciations.ts --generate
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DRY_RUN = !process.argv.includes("--generate");
const FORCE = process.argv.includes("--force");
const MAX_WORDS_ARG = process.argv.find((a) => a.startsWith("--max-words="));
const MAX_WORDS = MAX_WORDS_ARG
  ? Number(MAX_WORDS_ARG.split("=")[1])
  : undefined;

interface CoveragePage {
  pageId: string;
  pageNumber: number;
  total: number;
  covered: number;
  fullWordOnly?: number;
  missing: number;
  missingWords?: string[];
}

interface CoverageReport {
  bookId: string;
  title: string;
  uniqueBookTokens: number;
  coveredBookWide: number;
  ratio: number;
  perPage: CoveragePage[];
  generated?: number;
  failed?: number;
  failures?: Array<{ word: string; error: string }>;
}

async function fetchCoverage(bookId: string): Promise<CoverageReport["perPage"] extends infer P ? { uniqueBookTokens: number; coveredBookWide: number; ratio: number; perPage: CoveragePage[] } : never> {
  const res = await fetch(
    `${BASE_URL}/api/admin/books/${bookId}/pronunciations/generate`,
    { method: "GET" }
  );
  if (!res.ok) {
    throw new Error(
      `GET coverage failed: ${res.status} ${res.statusText}`
    );
  }
  const body = (await res.json()) as { coverage: CoverageReport };
  return body.coverage as unknown as {
    uniqueBookTokens: number;
    coveredBookWide: number;
    ratio: number;
    perPage: CoveragePage[];
  };
}

async function generateForBook(
  bookId: string
): Promise<{
  stats: { total: number; generated: number; skipped: number; failed: number; withBreakdown: number; failures: Array<{ word: string; error: string }> };
  coverage: {
    uniqueBookTokens: number;
    coveredBookWide: number;
    ratio: number;
    perPage: CoveragePage[];
  };
}> {
  const res = await fetch(
    `${BASE_URL}/api/admin/books/${bookId}/pronunciations/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        force: FORCE,
        ...(MAX_WORDS ? { maxWords: MAX_WORDS } : {}),
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST generate failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const books = await prisma.books.findMany({
      where: { processing_status: "ready" },
      orderBy: { id: "asc" },
      select: { id: true, title: true },
    });

    console.log(
      `[backfill] mode=${DRY_RUN ? "dry-run" : "generate"}${FORCE ? " force" : ""} books=${books.length} base=${BASE_URL}`
    );

    const reports: CoverageReport[] = [];

    for (const book of books) {
      const bookId = book.id.toString();
      try {
        if (DRY_RUN) {
          const cov = await fetchCoverage(bookId);
          reports.push({
            bookId,
            title: book.title,
            uniqueBookTokens: cov.uniqueBookTokens,
            coveredBookWide: cov.coveredBookWide,
            ratio: cov.ratio,
            perPage: cov.perPage,
          });
          console.log(
            `[backfill] ${bookId} "${book.title}" coverage=${(cov.ratio * 100).toFixed(1)}% (${cov.coveredBookWide}/${cov.uniqueBookTokens})`
          );
        } else {
          const result = await generateForBook(bookId);
          reports.push({
            bookId,
            title: book.title,
            uniqueBookTokens: result.coverage.uniqueBookTokens,
            coveredBookWide: result.coverage.coveredBookWide,
            ratio: result.coverage.ratio,
            perPage: result.coverage.perPage,
            generated: result.stats.generated,
            failed: result.stats.failed,
            failures: result.stats.failures,
          });
          console.log(
            `[backfill] ${bookId} "${book.title}" generated=${result.stats.generated} failed=${result.stats.failed} coverage=${(result.coverage.ratio * 100).toFixed(1)}%`
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[backfill] ${bookId} "${book.title}" error: ${message}`);
        reports.push({
          bookId,
          title: book.title,
          uniqueBookTokens: -1,
          coveredBookWide: -1,
          ratio: -1,
          perPage: [],
          failed: -1,
          failures: [{ word: "*", error: message }],
        });
      }
    }

    const totalTokens = reports.reduce(
      (s, r) => s + Math.max(0, r.uniqueBookTokens),
      0
    );
    const totalCovered = reports.reduce(
      (s, r) => s + Math.max(0, r.coveredBookWide),
      0
    );
    const aggregate = {
      books: reports.length,
      totalTokens,
      totalCovered,
      ratio: totalTokens > 0 ? Number((totalCovered / totalTokens).toFixed(4)) : 1,
    };

    const output = {
      mode: DRY_RUN ? "dry-run" : "generate",
      force: FORCE,
      baseUrl: BASE_URL,
      timestamp: new Date().toISOString(),
      aggregate,
      books: reports,
    };

    const outPath = "scripts/backfill-pronunciations-report.json";
    writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log("---");
    console.log(
      `[backfill] aggregate coverage=${(aggregate.ratio * 100).toFixed(1)}% (${aggregate.totalCovered}/${aggregate.totalTokens}) across ${aggregate.books} books`
    );
    console.log(`[backfill] report written to ${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});

/**
 * Backfill `syllables`, `phonetic_display`, and `breakdown_segments` for any
 * existing `book_pronunciations` rows that are missing them. Does NOT call
 * ElevenLabs — bare segments (no per-chunk timings) are written; pipeline
 * regeneration is the path that adds timings.
 *
 * Honors the reviewed guard (skips human_reviewed / source=override /
 * status=reviewed) — those rows may have hand-curated metadata already.
 *
 * Usage:
 *   npx tsx scripts/backfill-pronunciation-metadata.ts                  # live, all books
 *   npx tsx scripts/backfill-pronunciation-metadata.ts --dry            # report only, no writes
 *   npx tsx scripts/backfill-pronunciation-metadata.ts --book 42        # scope to one book
 *   npx tsx scripts/backfill-pronunciation-metadata.ts --limit 500      # cap rows processed
 *   npx tsx scripts/backfill-pronunciation-metadata.ts --dry --limit 5  # smoke test
 */

import { PrismaClient } from "@prisma/client";
import {
  buildBreakdownSegments,
  phoneticDisplay,
  syllabify,
} from "../src/lib/pronunciationMetadata";

const BATCH_SIZE = 200;

function parseFlag<T>(name: string, transform: (v: string) => T): T | undefined {
  const arg = process.argv.find(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`)
  );
  if (!arg) return undefined;
  if (arg === `--${name}`) {
    const idx = process.argv.indexOf(arg);
    const next = process.argv[idx + 1];
    if (!next || next.startsWith("--")) return undefined;
    return transform(next);
  }
  return transform(arg.split("=")[1]);
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const bookIdArg = parseFlag("book", (v) => v);
  const limitArg = parseFlag("limit", (v) => Number(v));
  const limit =
    typeof limitArg === "number" && Number.isInteger(limitArg) && limitArg > 0
      ? limitArg
      : undefined;

  const prisma = new PrismaClient();
  try {
    const where: Record<string, unknown> = {
      AND: [
        {
          OR: [
            { syllables: { equals: null as unknown } },
            { phonetic_display: null },
            { breakdown_segments: { equals: null as unknown } },
          ],
        },
        { human_reviewed: false },
        { NOT: { source: "override" } },
        { NOT: { status: "reviewed" } },
      ],
    };
    if (bookIdArg) {
      try {
        (where.AND as unknown[]).push({ book_id: BigInt(bookIdArg) });
      } catch {
        console.error(`[backfill-metadata] invalid --book value: ${bookIdArg}`);
        process.exit(2);
      }
    }

    const total = await prisma.book_pronunciations.count({ where });
    console.log(
      `[backfill-metadata] mode=${dryRun ? "dry" : "live"} candidates=${total}${
        limit ? ` limit=${limit}` : ""
      }${bookIdArg ? ` book=${bookIdArg}` : ""}`
    );

    if (total === 0) {
      console.log("[backfill-metadata] nothing to do");
      return;
    }

    const cap = limit ?? total;
    let processed = 0;
    let updated = 0;
    let skippedNoChange = 0;

    while (processed < cap) {
      const take = Math.min(BATCH_SIZE, cap - processed);
      const rows = await prisma.book_pronunciations.findMany({
        where,
        orderBy: { id: "asc" },
        skip: processed,
        take,
        select: {
          id: true,
          normalized_word: true,
          syllables: true,
          phonetic_display: true,
          breakdown_segments: true,
        },
      });

      if (rows.length === 0) break;

      let batchUpdated = 0;
      for (const row of rows) {
        const word = row.normalized_word;
        const syllables = syllabify(word);
        const segments = buildBreakdownSegments(word);
        const phonetic = phoneticDisplay(word);

        const update: Record<string, unknown> = {};
        if (
          (row.syllables === null || row.syllables === undefined) &&
          syllables.length > 0
        ) {
          update.syllables = syllables;
        }
        if (row.phonetic_display === null && phonetic !== null) {
          update.phonetic_display = phonetic;
        }
        if (
          (row.breakdown_segments === null ||
            row.breakdown_segments === undefined) &&
          segments.length > 0
        ) {
          update.breakdown_segments = segments;
        }

        if (Object.keys(update).length === 0) {
          skippedNoChange += 1;
          continue;
        }

        if (!dryRun) {
          await prisma.book_pronunciations.update({
            where: { id: row.id },
            data: update,
          });
        }
        batchUpdated += 1;
      }

      processed += rows.length;
      updated += batchUpdated;
      console.log(
        `[backfill-metadata] batch processed=${rows.length} updated=${batchUpdated} totalProcessed=${processed}/${cap}`
      );
    }

    console.log("---");
    console.log(
      `[backfill-metadata] done processed=${processed} updated=${updated} skipped=${skippedNoChange}${
        dryRun ? " (dry-run, no writes)" : ""
      }`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill-metadata] fatal:", err);
  process.exit(1);
});

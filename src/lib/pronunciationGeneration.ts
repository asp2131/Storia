/**
 * Shared pronunciation generation pipeline (Phase 2 — Ticket 2.1 / 2.2 / 2.3).
 *
 * Used by:
 *   - `/api/admin/generate-narration` (inline during narration generation)
 *   - `/api/admin/books/[id]/pronunciations/generate` (standalone)
 *   - `scripts/backfill-pronunciations.ts` (Ticket 2.4 backfill)
 *
 * Persistence:
 *   All generated + failure entries are written to the `book_pronunciations`
 *   Prisma table keyed by `(book_id, normalized_word)`. The legacy per-page
 *   `pages.word_pronunciations` JSON is no longer written by this pipeline.
 *
 * Generation fallback chain (Ticket 2.3):
 *   1. Existing table row — skipped unless `force: true`. Reviewed rows are
 *      ALWAYS skipped (see "reviewed guard" below).
 *   2. TTS (ElevenLabs) — synthesises full-word + breakdown clips.
 *   3. Failure — entry is upserted with `status: "failed"` so the client can
 *      surface a fallback path without retrying.
 *
 * Reviewed guard (critical invariant):
 *   Even when `force: true`, rows where ANY of the following are true are
 *   skipped untouched:
 *     - `human_reviewed === true`
 *     - `status === "reviewed"`
 *     - `source === "override"`
 *   This preserves editorial decisions across regeneration runs. The
 *   `includeReviewed` escape hatch bypasses the guard but is NOT exposed
 *   through any HTTP route.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  synthesizeSpeech,
  synthesizeSpeechWithTimestamps,
} from "@/lib/elevenlabs";
import { prisma } from "@/lib/prisma";
import {
  normalizePronunciationToken,
  type PronunciationEntryObject,
  type WordPronunciationEntry,
} from "@/lib/pronunciation";
import {
  attachTimingsToSegments,
  buildBreakdownSegments,
  buildBreakdownSpeechTextFromSegments,
  phoneticDisplay as computePhoneticDisplay,
  syllabify,
  type BreakdownSegment,
} from "@/lib/pronunciationMetadata";

/**
 * Minimal shape of a `book_pronunciations` row that this module needs.
 * Matches the Prisma model subset returned by `findMany`.
 */
export interface BookPronunciationRow {
  id: bigint;
  book_id: bigint;
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
  generated_at: Date | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GenerateOptions {
  supabase: SupabaseClient;
  bucket: string;
  /** Book ID as a string (BigInt-compatible). */
  bookId: string;
  voiceId: string;
  voiceSettings: {
    speed: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  /** Regenerate even when an entry already exists. Reviewed rows still skipped. */
  force?: boolean;
  /** Words to generate — will be normalized via `normalizePronunciationToken`. */
  words: string[];
  /** Concurrency per batch. */
  batchSize?: number;
  /**
   * ESCAPE HATCH — when true, skips the reviewed guard and regenerates even
   * human-reviewed/override rows. Internal use only; NOT wired to any route.
   */
  includeReviewed?: boolean;
}

export interface GenerateStats {
  /** Unique words considered (post-normalization, deduped). */
  total: number;
  /** Newly generated this run. */
  generated: number;
  /** Skipped because entry already existed (and `force` was false). */
  skipped: number;
  /** TTS attempts that failed. */
  failed: number;
  /** Words for which a breakdown clip was produced. */
  withBreakdown: number;
  /** Failed word list for diagnostics. */
  failures: Array<{ word: string; error: string }>;
  /** Words skipped because of the reviewed guard (even under force). */
  skippedReviewed: number;
}

export interface GenerateResult {
  /** All rows for the book after this run. */
  rows: BookPronunciationRow[];
  /** Backward-compatible map derived from `rows`; persistence remains table-backed. */
  pronunciationMap: Record<string, WordPronunciationEntry>;
  stats: GenerateStats;
}

function getAudioExtension(contentType: string) {
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("wav")) return "wav";
  return "mp3";
}

// Re-exported for backward compatibility with existing callers/tests.
export {
  splitIntoBreakdownChunks,
  spokenBreakdownChunk,
} from "@/lib/pronunciationMetadata";

export function buildBreakdownSpeechText(word: string): string | null {
  const segments = buildBreakdownSegments(word);
  return buildBreakdownSpeechTextFromSegments(segments);
}

export async function uploadPronunciationAsset(params: {
  supabase: SupabaseClient;
  bucket: string;
  bookId: string;
  folder: "full-word" | "breakdown";
  word: string;
  audioBuffer: Buffer;
  contentType: string;
}): Promise<string> {
  const fileExt = getAudioExtension(params.contentType);
  const timestamp = Date.now();
  const storagePath = `books/${params.bookId}/pronunciations/${params.folder}/word_${params.word}_${timestamp}.${fileExt}`;

  const { error } = await params.supabase.storage
    .from(params.bucket)
    .upload(storagePath, params.audioBuffer, {
      contentType: params.contentType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = params.supabase.storage
    .from(params.bucket)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/**
 * True when a row is protected from regeneration by the reviewed guard.
 */
export function isRowReviewedGuarded(row: BookPronunciationRow): boolean {
  return (
    row.human_reviewed === true ||
    row.status === "reviewed" ||
    row.source === "override"
  );
}

/**
 * True when a row already has both playback assets needed for full coverage.
 * A full-word-only row is intentionally not complete: it should be selected
 * for a later generation pass so missing breakdown_url can be backfilled.
 */
function rowHasAnyAudio(row: BookPronunciationRow | undefined): boolean {
  if (!row) return false;
  const hasFull =
    typeof row.full_word_url === "string" && row.full_word_url.length > 0;
  const hasBreak =
    typeof row.breakdown_url === "string" && row.breakdown_url.length > 0;
  return hasFull || hasBreak;
}

function rowHasCompleteAudio(row: BookPronunciationRow | undefined): boolean {
  if (!row) return false;
  const hasFull =
    typeof row.full_word_url === "string" && row.full_word_url.length > 0;
  const hasBreak =
    typeof row.breakdown_url === "string" && row.breakdown_url.length > 0;
  return hasFull && hasBreak;
}

/**
 * Generate (or reuse) pronunciation entries for a set of words and persist
 * them to the `book_pronunciations` table. Returns the full row set for the
 * book plus run stats — callers can derive page-level coverage from `rows`.
 */
export async function generatePronunciationEntries(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const {
    supabase,
    bucket,
    bookId,
    voiceId,
    voiceSettings,
    force = false,
    words,
    batchSize = 5,
    includeReviewed = false,
  } = opts;

  const bookIdBigInt = BigInt(bookId);

  // Load existing rows for the book up front — one query, then reuse.
  const existingRows = (await prisma.book_pronunciations.findMany({
    where: { book_id: bookIdBigInt },
  })) as BookPronunciationRow[];

  const existingByWord = new Map<string, BookPronunciationRow>();
  for (const row of existingRows) {
    existingByWord.set(row.normalized_word, row);
  }

  // De-dupe normalized words.
  const uniqueWords = Array.from(
    new Set(words.map(normalizePronunciationToken).filter(Boolean))
  );

  const stats: GenerateStats = {
    total: uniqueWords.length,
    generated: 0,
    skipped: 0,
    failed: 0,
    withBreakdown: 0,
    failures: [],
    skippedReviewed: 0,
  };

  const wordsToGenerate: string[] = [];
  for (const word of uniqueWords) {
    const existing = existingByWord.get(word);

    // Reviewed guard: reviewed rows are skipped untouched unless the
    // explicit internal escape hatch is set.
    if (existing && isRowReviewedGuarded(existing) && !includeReviewed) {
      stats.skippedReviewed += 1;
      stats.skipped += 1;
      continue;
    }

    // Existing row with full coverage + not forced → skip. Full-word-only rows
    // are partial and should be backfilled with breakdown audio.
    if (!force && rowHasCompleteAudio(existing)) {
      stats.skipped += 1;
      continue;
    }

    wordsToGenerate.push(word);
  }

  for (let i = 0; i < wordsToGenerate.length; i += batchSize) {
    const batch = wordsToGenerate.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (word) => {
        const segments = buildBreakdownSegments(word);
        const syllables = syllabify(word);
        const phonetic = computePhoneticDisplay(word);

        try {
          const fullWordAudio = await synthesizeSpeech({
            text: word,
            voiceId,
            speed: voiceSettings.speed,
            style: voiceSettings.style,
            useSpeakerBoost: voiceSettings.useSpeakerBoost,
          });

          const fullWordUrl = await uploadPronunciationAsset({
            supabase,
            bucket,
            bookId,
            folder: "full-word",
            word,
            audioBuffer: fullWordAudio.audioBuffer,
            contentType: fullWordAudio.contentType,
          });

          let breakdownUrl: string | undefined;
          let timedSegments: BreakdownSegment[] = segments;
          const breakdownSpeechText =
            buildBreakdownSpeechTextFromSegments(segments);
          if (breakdownSpeechText) {
            try {
              // eleven_v3 honors <break time="..." /> reliably and gives
              // clean syllable separation. with-timestamps endpoint returns
              // per-character alignment we can fold back into segments.
              const breakdownAudio = await synthesizeSpeechWithTimestamps({
                text: breakdownSpeechText,
                voiceId,
                modelId: "eleven_v3",
                useSpeakerBoost: voiceSettings.useSpeakerBoost,
              });

              breakdownUrl = await uploadPronunciationAsset({
                supabase,
                bucket,
                bookId,
                folder: "breakdown",
                word,
                audioBuffer: breakdownAudio.audioBuffer,
                contentType: breakdownAudio.contentType,
              });

              try {
                const alignment =
                  breakdownAudio.alignment ?? breakdownAudio.normalizedAlignment;
                timedSegments = attachTimingsToSegments(
                  segments,
                  alignment,
                  breakdownSpeechText
                );
              } catch (alignErr) {
                console.warn(
                  `[pronunciationGeneration] alignment parse failed for "${word}":`,
                  alignErr
                );
                timedSegments = segments;
              }
            } catch (breakdownError) {
              console.warn(
                `[pronunciationGeneration] breakdown failed for "${word}":`,
                breakdownError
              );
            }
          }

          return {
            word,
            fullWordUrl,
            breakdownUrl,
            segments: timedSegments,
            syllables,
            phonetic,
            error: null as string | null,
          } as const;
        } catch (wordError) {
          const message =
            wordError instanceof Error ? wordError.message : String(wordError);
          return {
            word,
            fullWordUrl: null as string | null,
            breakdownUrl: null as string | undefined | null,
            segments,
            syllables,
            phonetic,
            error: message,
          } as const;
        }
      })
    );

    for (const result of results) {
      const breakdownSegmentsJson =
        result.segments.length > 0 ? result.segments : null;
      const syllablesJson =
        result.syllables.length > 0 ? result.syllables : null;
      const phoneticDisplayValue = result.phonetic ?? null;

      if (result.error === null && result.fullWordUrl) {
        const now = new Date();
        await prisma.book_pronunciations.upsert({
          where: {
            book_id_normalized_word: {
              book_id: bookIdBigInt,
              normalized_word: result.word,
            },
          },
          create: {
            book_id: bookIdBigInt,
            normalized_word: result.word,
            full_word_url: result.fullWordUrl,
            breakdown_url: result.breakdownUrl ?? null,
            phonetic_display: phoneticDisplayValue,
            syllables: syllablesJson ?? undefined,
            breakdown_segments:
              (breakdownSegmentsJson as unknown as object) ?? undefined,
            source: "tts",
            status: "generated",
            confidence: 1,
            generated_at: now,
          },
          update: {
            full_word_url: result.fullWordUrl,
            breakdown_url: result.breakdownUrl ?? null,
            phonetic_display: phoneticDisplayValue,
            syllables: syllablesJson ?? undefined,
            breakdown_segments:
              (breakdownSegmentsJson as unknown as object) ?? undefined,
            source: "tts",
            status: "generated",
            confidence: 1,
            generated_at: now,
          },
        });

        stats.generated += 1;
        if (result.breakdownUrl) {
          stats.withBreakdown += 1;
        }
      } else {
        // Failure — upsert a failure marker. Metadata still useful even when
        // audio generation failed, so persist syllables/phonetic/segments too.
        await prisma.book_pronunciations.upsert({
          where: {
            book_id_normalized_word: {
              book_id: bookIdBigInt,
              normalized_word: result.word,
            },
          },
          create: {
            book_id: bookIdBigInt,
            normalized_word: result.word,
            phonetic_display: phoneticDisplayValue,
            syllables: syllablesJson ?? undefined,
            breakdown_segments:
              (breakdownSegmentsJson as unknown as object) ?? undefined,
            source: "tts",
            status: "failed",
          },
          update: {
            phonetic_display: phoneticDisplayValue,
            syllables: syllablesJson ?? undefined,
            breakdown_segments:
              (breakdownSegmentsJson as unknown as object) ?? undefined,
            status: "failed",
            source: "tts",
          },
        });

        stats.failed += 1;
        stats.failures.push({
          word: result.word,
          error: result.error ?? "unknown",
        });
      }
    }
  }

  // Re-fetch final rows so callers can build coverage reports without
  // another round-trip.
  const finalRows = (await prisma.book_pronunciations.findMany({
    where: { book_id: bookIdBigInt },
  })) as BookPronunciationRow[];

  const pronunciationMap: Record<string, WordPronunciationEntry> = {};
  for (const row of finalRows) {
    if (rowHasAnyAudio(row)) {
      pronunciationMap[row.normalized_word] = rowToWordPronunciationEntry(row);
    }
  }

  return { rows: finalRows, pronunciationMap, stats };
}

/**
 * For a set of page text token lists, return the unique normalized tokens
 * that are not yet covered in the existing rows. Honors `force` and the
 * reviewed guard.
 */
export function collectMissingTokens(
  tokensByPage: string[][],
  existingRows: BookPronunciationRow[],
  options?: { force?: boolean; includeReviewed?: boolean }
): string[] {
  const force = options?.force ?? false;
  const includeReviewed = options?.includeReviewed ?? false;

  const rowByWord = new Map<string, BookPronunciationRow>();
  for (const row of existingRows) {
    rowByWord.set(row.normalized_word, row);
  }

  const missing = new Set<string>();

  for (const pageTokens of tokensByPage) {
    for (const rawToken of pageTokens) {
      const token = normalizePronunciationToken(rawToken);
      if (!token) continue;

      const existing = rowByWord.get(token);

      // Reviewed rows are never regenerated (unless internal escape hatch).
      if (existing && isRowReviewedGuarded(existing) && !includeReviewed) {
        continue;
      }

      if (!force && rowHasCompleteAudio(existing)) continue;

      missing.add(token);
    }
  }

  return Array.from(missing);
}

/**
 * Minimal shape used for coverage classification. Accepts either a table row
 * (via `{ full_word_url, breakdown_url }`) or `null` for "missing".
 */
export type CoverageEntry =
  | Pick<BookPronunciationRow, "full_word_url" | "breakdown_url">
  | null
  | undefined;

/**
 * Classify a single row (or null) for coverage reporting.
 *
 *   - "covered"         — both full-word and breakdown audio present
 *   - "full-word-only"  — only one of the two URLs present
 *   - "missing"         — row absent or both URLs empty
 */
export function entryCoverageStatus(
  entry: CoverageEntry
): "covered" | "full-word-only" | "missing" {
  if (!entry) return "missing";
  const hasFull =
    typeof entry.full_word_url === "string" && entry.full_word_url.length > 0;
  const hasBreak =
    typeof entry.breakdown_url === "string" && entry.breakdown_url.length > 0;
  if (hasFull && hasBreak) return "covered";
  if (hasFull || hasBreak) return "full-word-only";
  return "missing";
}

/**
 * Convenience: convert a table row into the legacy `WordPronunciationEntry`
 * object shape used by narration-route response payloads for backward
 * compatibility with clients that still consume `wordPronunciations` inline.
 */
export function rowToWordPronunciationEntry(
  row: BookPronunciationRow
): WordPronunciationEntry {
  const entry: PronunciationEntryObject = {};
  if (row.full_word_url) entry.fullWord = row.full_word_url;
  if (row.breakdown_url) entry.breakdown = row.breakdown_url;
  if (row.source === "override" || row.source === "lexicon" || row.source === "tts") {
    entry.source = row.source;
  }
  if (typeof row.confidence === "number") entry.confidence = row.confidence;
  if (row.status === "generated" || row.status === "failed" || row.status === "reviewed") {
    entry.status = row.status;
  }
  if (row.generated_at) entry.generatedAt = row.generated_at.toISOString();
  if (row.phonetic_display) entry.phoneticDisplay = row.phonetic_display;
  if (Array.isArray(row.syllables)) {
    entry.syllables = (row.syllables as unknown[]).map((s) => String(s));
  }
  if (Array.isArray(row.breakdown_segments)) {
    entry.breakdownSegments = row.breakdown_segments as PronunciationEntryObject["breakdownSegments"];
  }
  return entry;
}

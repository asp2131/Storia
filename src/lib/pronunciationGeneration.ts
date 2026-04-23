/**
 * Shared pronunciation generation pipeline (Phase 2 — Ticket 2.1 / 2.2 / 2.3).
 *
 * Used by:
 *   - `/api/admin/generate-narration` (inline during narration generation)
 *   - `/api/admin/books/[id]/pronunciations/generate` (standalone)
 *   - `scripts/backfill-pronunciations.ts` (Ticket 2.4 backfill)
 *
 * Generation fallback chain (Ticket 2.3):
 *   1. `existingEntries` — curated/editor override or already-generated. Skipped
 *      unless `force: true`.
 *   2. TTS (ElevenLabs) — synthesises full-word + breakdown clips.
 *   3. Failure — entry is recorded as `{ status: "failed", source: "tts" }`
 *      so the client can surface a fallback path without retrying.
 *
 * Dictionary/lexicon tier is deferred; the hook is in place (`source` field)
 * so a future provider can slot in before the TTS tier without client changes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import {
  createStoredPronunciationEntry,
  entryHasAudio,
  normalizePronunciationToken,
  type WordPronunciationEntry,
  type WordPronunciationMap,
} from "@/lib/pronunciation";

export interface GenerateOptions {
  supabase: SupabaseClient;
  bucket: string;
  bookId: string;
  voiceId: string;
  voiceSettings: {
    speed: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  /** Existing manifest; entries here are skipped unless `force: true`. */
  existingEntries?: WordPronunciationMap;
  /** Regenerate even when an entry already exists. */
  force?: boolean;
  /** Words to generate — expected to be normalized via `normalizePronunciationToken`. */
  words: string[];
  /** Concurrency per batch. */
  batchSize?: number;
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
}

export interface GenerateResult {
  /** Map of normalized word → entry (merged existing + newly generated). */
  pronunciationMap: WordPronunciationMap;
  stats: GenerateStats;
}

function getAudioExtension(contentType: string) {
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("wav")) return "wav";
  return "mp3";
}

export function splitIntoBreakdownChunks(word: string): string[] {
  const normalized = normalizePronunciationToken(word);
  if (!normalized || normalized.length <= 3) {
    return normalized ? [normalized] : [];
  }

  const vowelGroupRegex =
    /[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]*[aeiouy])|[^aeiouy]?$)?/gi;
  const roughChunks = normalized.match(vowelGroupRegex)?.filter(Boolean) ?? [];

  if (roughChunks.length >= 2) {
    return roughChunks;
  }

  const fallbackChunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const remaining = normalized.length - cursor;
    const chunkSize = remaining <= 4 ? Math.max(2, remaining) : 3;
    fallbackChunks.push(normalized.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
  }

  return fallbackChunks;
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
 * Generate (or reuse) pronunciation entries for a set of words.
 * Merges newly-generated entries with `existingEntries` and returns the full
 * manifest plus coverage stats.
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
    existingEntries = {},
    force = false,
    words,
    batchSize = 5,
  } = opts;

  // De-dupe normalized words.
  const uniqueWords = Array.from(
    new Set(words.map(normalizePronunciationToken).filter(Boolean))
  );

  const merged: WordPronunciationMap = { ...existingEntries };
  const stats: GenerateStats = {
    total: uniqueWords.length,
    generated: 0,
    skipped: 0,
    failed: 0,
    withBreakdown: 0,
    failures: [],
  };

  const wordsToGenerate = uniqueWords.filter((w) => {
    if (force) return true;
    return !entryHasAudio(existingEntries[w]);
  });

  stats.skipped = uniqueWords.length - wordsToGenerate.length;

  for (let i = 0; i < wordsToGenerate.length; i += batchSize) {
    const batch = wordsToGenerate.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (word) => {
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
          const chunks = splitIntoBreakdownChunks(word);
          if (chunks.length >= 2) {
            try {
              const breakdownAudio = await synthesizeSpeech({
                text: chunks.join(", "),
                voiceId,
                speed: Math.max(0.7, voiceSettings.speed * 0.92),
                style: voiceSettings.style,
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
            } catch (breakdownError) {
              console.warn(
                `[pronunciationGeneration] breakdown failed for "${word}":`,
                breakdownError
              );
            }
          }

          return {
            word,
            entry: createStoredPronunciationEntry(fullWordUrl, breakdownUrl, {
              source: "tts",
              status: "generated",
              confidence: 1,
              generatedAt: new Date().toISOString(),
            }),
          } as const;
        } catch (wordError) {
          const message =
            wordError instanceof Error ? wordError.message : String(wordError);
          return { word, entry: null, error: message } as const;
        }
      })
    );

    for (const result of results) {
      if (result.entry) {
        merged[result.word] = result.entry;
        stats.generated += 1;
        if (
          typeof result.entry !== "string" &&
          typeof result.entry.breakdown === "string"
        ) {
          stats.withBreakdown += 1;
        }
      } else {
        stats.failed += 1;
        stats.failures.push({ word: result.word, error: result.error });
      }
    }
  }

  return { pronunciationMap: merged, stats };
}

/**
 * For a set of page texts, return the unique normalized tokens that do not
 * yet have an existing audio-bearing entry.
 */
export function collectMissingTokens(
  pages: Array<{ textContent: string | null; entries: WordPronunciationMap }>,
  options?: { force?: boolean }
): string[] {
  const force = options?.force ?? false;
  const missing = new Set<string>();

  for (const page of pages) {
    const text = page.textContent ?? "";
    if (!text.trim()) continue;

    for (const rawToken of text.split(/\s+/)) {
      const token = normalizePronunciationToken(rawToken);
      if (!token) continue;
      if (!force && entryHasAudio(page.entries[token])) continue;
      missing.add(token);
    }
  }

  return Array.from(missing);
}

/**
 * For a single entry, report whether it is ready for the reader.
 */
export function entryCoverageStatus(
  entry: WordPronunciationEntry | undefined
): "covered" | "full-word-only" | "missing" {
  if (!entry) return "missing";
  if (typeof entry === "string") return entry.trim().length > 0 ? "full-word-only" : "missing";
  const hasFull = typeof entry.fullWord === "string" && entry.fullWord.length > 0;
  const hasBreak = typeof entry.breakdown === "string" && entry.breakdown.length > 0;
  if (hasFull && hasBreak) return "covered";
  if (hasFull || hasBreak) return "full-word-only";
  return "missing";
}

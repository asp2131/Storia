import { forceAlign, type WordTimestamp } from "@/lib/elevenlabs";
import { fallbackTiming } from "./fallbackTiming";

/**
 * Turns a recorded audio file plus the page's reference words into a timestamp
 * array the mobile reader can highlight from.
 *
 * The output is ALWAYS 1:1 with `tokens` (see referenceWords.ts for why). The
 * status records how much to trust it:
 *
 *   aligned    — aligner returned one timing per reference word.
 *   projected  — aligner disagreed on word count; timings were monotonically
 *                projected onto the reference words. Usable, may drift.
 *   fallback   — aligner failed or returned nothing; timings are
 *                duration-proportional guesses.
 */

export type AlignmentStatus = "aligned" | "projected" | "fallback";

export interface AlignRecordingArgs {
  audio: Buffer;
  contentType: string;
  fileName?: string;
  tokens: string[];
  durationSeconds: number;
}

export interface AlignRecordingResult {
  timestamps: WordTimestamp[];
  status: AlignmentStatus;
  loss?: number;
}

/**
 * Map aligner timings onto reference tokens when the counts disagree.
 *
 * Each reference token takes a *fractional* position in the aligned timeline
 * (token i → aligned index i * alignedCount / tokenCount) and interpolates
 * inside that aligned word's span. Interpolating rather than snapping matters:
 * when several tokens collapse onto one aligned word, snapping would give them
 * all identical start/end, producing zero-length spans that never highlight.
 *
 * Spans are contiguous — each token ends where the next begins — so the
 * reader's `computeActiveWordIndex` never falls into a gap.
 */
export function projectOntoTokens(
  aligned: WordTimestamp[],
  tokens: string[],
  durationSeconds: number
): WordTimestamp[] {
  if (tokens.length === 0) return [];
  if (aligned.length === 0) return fallbackTiming(tokens, durationSeconds);

  const scale = aligned.length / tokens.length;

  const startAt = (i: number): number => {
    const fractional = i * scale;
    const index = Math.min(aligned.length - 1, Math.floor(fractional));
    const source = aligned[index];
    const span = Math.max(0, source.end - source.start);
    return source.start + span * (fractional - index);
  };

  const lastEnd = Math.max(aligned[aligned.length - 1].end, durationSeconds || 0);

  const projected: WordTimestamp[] = [];
  let previousStart = 0;

  for (let i = 0; i < tokens.length; i++) {
    const start = Math.max(previousStart, startAt(i));
    const end = i === tokens.length - 1 ? Math.max(start, lastEnd) : Math.max(start, startAt(i + 1));

    projected.push({ word: tokens[i], start, end });
    previousStart = start;
  }

  return projected;
}

/**
 * Post-conditions the reader depends on. Throwing here is correct: persisting a
 * malformed array produces highlighting that is silently wrong on every reread,
 * which is worse than a failed upload the parent can retry.
 */
export function assertTimestampsValid(
  timestamps: WordTimestamp[],
  tokens: string[]
): void {
  if (timestamps.length !== tokens.length) {
    throw new Error(
      `Timestamp/word count mismatch: ${timestamps.length} timings for ${tokens.length} words`
    );
  }

  for (let i = 0; i < timestamps.length; i++) {
    const { start, end } = timestamps[i];

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`Non-finite timing at index ${i}`);
    }
    if (start > end) {
      throw new Error(`Inverted timing at index ${i}: ${start} > ${end}`);
    }
    if (i > 0 && start < timestamps[i - 1].start) {
      throw new Error(`Non-monotonic start at index ${i}`);
    }
  }
}

export async function alignRecording(
  args: AlignRecordingArgs
): Promise<AlignRecordingResult> {
  const { tokens, durationSeconds } = args;

  if (tokens.length === 0) {
    return { timestamps: [], status: "aligned" };
  }

  let result: AlignRecordingResult;

  try {
    const { words, loss } = await forceAlign({
      audio: args.audio,
      contentType: args.contentType,
      fileName: args.fileName,
      text: tokens.join(" "),
    });

    if (words.length === tokens.length) {
      // Rewrite the word field to the reference token: the aligner may
      // normalize punctuation/casing, and the reader displays page text.
      result = {
        status: "aligned",
        loss,
        timestamps: words.map((w, i) => ({ ...w, word: tokens[i] })),
      };
    } else if (words.length > 0) {
      result = {
        status: "projected",
        loss,
        timestamps: projectOntoTokens(words, tokens, durationSeconds),
      };
    } else {
      result = {
        status: "fallback",
        loss,
        timestamps: fallbackTiming(tokens, durationSeconds),
      };
    }
  } catch (error) {
    console.warn("[narration] forced alignment failed, using proportional timing", error);
    result = {
      status: "fallback",
      timestamps: fallbackTiming(tokens, durationSeconds),
    };
  }

  assertTimestampsValid(result.timestamps, tokens);
  return result;
}

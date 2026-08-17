import type { WordTimestamp } from "@/lib/elevenlabs";

/**
 * Deterministic duration-proportional word timings.
 *
 * Used when forced alignment is unavailable or unusable. Highlighting driven by
 * these timings drifts in proportion to how uneven the reading was, so callers
 * persist the `fallback` status and surface a retake nudge — but a roughly-right
 * highlight still beats none.
 *
 * Weighting: longer words take longer to say, and a word ending a clause is
 * followed by a pause that belongs to that word's slot.
 */

const PUNCTUATION_PAUSE_WEIGHT: Record<string, number> = {
  ",": 1.5,
  ";": 2,
  ":": 2,
  ".": 3,
  "!": 3,
  "?": 3,
  "—": 2,
};

function tokenWeight(token: string): number {
  // +1 so a single-character token still carries weight.
  let weight = token.length + 1;

  const last = token.slice(-1);
  weight += PUNCTUATION_PAUSE_WEIGHT[last] ?? 0;

  return weight;
}

/**
 * Distribute `durationSeconds` across `tokens` proportionally to their weight.
 * Result is contiguous (each word's `end` is the next word's `start`) and
 * monotonically non-decreasing.
 */
export function fallbackTiming(
  tokens: string[],
  durationSeconds: number
): WordTimestamp[] {
  if (tokens.length === 0) return [];

  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;

  const weights = tokens.map(tokenWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const result: WordTimestamp[] = [];
  let cursor = 0;

  for (let i = 0; i < tokens.length; i++) {
    const share = totalWeight > 0 ? (weights[i] / totalWeight) * duration : 0;
    const start = cursor;
    // Pin the final word to the exact duration so rounding never overshoots.
    const end = i === tokens.length - 1 ? duration : start + share;

    result.push({ word: tokens[i], start, end });
    cursor = end;
  }

  return result;
}

/**
 * Pronunciation analytics helper — Part 1 of WR-9 / FR-WEB-37–39.
 *
 * No dedicated analytics SDK is wired in this project for pronunciation events
 * today. Events are emitted via `window.umami?.track` (Umami, the project's
 * existing analytics sink). This module:
 *   1. Defines the full typed event shape (extended beyond the previous 5 fields).
 *   2. Provides `emitPronunciationEvent()` as the single call site every handler
 *      must use.
 *   3. Also writes a structured console.info log behind the
 *      `NEXT_PUBLIC_PRONUNCIATION_DEBUG=true` env flag for local development /
 *      QA so engineers can inspect the full payload without a production sink.
 *
 * Backward compat: all previous event consumers still receive `bookId`, `pageId`,
 * `word`, `mode`, and `trigger` on every event. The new fields are additive and
 * nullable where the outcome is not yet known at emit time.
 */

import type { PronunciationPlaybackMode, PronunciationTrigger } from "@/hooks/useWordPronunciation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Identifies the code path that was taken during a pronunciation interaction.
 * Mirrors the breakdown requested by WR-9 §2.
 */
export type PronunciationPlaybackPath =
  | "manifest-breakdown"         // breakdown clip from the manifest entry was used
  | "manifest-fullword-fallback" // manifest entry only had fullWord; fallback to it
  | "legacy-page-fullword"       // legacy page-level word pronunciations hit (string or { fullWord })
  | "no-data-fallback"           // no manifest / no entry → legacy /api/pronounce-word or no audio
  | "manifest-load-failure"      // manifest URL present but fetch failed
  | "cancelled-or-replaced";     // prior request cancelled/replaced before audio played

/**
 * Terminal outcome of the pronunciation attempt.
 */
export type PronunciationOutcome =
  | "played"        // audio reached audible playback
  | "cancelled"     // superceded by another request before audio started
  | "replaced"      // actively playing when a newer request took over
  | "failed-load"   // HTTP fetch or network error
  | "failed-decode" // audio data fetched but decodeAudioData threw
  | "no-data";      // no audio URL found for the word in any path

/**
 * Full typed pronunciation analytics event.  All legacy fields are present;
 * new fields are nullable/optional so old consumers remain unaffected.
 */
export interface PronunciationAnalyticsEvent {
  // ─── Legacy fields (always present) ────────────────────────────────────
  bookId: string | number | undefined;
  pageId: string | number | undefined;
  /** The display word as given by the UI (may contain capitalisation / punctuation). */
  word: string;
  mode: PronunciationPlaybackMode;
  trigger: PronunciationTrigger | string;
  page?: number;

  // ─── New fields (WR-9 / FR-WEB-37–39) ─────────────────────────────────
  /** Result of `normalizePronunciationToken(word)`. */
  normalizedWord: string;
  /** Code path taken during this interaction. */
  playbackPath: PronunciationPlaybackPath;
  /**
   * Milliseconds from user interaction (pointerdown / keydown) to first
   * audible playback start (AudioBufferSourceNode.start()).
   * `null` when playback never started (cancelled, failure, no-data).
   */
  latencyMs: number | null;
  /** Terminal result of this interaction attempt. */
  outcome: PronunciationOutcome;
  /** Whether the pronunciation feature flag was enabled at interaction time. */
  featureEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

const DEBUG =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PRONUNCIATION_DEBUG === "true";

/**
 * Emit a pronunciation analytics event via Umami (existing project sink) and,
 * when `NEXT_PUBLIC_PRONUNCIATION_DEBUG=true`, also log the full payload to
 * console for development/QA visibility.
 *
 * If Umami is not loaded (e.g. local dev without the snippet), the event is
 * silently skipped — no error is thrown.
 */
export function emitPronunciationEvent(payload: PronunciationAnalyticsEvent): void {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.info("[pronunciation:event]", payload);
  }

  // Umami is loaded by the Next.js layout via a <script> tag.  `window.umami`
  // may be undefined in SSR context or when the snippet hasn't loaded yet.
  if (typeof window !== "undefined" && window.umami?.track) {
    window.umami.track("reader-pronunciation", payload);
  }
}

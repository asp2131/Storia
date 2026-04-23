"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  normalizePronunciationToken,
  resolvePronunciationUrl,
  type PronunciationPlaybackMode,
  type WordPronunciationEntry,
} from "@/lib/pronunciation";

export type { PronunciationPlaybackMode };
export type PronunciationTrigger =
  | "click"
  | "keyboard"
  | "long-press"
  | "alternate-control";

export type PronunciationRequest = {
  word: string;
  index: number;
  mode?: PronunciationPlaybackMode;
  trigger?: PronunciationTrigger;
  /**
   * WR-9.4: called exactly once when the first `AudioBufferSourceNode.start()`
   * fires for this request, with the latency in ms from when `pronounceWord`
   * was invoked. Not called if the request is superseded or fails before
   * audible playback begins.
   */
  onPlaybackStart?: (info: { latencyMs: number }) => void;
};

/**
 * Playback arbitration state machine states (WG-4 / WR-5).
 *
 * idle                    — nothing playing, no pending resume
 * pronouncing-step1       — playing breakdown clip (step 1 of breakdown sequence)
 * pronouncing-step2       — playing full-word clip after breakdown (step 2)
 * pronouncing-quick       — playing whole-word clip (single-clip path)
 * awaiting-resume         — pronunciation done, waiting to resume narration
 *
 * Transitions:
 *  idle           + userTap(whole-word)         → pronouncing-quick
 *  idle           + userTap(breakdown, no data) → pronouncing-quick (fallback)
 *  idle           + userTap(breakdown, data)    → pronouncing-step1
 *  pronouncing-*  + newRequest                  → cancel-and-replace → pronouncing-*
 *  pronouncing-*  + userToggleNarration         → clears shouldResume intent
 *  pronouncing-step1 + audioEnded               → pronouncing-step2 (if fullWord exists)
 *                                               → awaiting-resume / idle otherwise
 *  pronouncing-step2 + audioEnded               → awaiting-resume / idle
 *  pronouncing-quick + audioEnded               → idle (no narration resume for quick mode)
 *  awaiting-resume + condition met              → idle (narration resumed)
 *  pronouncing-* + audioError                   → awaiting-resume / idle
 */
type PlaybackState =
  | "idle"
  | "pronouncing-step1"
  | "pronouncing-step2"
  | "pronouncing-quick"
  | "awaiting-resume";

interface UseWordPronunciationReturn {
  pronounceWord: (request: PronunciationRequest) => void;
  pronouncingIndex: number | null;
  isLoading: boolean;
  playbackState: PlaybackState;
}

/** Gap in ms between breakdown and full-word clips (WR-5.3). */
const BREAKDOWN_INTER_CLIP_GAP_MS = 150;

export function useWordPronunciation(options: {
  wordPronunciations: Record<string, WordPronunciationEntry> | null;
  nextPagePronunciations?: Record<string, WordPronunciationEntry> | null;
  getNarrationPlaybackState?: () => boolean;
  pauseNarration?: () => void;
  resumeNarration?: () => void;
  getNarrationIntentVersion?: () => number;
}): UseWordPronunciationReturn {
  const {
    wordPronunciations,
    nextPagePronunciations,
    getNarrationPlaybackState,
    pauseNarration,
    resumeNarration,
    getNarrationIntentVersion,
  } = options;

  const [pronouncingIndex, setPronouncingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");

  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackCache = useRef<Map<string, string>>(new Map());
  // Monotonically-incrementing request ID for cancel-and-replace (WR-5.8).
  const activeRequestIdRef = useRef(0);
  // Per-request metadata for WR-9.4 latency capture. Only the active request
  // entry is populated; superseded entries are pruned on new request.
  const requestMetaRef = useRef<{
    requestId: number;
    interactionTs: number;
    onPlaybackStart?: (info: { latencyMs: number }) => void;
    started: boolean;
  } | null>(null);

  /**
   * Fires `onPlaybackStart` exactly once per request, when the first
   * `AudioBufferSourceNode.start()` happens. Called inside `playSingleBuffer`
   * just before `source.start(0)`.
   */
  const reportPlaybackStart = useCallback((requestId: number) => {
    const meta = requestMetaRef.current;
    if (!meta || meta.requestId !== requestId || meta.started) return;
    meta.started = true;
    const latencyMs = Date.now() - meta.interactionTs;
    try {
      meta.onPlaybackStart?.({ latencyMs });
    } catch {
      // Never let analytics failure affect playback.
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  /**
   * Stops any in-flight AudioBufferSourceNode and nulls out its onended
   * callback so it cannot trigger side effects (WR-5.8 cancel-and-replace).
   */
  const stopActivePlayback = useCallback(() => {
    if (activeSourceRef.current) {
      activeSourceRef.current.onended = null;
      try {
        activeSourceRef.current.stop();
      } catch {
        // no-op: already stopped
      }
      activeSourceRef.current = null;
    }
  }, []);

  /**
   * Clears pronouncing/loading state for a specific requestId.
   * Guards against stale callbacks from superseded requests.
   */
  const finalizeRequest = useCallback((requestId: number) => {
    if (requestId !== activeRequestIdRef.current) {
      return;
    }
    setPronouncingIndex(null);
    setIsLoading(false);
    setPlaybackState("idle");
  }, []);

  /**
   * Attempts to auto-resume narration after pronunciation ends.
   * Narration is resumed ONLY if:
   *  - mode is "breakdown" (whole-word never pauses narration, WR-5.7)
   *  - resumeNarration callback is provided
   *  - the narration intent version has not changed (user did not manually
   *    toggle narration during/after pronunciation, WR-5.7)
   *  - narration is currently paused (we triggered the pause, it wasn't already
   *    playing, WR-5.6)
   */
  const maybeResumeNarration = useCallback(
    (mode: PronunciationPlaybackMode, narrationIntentVersionAtStart: number) => {
      if (mode !== "breakdown") {
        return;
      }
      if (!resumeNarration) {
        return;
      }
      const latestIntentVersion = getNarrationIntentVersion?.() ?? narrationIntentVersionAtStart;
      if (latestIntentVersion !== narrationIntentVersionAtStart) {
        // User manually changed narration state — user intent wins (WR-5.7).
        return;
      }
      if (getNarrationPlaybackState?.()) {
        // Narration is already playing (e.g. was never paused), do not resume.
        return;
      }
      resumeNarration();
    },
    [getNarrationIntentVersion, getNarrationPlaybackState, resumeNarration]
  );

  // ─── Audio decoding ────────────────────────────────────────────────────────

  const decodeUrl = useCallback(
    async (url: string): Promise<AudioBuffer | null> => {
      try {
        const ctx = getAudioContext();
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
      } catch {
        return null;
      }
    },
    [getAudioContext]
  );

  /** Preload (decode + cache) all audio URLs referenced in a pronunciation map. */
  const preloadMap = useCallback(
    (map: Record<string, WordPronunciationEntry> | null) => {
      if (!map) return;
      for (const entry of Object.values(map)) {
        const urls: string[] =
          typeof entry === "string"
            ? [entry]
            : [
                ...(entry.fullWord ? [entry.fullWord] : []),
                ...(entry.breakdown ? [entry.breakdown] : []),
              ];

        for (const url of urls) {
          if (bufferCacheRef.current.has(url)) continue;
          decodeUrl(url).then((buffer) => {
            if (buffer) {
              bufferCacheRef.current.set(url, buffer);
            }
          });
        }
      }
    },
    [decodeUrl]
  );

  // Pre-decode current page pronunciations.
  useEffect(() => {
    preloadMap(wordPronunciations);
  }, [wordPronunciations, preloadMap]);

  // Prefetch next page pronunciations during idle time.
  useEffect(() => {
    if (!nextPagePronunciations) return;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => preloadMap(nextPagePronunciations));
      return () => cancelIdleCallback(id);
    }

    const timer = window.setTimeout(() => preloadMap(nextPagePronunciations), 2000);
    return () => window.clearTimeout(timer);
  }, [nextPagePronunciations, preloadMap]);

  // Cancel active playback and reset state whenever the pronunciation map changes
  // (e.g. user navigates to a new page). This prevents stuck states (WR-5.9/10).
  useEffect(() => {
    stopActivePlayback();
    setPronouncingIndex(null);
    setIsLoading(false);
    setPlaybackState("idle");
  }, [wordPronunciations, stopActivePlayback]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopActivePlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopActivePlayback]);

  // ─── Core playback primitive ───────────────────────────────────────────────

  /**
   * Plays an AudioBuffer and installs an onended handler.
   * The `onEnded` callback is responsible for transitioning state further
   * (either to step2 for the breakdown chain, or to idle/resume).
   *
   * Returns false if the requestId is no longer current (superseded request).
   */
  const playSingleBuffer = useCallback(
    (
      buffer: AudioBuffer,
      index: number,
      requestId: number,
      state: PlaybackState,
      onEnded: () => void
    ): boolean => {
      if (requestId !== activeRequestIdRef.current) {
        return false;
      }

      const ctx = getAudioContext();
      stopActivePlayback();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      setPronouncingIndex(index);
      setIsLoading(false);
      setPlaybackState(state);

      source.onended = () => {
        if (requestId !== activeRequestIdRef.current) {
          // Request was superseded; discard this callback entirely.
          return;
        }
        activeSourceRef.current = null;
        onEnded();
      };

      activeSourceRef.current = source;
      reportPlaybackStart(requestId);
      source.start(0);
      return true;
    },
    [getAudioContext, reportPlaybackStart, stopActivePlayback]
  );

  // ─── Breakdown two-clip sequence (WR-5.3) ─────────────────────────────────

  /**
   * Plays the breakdown sequence: breakdown clip → [gap] → full-word clip.
   *
   * If only one URL is provided (or they share the same URL), the gap is
   * still inserted for perceptual separation. If fullWordUrl is omitted,
   * the sequence ends after the breakdown clip.
   *
   * All state transitions inside this function guard against superseded
   * requests via `requestId`.
   */
  const playBreakdownSequence = useCallback(
    (
      breakdownBuffer: AudioBuffer,
      fullWordBuffer: AudioBuffer | null,
      index: number,
      requestId: number,
      shouldResumeNarration: boolean,
      narrationIntentVersionAtStart: number
    ) => {
      const finalize = () => {
        if (requestId !== activeRequestIdRef.current) return;
        setPronouncingIndex(null);
        setIsLoading(false);
        setPlaybackState("idle");
        if (shouldResumeNarration) {
          maybeResumeNarration("breakdown", narrationIntentVersionAtStart);
        }
      };

      const playStep2 = () => {
        if (requestId !== activeRequestIdRef.current) return;
        if (!fullWordBuffer) {
          finalize();
          return;
        }
        playSingleBuffer(fullWordBuffer, index, requestId, "pronouncing-step2", finalize);
      };

      const afterStep1 = () => {
        if (requestId !== activeRequestIdRef.current) return;
        if (!fullWordBuffer) {
          finalize();
          return;
        }
        // Insert a short perceptual gap before the full-word clip (WR-5.3).
        const gapTimer = window.setTimeout(playStep2, BREAKDOWN_INTER_CLIP_GAP_MS);
        // Store the timer ID so rapid cancellation via stopActivePlayback
        // has a hook to clear it. We attach it to the active source ref indirectly
        // by overwriting the onended to a no-op if the request is superseded.
        // The requestId guard inside playStep2 handles the case where another
        // request arrives during the gap.
        void gapTimer; // the guard inside playStep2 is sufficient
      };

      playSingleBuffer(breakdownBuffer, index, requestId, "pronouncing-step1", afterStep1);
    },
    [maybeResumeNarration, playSingleBuffer]
  );

  // ─── Fallback (API-fetched whole-word) ────────────────────────────────────

  const playViaFallback = useCallback(
    async (
      word: string,
      index: number,
      requestId: number,
      mode: PronunciationPlaybackMode,
      shouldResumeNarration: boolean,
      narrationIntentVersionAtStart: number
    ) => {
      let url = fallbackCache.current.get(word);

      if (!url) {
        try {
          const response = await fetch("/api/pronounce-word", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word }),
          });
          if (!response.ok) throw new Error("API failed");
          const data = await response.json();
          url = data.url;
          if (!url) throw new Error("No URL returned");
          fallbackCache.current.set(word, url);
        } catch {
          // On error: reset state and still attempt narration resume (WR-8.5).
          finalizeRequest(requestId);
          if (shouldResumeNarration) {
            maybeResumeNarration(mode, narrationIntentVersionAtStart);
          }
          return;
        }
      }

      const buffer = await decodeUrl(url);
      if (!buffer) {
        finalizeRequest(requestId);
        if (shouldResumeNarration) {
          maybeResumeNarration(mode, narrationIntentVersionAtStart);
        }
        return;
      }

      bufferCacheRef.current.set(url, buffer);

      const finalize = () => {
        if (requestId !== activeRequestIdRef.current) return;
        setPronouncingIndex(null);
        setIsLoading(false);
        setPlaybackState("idle");
        if (shouldResumeNarration) {
          maybeResumeNarration(mode, narrationIntentVersionAtStart);
        }
      };

      playSingleBuffer(buffer, index, requestId, "pronouncing-quick", finalize);
    },
    [decodeUrl, finalizeRequest, maybeResumeNarration, playSingleBuffer]
  );

  // ─── Public API ───────────────────────────────────────────────────────────

  const pronounceWord = useCallback(
    ({ word, index, mode = "whole-word", onPlaybackStart }: PronunciationRequest) => {
      const normalizedWord = normalizePronunciationToken(word);
      if (!normalizedWord) {
        setPronouncingIndex(null);
        setIsLoading(false);
        setPlaybackState("idle");
        return;
      }

      // Increment request ID: any in-flight operation will see a stale ID
      // and abort itself (cancel-and-replace, WR-5.8).
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;

      // WR-9.4: record interaction timestamp for latency capture.
      requestMetaRef.current = {
        requestId,
        interactionTs: Date.now(),
        onPlaybackStart,
        started: false,
      };

      stopActivePlayback();
      setPronouncingIndex(index);
      setIsLoading(true);
      setPlaybackState("idle"); // Will be updated when audio starts

      // Capture narration state BEFORE pausing (WR-5.1/5.2/5.6).
      const narrationWasPlaying = Boolean(getNarrationPlaybackState?.());
      const shouldResumeNarration = mode === "breakdown" && narrationWasPlaying;
      const narrationIntentVersionAtStart = getNarrationIntentVersion?.() ?? 0;

      if (shouldResumeNarration) {
        pauseNarration?.();
      }

      const entry = wordPronunciations?.[normalizedWord];
      const resolvedUrl = resolvePronunciationUrl(entry, mode);

      // ── Breakdown 2-clip sequence (WR-5.3/4/5) ──────────────────────────
      if (mode === "breakdown" && entry && typeof entry !== "string") {
        const breakdownUrl = entry.breakdown;
        const fullWordUrl = entry.fullWord;

        if (breakdownUrl) {
          // We have a breakdown clip: attempt the full two-step sequence.
          const getOrDecode = (url: string): Promise<AudioBuffer | null> => {
            const cached = bufferCacheRef.current.get(url);
            if (cached) return Promise.resolve(cached);
            return decodeUrl(url).then((buf) => {
              if (buf) bufferCacheRef.current.set(url, buf);
              return buf;
            });
          };

          Promise.all([
            getOrDecode(breakdownUrl),
            fullWordUrl ? getOrDecode(fullWordUrl) : Promise.resolve(null),
          ]).then(([breakdownBuf, fullWordBuf]) => {
            if (requestId !== activeRequestIdRef.current) return;
            if (!breakdownBuf) {
              // Breakdown audio failed to load — fall back to full-word or fallback API.
              if (fullWordBuf) {
                const finalize = () => {
                  if (requestId !== activeRequestIdRef.current) return;
                  setPronouncingIndex(null);
                  setIsLoading(false);
                  setPlaybackState("idle");
                  if (shouldResumeNarration) {
                    maybeResumeNarration("breakdown", narrationIntentVersionAtStart);
                  }
                };
                playSingleBuffer(fullWordBuf, index, requestId, "pronouncing-quick", finalize);
              } else {
                playViaFallback(
                  normalizedWord,
                  index,
                  requestId,
                  mode,
                  shouldResumeNarration,
                  narrationIntentVersionAtStart
                );
              }
              return;
            }
            playBreakdownSequence(
              breakdownBuf,
              fullWordBuf,
              index,
              requestId,
              shouldResumeNarration,
              narrationIntentVersionAtStart
            );
          });
          return;
        }
      }

      // ── Single-clip path (whole-word or breakdown fallback to fullWord) ──
      if (resolvedUrl) {
        const cached = bufferCacheRef.current.get(resolvedUrl);
        const targetState: PlaybackState =
          mode === "breakdown" ? "pronouncing-quick" : "pronouncing-quick";

        const finalize = () => {
          if (requestId !== activeRequestIdRef.current) return;
          setPronouncingIndex(null);
          setIsLoading(false);
          setPlaybackState("idle");
          if (shouldResumeNarration) {
            maybeResumeNarration(mode, narrationIntentVersionAtStart);
          }
        };

        if (cached) {
          playSingleBuffer(cached, index, requestId, targetState, finalize);
          return;
        }

        decodeUrl(resolvedUrl).then((buffer) => {
          if (!buffer) {
            finalizeRequest(requestId);
            if (shouldResumeNarration) {
              maybeResumeNarration(mode, narrationIntentVersionAtStart);
            }
            return;
          }
          bufferCacheRef.current.set(resolvedUrl, buffer);
          playSingleBuffer(buffer, index, requestId, targetState, finalize);
        });
        return;
      }

      // ── API fallback (WR-5.5) ────────────────────────────────────────────
      playViaFallback(
        normalizedWord,
        index,
        requestId,
        mode,
        shouldResumeNarration,
        narrationIntentVersionAtStart
      );
    },
    [
      decodeUrl,
      finalizeRequest,
      getNarrationIntentVersion,
      getNarrationPlaybackState,
      maybeResumeNarration,
      pauseNarration,
      playBreakdownSequence,
      playSingleBuffer,
      playViaFallback,
      stopActivePlayback,
      wordPronunciations,
    ]
  );

  return {
    pronounceWord,
    pronouncingIndex,
    isLoading,
    playbackState,
  };
}

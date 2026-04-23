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
};

interface UseWordPronunciationReturn {
  pronounceWord: (request: PronunciationRequest) => void;
  pronouncingIndex: number | null;
  isLoading: boolean;
}

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

  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackCache = useRef<Map<string, string>>(new Map());
  const activeRequestIdRef = useRef(0);

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

  const stopActivePlayback = useCallback(() => {
    if (activeSourceRef.current) {
      activeSourceRef.current.onended = null;
      try {
        activeSourceRef.current.stop();
      } catch {
        // no-op
      }
      activeSourceRef.current = null;
    }
  }, []);

  const finalizeRequest = useCallback(
    (requestId: number) => {
      if (requestId !== activeRequestIdRef.current) {
        return;
      }
      setPronouncingIndex(null);
      setIsLoading(false);
    },
    []
  );

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
        return;
      }
      if (getNarrationPlaybackState?.()) {
        return;
      }
      resumeNarration();
    },
    [getNarrationIntentVersion, getNarrationPlaybackState, resumeNarration]
  );

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

  useEffect(() => {
    preloadMap(wordPronunciations);
  }, [wordPronunciations, preloadMap]);

  useEffect(() => {
    if (!nextPagePronunciations) return;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => preloadMap(nextPagePronunciations));
      return () => cancelIdleCallback(id);
    }

    const timer = window.setTimeout(() => preloadMap(nextPagePronunciations), 2000);
    return () => window.clearTimeout(timer);
  }, [nextPagePronunciations, preloadMap]);

  useEffect(() => {
    stopActivePlayback();
    setPronouncingIndex(null);
    setIsLoading(false);
  }, [wordPronunciations, stopActivePlayback]);

  useEffect(() => {
    return () => {
      stopActivePlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopActivePlayback]);

  const playBuffer = useCallback(
    (
      buffer: AudioBuffer,
      index: number,
      requestId: number,
      mode: PronunciationPlaybackMode,
      shouldResumeNarration: boolean,
      narrationIntentVersionAtStart: number
    ) => {
      if (requestId !== activeRequestIdRef.current) {
        return;
      }

      const ctx = getAudioContext();
      stopActivePlayback();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      setPronouncingIndex(index);
      setIsLoading(false);

      source.onended = () => {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }
        activeSourceRef.current = null;
        setPronouncingIndex(null);
        setIsLoading(false);
        if (shouldResumeNarration) {
          maybeResumeNarration(mode, narrationIntentVersionAtStart);
        }
      };

      activeSourceRef.current = source;
      source.start(0);
    },
    [getAudioContext, maybeResumeNarration, stopActivePlayback]
  );

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
      playBuffer(
        buffer,
        index,
        requestId,
        mode,
        shouldResumeNarration,
        narrationIntentVersionAtStart
      );
    },
    [decodeUrl, finalizeRequest, maybeResumeNarration, playBuffer]
  );

  const pronounceWord = useCallback(
    ({ word, index, mode = "whole-word" }: PronunciationRequest) => {
      const normalizedWord = normalizePronunciationToken(word);
      if (!normalizedWord) {
        setPronouncingIndex(null);
        setIsLoading(false);
        return;
      }

      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;

      stopActivePlayback();
      setPronouncingIndex(index);
      setIsLoading(true);

      const narrationWasPlaying = Boolean(getNarrationPlaybackState?.());
      const shouldResumeNarration = mode === "breakdown" && narrationWasPlaying;
      const narrationIntentVersionAtStart = getNarrationIntentVersion?.() ?? 0;

      if (shouldResumeNarration) {
        pauseNarration?.();
      }

      const preGeneratedUrl = resolvePronunciationUrl(
        wordPronunciations?.[normalizedWord],
        mode
      );

      if (preGeneratedUrl) {
        const cachedBuffer = bufferCacheRef.current.get(preGeneratedUrl);
        if (cachedBuffer) {
          playBuffer(
            cachedBuffer,
            index,
            requestId,
            mode,
            shouldResumeNarration,
            narrationIntentVersionAtStart
          );
          return;
        }

        decodeUrl(preGeneratedUrl).then((buffer) => {
          if (!buffer) {
            finalizeRequest(requestId);
            if (shouldResumeNarration) {
              maybeResumeNarration(mode, narrationIntentVersionAtStart);
            }
            return;
          }

          bufferCacheRef.current.set(preGeneratedUrl, buffer);
          playBuffer(
            buffer,
            index,
            requestId,
            mode,
            shouldResumeNarration,
            narrationIntentVersionAtStart
          );
        });
        return;
      }

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
      playBuffer,
      playViaFallback,
      stopActivePlayback,
      wordPronunciations,
    ]
  );

  return {
    pronounceWord,
    pronouncingIndex,
    isLoading,
  };
}

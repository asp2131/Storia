"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseWordPronunciationReturn {
  pronounceWord: (word: string, index: number) => void;
  pronouncingIndex: number | null;
  isLoading: boolean;
}

export function useWordPronunciation(options: {
  wordPronunciations: Record<string, string> | null;
  nextPagePronunciations?: Record<string, string> | null;
}): UseWordPronunciationReturn {
  const { wordPronunciations, nextPagePronunciations } = options;

  const [pronouncingIndex, setPronouncingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackCache = useRef<Map<string, string>>(new Map());

  // Initialize AudioContext lazily (needs user gesture on iOS)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Fetch + decode a single URL into an AudioBuffer
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

  // Pre-decode all audio for a pronunciations map into the buffer cache
  const preloadMap = useCallback(
    (map: Record<string, string> | null) => {
      if (!map) return;
      for (const [word, url] of Object.entries(map)) {
        if (bufferCacheRef.current.has(word)) continue;
        // Stagger fetches slightly to avoid overwhelming the browser
        decodeUrl(url).then((buffer) => {
          if (buffer) {
            bufferCacheRef.current.set(word, buffer);
          }
        });
      }
    },
    [decodeUrl]
  );

  // Pre-decode current page pronunciations
  useEffect(() => {
    preloadMap(wordPronunciations);
  }, [wordPronunciations, preloadMap]);

  // Prefetch next page pronunciations during idle time
  useEffect(() => {
    if (!nextPagePronunciations) return;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => preloadMap(nextPagePronunciations));
      return () => cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => preloadMap(nextPagePronunciations), 2000);
      return () => clearTimeout(timer);
    }
  }, [nextPagePronunciations, preloadMap]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const stripPunctuation = useCallback((word: string): string => {
    return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase();
  }, []);

  // Play an AudioBuffer — instant, <5ms latency
  const playBuffer = useCallback(
    (buffer: AudioBuffer, index: number) => {
      const ctx = getAudioContext();

      // Stop any currently playing source
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch { /* already stopped */ }
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      setPronouncingIndex(index);
      source.onended = () => {
        setPronouncingIndex(null);
        activeSourceRef.current = null;
      };

      activeSourceRef.current = source;
      source.start(0);
    },
    [getAudioContext]
  );

  // Fallback: fetch from API, decode, cache, and play
  const playViaFallback = useCallback(
    async (word: string, index: number) => {
      // Check URL cache first
      let url = fallbackCache.current.get(word);

      if (!url) {
        setIsLoading(true);
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
          setIsLoading(false);
          setPronouncingIndex(null);
          return;
        }
        setIsLoading(false);
      }

      // Decode and play
      const buffer = await decodeUrl(url);
      if (buffer) {
        bufferCacheRef.current.set(word, buffer);
        playBuffer(buffer, index);
      }
    },
    [decodeUrl, playBuffer]
  );

  const pronounceWord = useCallback(
    (word: string, index: number) => {
      const strippedWord = stripPunctuation(word);
      if (!strippedWord) return;

      // 1. Check pre-decoded buffer cache (instant)
      const cachedBuffer = bufferCacheRef.current.get(strippedWord);
      if (cachedBuffer) {
        playBuffer(cachedBuffer, index);
        return;
      }

      // 2. Check if URL exists in pronunciations map but not yet decoded
      const preGenUrl = wordPronunciations?.[strippedWord];
      if (preGenUrl) {
        // Decode on demand — still faster than HTMLAudioElement
        decodeUrl(preGenUrl).then((buffer) => {
          if (buffer) {
            bufferCacheRef.current.set(strippedWord, buffer);
            playBuffer(buffer, index);
          }
        });
        return;
      }

      // 3. Fall back to API
      playViaFallback(strippedWord, index);
    },
    [wordPronunciations, stripPunctuation, playBuffer, decodeUrl, playViaFallback]
  );

  return {
    pronounceWord,
    pronouncingIndex,
    isLoading,
  };
}

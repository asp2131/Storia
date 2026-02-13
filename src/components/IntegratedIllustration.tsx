"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { TextOverlayConfig, TextElement } from "@/types/text-overlay";

// ─── Props ──────────────────────────────────────────────────────

interface IntegratedIllustrationProps {
  /** Original base illustration URL. */
  imageUrl: string;
  /** Server-composited image URL (text baked in). */
  compositedImageUrl: string | null;
  /** Overlay config for dynamic fallback rendering. */
  overlay: TextOverlayConfig | null;
  /** Alt text for accessibility. */
  alt: string;
  /** Prefer dynamic overlay rendering over pre-composited image. */
  preferDynamicOverlay?: boolean;
  /** Global word index currently active from narration timestamps. */
  activeWordIndex?: number;
  /** Global word index currently being pronounced from tap action. */
  pronouncingWordIndex?: number | null;
  /** Callback for tap-to-pronounce interactions. */
  onWordTap?: (word: string, index: number) => void;
}

// ─── Image Preload Hook ─────────────────────────────────────────

function usePreloadImage(src: string | null): {
  loaded: boolean;
  error: boolean;
} {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoaded(false);
      setError(false);
      return;
    }

    setLoaded(false);
    setError(false);

    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { loaded, error };
}

// ─── Display Mode ───────────────────────────────────────────────

type DisplayMode = "composited" | "dynamic-overlay" | "image-only" | "fallback";

// ─── Component ──────────────────────────────────────────────────

export default function IntegratedIllustration({
  imageUrl,
  compositedImageUrl,
  overlay,
  alt,
  preferDynamicOverlay = false,
  activeWordIndex,
  pronouncingWordIndex = null,
  onWordTap,
}: IntegratedIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const compositedPreload = usePreloadImage(compositedImageUrl);
  const basePreload = usePreloadImage(imageUrl);

  // Track container height for font size calculations in dynamic overlay mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const displayMode = useMemo<DisplayMode>(() => {
    const hasOverlayElements = overlay && overlay.elements.length > 0;

    // 1. Prefer dynamic overlay when requested and overlay is available.
    if (preferDynamicOverlay && hasOverlayElements && basePreload.loaded) {
      return "dynamic-overlay";
    }

    // 1. Composited image available and loaded successfully
    if (compositedImageUrl && compositedPreload.loaded && !compositedPreload.error) {
      return "composited";
    }

    // 2. Dynamic overlay: overlay config exists with elements, but no composited image
    //    (or composited failed to load)
    if (hasOverlayElements && basePreload.loaded) {
      return "dynamic-overlay";
    }

    // 3. Image only: base image loaded, no overlay data
    if (basePreload.loaded) {
      return "image-only";
    }

    // 4. Fallback: nothing loaded yet (or everything failed)
    return "fallback";
  }, [
    compositedImageUrl,
    compositedPreload.loaded,
    compositedPreload.error,
    overlay,
    basePreload.loaded,
    preferDynamicOverlay,
  ]);

  const wordStartByElement = useMemo(() => {
    if (!overlay?.elements) return new Map<string, number>();

    const starts = new Map<string, number>();
    let runningIndex = 0;

    for (const element of overlay.elements) {
      starts.set(element.id, runningIndex);
      const count = element.text
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0).length;
      runningIndex += count;
    }

    return starts;
  }, [overlay?.elements]);

  // ─── Render: Composited ─────────────────────────────────────

  if (displayMode === "composited") {
    return (
      <div ref={containerRef} className="relative w-full">
        <img
          src={compositedImageUrl!}
          alt={alt}
          aria-label={alt}
          className="w-full h-auto rounded-xl"
          draggable={false}
        />
      </div>
    );
  }

  // ─── Render: Dynamic Overlay ────────────────────────────────

  if (displayMode === "dynamic-overlay") {
    return (
      <div
        ref={containerRef}
        className="relative w-full"
        aria-label={alt}
        role="img"
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-auto rounded-xl"
          draggable={false}
        />
        {overlay!.elements.map((element) => (
          <OverlayTextElement
            key={element.id}
            element={element}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            wordStartIndex={wordStartByElement.get(element.id) ?? 0}
            activeWordIndex={activeWordIndex}
            pronouncingWordIndex={pronouncingWordIndex}
            onWordTap={onWordTap}
          />
        ))}
      </div>
    );
  }

  // ─── Render: Image Only ─────────────────────────────────────

  if (displayMode === "image-only") {
    return (
      <div ref={containerRef} className="relative w-full">
        <img
          src={imageUrl}
          alt={alt}
          aria-label={alt}
          className="w-full h-auto rounded-xl"
          draggable={false}
        />
      </div>
    );
  }

  // ─── Render: Fallback (loading / error) ─────────────────────

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center rounded-xl"
      style={{
        aspectRatio: "4 / 3",
        backgroundColor: "var(--reader-card-bg)",
      }}
      role="img"
      aria-label={alt}
    >
      <span
        className="text-sm"
        style={{ color: "var(--reader-text-secondary)" }}
      >
        {basePreload.error || compositedPreload.error
          ? "Failed to load illustration"
          : "Loading illustration..."}
      </span>
    </div>
  );
}

// ─── Dynamic Overlay Text Element ───────────────────────────────

function OverlayTextElement({
  element,
  containerWidth,
  containerHeight,
  wordStartIndex,
  activeWordIndex,
  pronouncingWordIndex,
  onWordTap,
}: {
  element: TextElement;
  containerWidth: number;
  containerHeight: number;
  wordStartIndex: number;
  activeWordIndex?: number;
  pronouncingWordIndex?: number | null;
  onWordTap?: (word: string, index: number) => void;
}) {
  const fontSize = containerHeight > 0
    ? (element.fontSize / 100) * containerHeight
    : 0;

  const shadowStyle = element.shadow
    ? `${(element.shadow.offsetX / 100) * containerWidth}px ${(element.shadow.offsetY / 100) * containerHeight}px ${(element.shadow.blur / 100) * containerWidth}px ${element.shadow.color}`
    : undefined;

  const backgroundStyle = element.background
    ? {
        backgroundColor: element.background.color,
        padding: `${(element.background.padding / 100) * containerWidth}px`,
        borderRadius: `${(element.background.borderRadius / 100) * containerWidth}px`,
      }
    : {};

  const interactive = typeof onWordTap === "function";

  const tokens = element.text.split(/(\s+)/);
  const wordPositions = tokens.reduce<{ positions: number[]; wordCount: number }>(
    (acc, token) => {
      if (token.trim().length > 0) {
        acc.positions.push(acc.wordCount);
        acc.wordCount += 1;
      } else {
        acc.positions.push(-1);
      }
      return acc;
    },
    { positions: [], wordCount: 0 }
  ).positions;

  return (
    <div
      className={`absolute select-none ${interactive ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        fontSize: `${fontSize}px`,
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        color: element.color,
        textAlign: element.textAlign,
        transform: element.rotation !== 0 ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: "left top",
        textShadow: shadowStyle,
        lineHeight: 1.3,
        ...backgroundStyle,
      }}
      aria-hidden="true"
    >
      {tokens.map((token, tokenIdx) => {
        if (token.trim().length === 0) {
          return <span key={`${element.id}-space-${tokenIdx}`}>{token}</span>;
        }

        const globalIndex = wordStartIndex + wordPositions[tokenIdx];
        const isActive = activeWordIndex === globalIndex;
        const isPronouncing = pronouncingWordIndex === globalIndex;

        if (!interactive) {
          return (
            <span key={`${element.id}-word-${tokenIdx}`}>
              {token}
            </span>
          );
        }

        return (
          <span
            key={`${element.id}-word-${tokenIdx}`}
            data-overlay-word="true"
            className={isPronouncing ? "word-pronouncing" : "word-tappable"}
            style={isActive ? { backgroundColor: "var(--reader-highlight-bg)", borderRadius: "4px" } : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onWordTap(token, globalIndex);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onWordTap(token, globalIndex);
              }
            }}
          >
            {token}
          </span>
        );
      })}
    </div>
  );
}

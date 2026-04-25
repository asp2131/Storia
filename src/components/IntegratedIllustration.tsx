"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { TextOverlayConfig, TextElement } from "@/types/text-overlay";

interface IntegratedIllustrationProps {
  imageUrl: string;
  compositedImageUrl: string | null;
  overlay: TextOverlayConfig | null;
  alt: string;
  preferDynamicOverlay?: boolean;
  activeWordIndex?: number;
  pronouncingWordIndex?: number | null;
  onWordPrimaryAction?: (word: string, index: number) => void;
  onWordSecondaryAction?: (word: string, index: number) => void;
}

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

type DisplayMode = "composited" | "dynamic-overlay" | "image-only" | "fallback";

export default function IntegratedIllustration({
  imageUrl,
  compositedImageUrl,
  overlay,
  alt,
  preferDynamicOverlay = false,
  activeWordIndex,
  pronouncingWordIndex = null,
  onWordPrimaryAction,
  onWordSecondaryAction,
}: IntegratedIllustrationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const compositedPreload = usePreloadImage(compositedImageUrl);
  const basePreload = usePreloadImage(imageUrl);
  const hasInteractiveOverlay =
    typeof onWordPrimaryAction === "function" ||
    typeof onWordSecondaryAction === "function";

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

    if (preferDynamicOverlay && hasOverlayElements && basePreload.loaded) {
      return "dynamic-overlay";
    }

    if (compositedImageUrl && compositedPreload.loaded && !compositedPreload.error) {
      return "composited";
    }

    if (hasOverlayElements && basePreload.loaded) {
      return "dynamic-overlay";
    }

    if (basePreload.loaded) {
      return "image-only";
    }

    return "fallback";
  }, [
    basePreload.loaded,
    compositedImageUrl,
    compositedPreload.error,
    compositedPreload.loaded,
    overlay,
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

  if (displayMode === "dynamic-overlay") {
    return (
      <div ref={containerRef} className="relative w-full">
        {hasInteractiveOverlay ? <span className="sr-only">{alt}</span> : null}
        <img
          src={imageUrl}
          alt={hasInteractiveOverlay ? "" : alt}
          aria-hidden={hasInteractiveOverlay ? true : undefined}
          className="w-full h-auto rounded-xl"
          draggable={false}
        />
        {!hasInteractiveOverlay ? (
          <div className="sr-only">{alt}</div>
        ) : null}
        {overlay!.elements.map((element) => (
          <OverlayTextElement
            key={element.id}
            element={element}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            wordStartIndex={wordStartByElement.get(element.id) ?? 0}
            activeWordIndex={activeWordIndex}
            pronouncingWordIndex={pronouncingWordIndex}
            onWordPrimaryAction={onWordPrimaryAction}
            onWordSecondaryAction={onWordSecondaryAction}
          />
        ))}
      </div>
    );
  }

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

function OverlayTextElement({
  element,
  containerWidth,
  containerHeight,
  wordStartIndex,
  activeWordIndex,
  pronouncingWordIndex,
  onWordPrimaryAction,
  onWordSecondaryAction,
}: {
  element: TextElement;
  containerWidth: number;
  containerHeight: number;
  wordStartIndex: number;
  activeWordIndex?: number;
  pronouncingWordIndex?: number | null;
  onWordPrimaryAction?: (word: string, index: number) => void;
  onWordSecondaryAction?: (word: string, index: number) => void;
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

  const interactive =
    typeof onWordPrimaryAction === "function" ||
    typeof onWordSecondaryAction === "function";
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const LONG_PRESS_MS = 450;

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => clearLongPress, []);

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

  const hintId = `${element.id}-word-hint`;
  const groupLabel = interactive
    ? `Story text: ${element.text}. Tap a word to hear it. Long press, press Shift+Enter, or use the Sound out button to hear a breakdown.`
    : undefined;

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
      role={interactive ? "group" : undefined}
      aria-label={groupLabel}
      aria-hidden={interactive ? undefined : true}
    >
      {interactive ? (
        <span id={hintId} className="sr-only">
          Press Enter or Space to hear the word. Press Shift+Enter, long press,
          or use the Sound out button to hear it broken down.
        </span>
      ) : null}
      {tokens.map((token, tokenIdx) => {
        if (token.trim().length === 0) {
          return <span key={`${element.id}-space-${tokenIdx}`}>{token}</span>;
        }

        const globalIndex = wordStartIndex + wordPositions[tokenIdx];
        const isActive = activeWordIndex === globalIndex;
        const isPronouncing = pronouncingWordIndex === globalIndex;
        const sharedWordStyle = {
          backgroundColor: isActive || isPronouncing ? "var(--reader-highlight-bg)" : undefined,
          borderRadius: "4px",
          textDecoration: isActive || isPronouncing ? "underline" : undefined,
          textUnderlineOffset: isActive || isPronouncing ? "0.18em" : undefined,
        };

        if (!interactive) {
          return (
            <span key={`${element.id}-word-${tokenIdx}`} style={sharedWordStyle}>
              {token}
            </span>
          );
        }

        const supportsSecondary = typeof onWordSecondaryAction === "function";

        return (
          <span
            key={`${element.id}-word-${tokenIdx}`}
            data-overlay-word="true"
            className="group/word relative inline-flex items-center align-baseline"
          >
            <button
              type="button"
              className={isPronouncing ? "word-pronouncing" : "word-tappable"}
              style={{
                ...sharedWordStyle,
                // WG-2: guard against native text selection and OS callouts
                // hijacking the long-press gesture across mouse/touch/stylus.
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "manipulation",
              }}
              aria-label={`Hear ${token}`}
              aria-describedby={hintId}
              aria-keyshortcuts={supportsSecondary ? "Shift+Enter" : undefined}
              onKeyDown={(event) => {
                if (
                  supportsSecondary &&
                  event.shiftKey &&
                  (event.key === "Enter" || event.key === " " || event.key === "Spacebar")
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  onWordSecondaryAction?.(token, globalIndex);
                }
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                longPressTriggeredRef.current = false;
                clearLongPress();
                if (!onWordSecondaryAction) {
                  return;
                }
                longPressTimerRef.current = window.setTimeout(() => {
                  longPressTriggeredRef.current = true;
                  onWordSecondaryAction(token, globalIndex);
                }, LONG_PRESS_MS);
              }}
              onPointerUp={() => {
                clearLongPress();
              }}
              onPointerLeave={() => {
                clearLongPress();
              }}
              onPointerCancel={() => {
                clearLongPress();
              }}
              onContextMenu={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                event.stopPropagation();
                clearLongPress();
                if (longPressTriggeredRef.current) {
                  longPressTriggeredRef.current = false;
                  event.preventDefault();
                  return;
                }
                onWordPrimaryAction?.(token, globalIndex);
              }}
            >
              {token}
            </button>
            {onWordSecondaryAction ? (
              <button
                type="button"
                className="sr-only rounded-full border border-white/20 bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-lg focus:not-sr-only focus:absolute focus:left-1/2 focus:top-full focus:z-10 focus:mt-1 focus:-translate-x-1/2"
                aria-label={`Sound out word ${token}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onWordSecondaryAction(token, globalIndex);
                }}
              >
                Sound out
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

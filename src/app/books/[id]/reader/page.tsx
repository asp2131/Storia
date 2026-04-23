"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ReactLenis, type LenisRef } from "lenis/react";
import FeedbackModal from "@/components/FeedbackModal";
import LoginPrompt from "@/components/LoginPrompt";
import ReaderAudioControls from "@/components/reader/ReaderAudioControls";
import ReaderAudioElements from "@/components/reader/ReaderAudioElements";
import ReaderErrorState from "@/components/reader/ReaderErrorState";
import ReaderHeader from "@/components/reader/ReaderHeader";
import ReaderLoadingState from "@/components/reader/ReaderLoadingState";
import ReaderOutro from "@/components/reader/ReaderOutro";
import ReaderProgressToast from "@/components/reader/ReaderProgressToast";
import ReaderScrollHint from "@/components/reader/ReaderScrollHint";
import ReaderSettingsPanel from "@/components/reader/ReaderSettingsPanel";
import ReaderStage from "@/components/reader/ReaderStage";
import {
  useWordPronunciation,
  type PronunciationPlaybackMode,
} from "@/hooks/useWordPronunciation";
import {
  emitPronunciationEvent,
  type PronunciationPlaybackPath,
} from "@/lib/pronunciationAnalytics";
import {
  normalizePronunciationToken,
  type WordPronunciationEntry,
} from "@/lib/pronunciation";
import { usePronunciationManifest } from "@/hooks/usePronunciationManifest";
import {
  useLocalPreferences,
  type PronunciationMode,
  SoundscapeMode,
} from "@/hooks/useLocalPreferences";
import { useAudioCrossFade } from "@/hooks/useAudioCrossFade";
import { useReaderData, WordTimestamp } from "@/hooks/useBookData";
import {
  useReadingProgress,
  useAutoSaveProgressWithAuth,
  loadProgressFromLocalStorage,
} from "@/hooks/useReadingProgress";
import { useSession } from "@/lib/auth-client";
import { computeActiveWordIndexMobileCompat } from "@/lib/mobile-compat/word-sync";

gsap.registerPlugin(ScrollTrigger);

// ─── Main Reader ─────────────────────────────────────────────────

export default function BookReader() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // ─── Auth ──────────────────────────────────────────────────────
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // ─── Data ──────────────────────────────────────────────────────
  const {
    data: readerData,
    isLoading: loading,
    error: queryError,
  } = useReaderData(bookId);
  const error = queryError?.message || null;

  const pages = useMemo(
    () =>
      [...(readerData?.pages ?? [])].sort(
        (a, b) => a.pageNumber - b.pageNumber
      ),
    [readerData?.pages]
  );
  const totalPages = pages.length;

  // ─── Progress ──────────────────────────────────────────────────
  const { data: savedProgress, isLoading: progressLoading } =
    useReadingProgress(bookId);
  const progressRestoredRef = useRef(false);

  // ─── Refs ──────────────────────────────────────────────────────
  const lenisRef = useRef<LenisRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<(HTMLDivElement | null)[]>([]);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const pageCounterRef = useRef<HTMLSpanElement>(null);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const prevActiveIndexRef = useRef(0);
  const lastSnapProgressRef = useRef(0);
  const isNarrationPlayingRef = useRef(false);
  const narrationIntentVersionRef = useRef(0);
  const pageLoadTimeRef = useRef<number>(0);
  const scrollActiveIndexRef = useRef(0);

  // ─── UI state ──────────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressToast, setProgressToast] = useState<string | null>(null);

  // Derived current page (1-based)
  const currentPage = pages[activeIndex]?.pageNumber ?? 1;
  const pageData = pages[activeIndex] ?? null;

  // ─── Audio state ───────────────────────────────────────────────
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(false);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  // ─── Feedback & login ─────────────────────────────────────────
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackEligible, setFeedbackEligible] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set<number>());
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  // ─── Settings ──────────────────────────────────────────────────
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const pronunciationFeatureEnabled =
    process.env.NEXT_PUBLIC_READER_PRONUNCIATION_ENABLED !== "false";

  // ─── Preferences & audio cross-fade ────────────────────────────
  const { preferences, setSoundscapeMode, setPronunciationMode } =
    useLocalPreferences();
  const { initAudioContext, connectAudioElement, fadeIn, fadeOut } =
    useAudioCrossFade();
  const audioConnectedRef = useRef(false);

  // ─── Derived audio data ────────────────────────────────────────
  const narrationAssignment = pageData?.assignments?.find(
    (a) => a.audioType === "narration"
  );
  const soundscapeAssignment = pageData?.assignments?.find(
    (a) => a.audioType === "soundscape"
  );
  const soundscapeUrl = soundscapeAssignment?.audioUrl;

  const overlayWordStartByElement = useMemo(() => {
    const starts = new Map<string, number>();
    const elements = pageData?.overlay?.elements || [];
    let runningIndex = 0;

    for (const element of elements) {
      starts.set(element.id, runningIndex);
      const count = element.text
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0).length;
      runningIndex += count;
    }

    return starts;
  }, [pageData?.overlay?.elements]);

  const narrationTracks = useMemo(() => {
    const overlayTracks = (pageData?.overlayNarrations || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((t) => !!t.audioUrl);

    if (overlayTracks.length > 0) {
      return overlayTracks.map((track, idx) => ({
        url: track.audioUrl,
        wordTimestamps: (track.wordTimestamps as WordTimestamp[] | null) || [],
        wordStartIndex:
          overlayWordStartByElement.get(track.overlayElementId) ??
          overlayTracks
            .slice(0, idx)
            .reduce(
              (sum, prev) =>
                sum + (((prev.wordTimestamps as WordTimestamp[] | null) || []).length),
              0
            ),
      }));
    }

    const singleUrl = narrationAssignment?.audioUrl || pageData?.narrationUrl;
    if (!singleUrl) return [];

    return [
      {
        url: singleUrl,
        wordTimestamps:
          (pageData?.narrationTimestamps as WordTimestamp[] | null) || [],
        wordStartIndex: 0,
      },
    ];
  }, [
    narrationAssignment?.audioUrl,
    overlayWordStartByElement,
    pageData?.narrationUrl,
    pageData?.narrationTimestamps,
    pageData?.overlayNarrations,
  ]);

  const [narrationTrackIndex, setNarrationTrackIndex] = useState(0);
  const narrationUrl = narrationTracks[narrationTrackIndex]?.url;

  const wordTimestamps = useMemo(
    () => narrationTracks[narrationTrackIndex]?.wordTimestamps || [],
    [narrationTracks, narrationTrackIndex]
  );

  const nextPageData = pages[activeIndex + 1] ?? null;

  // WR-4: Book-level pronunciation manifest. Used when present; falls back to
  // page-level wordPronunciations when absent or on fetch failure (WR-8.2).
  const manifestResult = usePronunciationManifest({
    bookId,
    hasPronunciations: readerData?.book?.hasPronunciations,
    pronunciationManifestUrl: readerData?.book?.pronunciationManifestUrl,
  });

  const manifestEntries: Record<string, WordPronunciationEntry> | null = useMemo(() => {
    if (manifestResult.status !== "present") return null;
    return manifestResult.entries;
  }, [manifestResult]);

  const currentPagePronunciations =
    manifestEntries ?? pageData?.wordPronunciations ?? null;
  const nextPagePronunciationsSource =
    manifestEntries ?? nextPageData?.wordPronunciations ?? null;

  const { pronounceWord, pronouncingIndex } = useWordPronunciation({
    wordPronunciations: currentPagePronunciations,
    nextPagePronunciations: nextPagePronunciationsSource,
    getNarrationPlaybackState: () => isNarrationPlayingRef.current,
    pauseNarration: () => {
      narrationRef.current?.pause();
      setIsNarrationPlaying(false);
    },
    resumeNarration: () => {
      if (!narrationRef.current || !narrationUrl) return;
      narrationRef.current.play().catch(() => {});
      setIsNarrationPlaying(true);
    },
    getNarrationIntentVersion: () => narrationIntentVersionRef.current,
  });

  const resolvePrimaryPronunciationMode = useCallback((): PronunciationPlaybackMode => {
    if (!pronunciationFeatureEnabled) {
      return "whole-word";
    }

    return preferences.pronunciationMode === "tap-breakdown"
      ? "breakdown"
      : "whole-word";
  }, [preferences.pronunciationMode, pronunciationFeatureEnabled]);

  const handleWordPrimaryAction = useCallback(
    (word: string, index: number) => {
      const mode = resolvePrimaryPronunciationMode();
      const normalizedWord = normalizePronunciationToken(word);
      const entry = currentPagePronunciations?.[normalizedWord];
      let playbackPath: PronunciationPlaybackPath;
      if (manifestResult.status === "error") {
        playbackPath = "manifest-load-failure";
      } else if (!entry) {
        playbackPath = "no-data-fallback";
      } else if (mode === "breakdown") {
        const hasBreakdown =
          typeof entry !== "string" && entry.breakdown;
        playbackPath = hasBreakdown
          ? "manifest-breakdown"
          : "manifest-fullword-fallback";
      } else {
        playbackPath = manifestEntries
          ? "manifest-fullword"
          : "legacy-page-fullword";
      }

      pronounceWord({
        word,
        index,
        mode,
        trigger: "click",
        onPlaybackStart: ({ latencyMs }) => {
          emitPronunciationEvent({
            bookId,
            pageId: pageData?.id,
            page: currentPage,
            word,
            normalizedWord,
            mode,
            trigger: "click",
            playbackPath,
            latencyMs,
            outcome: "played",
            featureEnabled: pronunciationFeatureEnabled,
          });
        },
      });
    },
    [bookId, currentPage, pageData, pronounceWord, resolvePrimaryPronunciationMode, pronunciationFeatureEnabled, currentPagePronunciations, manifestResult.status, manifestEntries]
  );

  const handleWordSecondaryAction = useCallback(
    (word: string, index: number) => {
      if (!pronunciationFeatureEnabled) {
        handleWordPrimaryAction(word, index);
        return;
      }

      const normalizedWord = normalizePronunciationToken(word);
      const entry = currentPagePronunciations?.[normalizedWord];
      let playbackPath: PronunciationPlaybackPath;
      if (manifestResult.status === "error") {
        playbackPath = "manifest-load-failure";
      } else if (!entry) {
        playbackPath = "no-data-fallback";
      } else {
        const hasBreakdown =
          typeof entry !== "string" && entry.breakdown;
        playbackPath = hasBreakdown
          ? "manifest-breakdown"
          : "manifest-fullword-fallback";
      }

      pronounceWord({
        word,
        index,
        mode: "breakdown",
        trigger: "alternate-control",
        onPlaybackStart: ({ latencyMs }) => {
          emitPronunciationEvent({
            bookId,
            pageId: pageData?.id,
            page: currentPage,
            word,
            normalizedWord,
            mode: "breakdown",
            trigger: "alternate-control",
            playbackPath,
            latencyMs,
            outcome: "played",
            featureEnabled: pronunciationFeatureEnabled,
          });
        },
      });
    },
    [
      bookId,
      currentPage,
      handleWordPrimaryAction,
      pageData,
      pronounceWord,
      pronunciationFeatureEnabled,
      currentPagePronunciations,
      manifestResult.status,
    ]
  );

  // ─── Umami analytics refs ──────────────────────────────────────
  const pageEnteredAtRef = useRef<number>(Date.now());
  const hasTrackedOpenRef = useRef(false);

  // Keep the ref in sync with state (for use inside GSAP callbacks)
  useEffect(() => {
    isNarrationPlayingRef.current = isNarrationPlaying;
  }, [isNarrationPlaying]);

  useEffect(() => {
    narrationIntentVersionRef.current += 1;
    setNarrationTrackIndex(0);
    setNarrationProgress(0);
    setActiveWordIndex(-1);
  }, [activeIndex, narrationTracks.length]);

  useEffect(() => {
    scrollActiveIndexRef.current = activeIndex;
  }, [activeIndex]);

  // ═══════════════════════════════════════════════════════════════
  // OVERSCROLL FIX & SCROLL RESTORATION
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const htmlEl = document.documentElement;
    htmlEl.style.overscrollBehavior = "none";

    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    return () => {
      htmlEl.style.overscrollBehavior = "";
      history.scrollRestoration = prev;
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // LENIS ↔ GSAP TICKER SYNC
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    let rafId = 0;
    let tickerFn: ((time: number) => void) | null = null;
    let scrollFn: (() => void) | null = null;
    let lenis: LenisRef["lenis"];

    const setup = () => {
      lenis = lenisRef.current?.lenis;
      if (!lenis) {
        // Lenis may not be hydrated yet — retry next frame
        rafId = requestAnimationFrame(setup);
        return;
      }

      // Keep ScrollTrigger in sync with Lenis scroll events
      scrollFn = () => ScrollTrigger.update();
      lenis.on("scroll", scrollFn);

      // Drive Lenis from GSAP's unified ticker (eliminates double-rAF)
      tickerFn = (time: number) => {
        lenis?.raf(time * 1000);
      };
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);
    };

    setup();

    return () => {
      cancelAnimationFrame(rafId);
      if (tickerFn) gsap.ticker.remove(tickerFn);
      if (lenis && scrollFn) lenis.off("scroll", scrollFn);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // GSAP SCROLL CHOREOGRAPHY
  // ═══════════════════════════════════════════════════════════════

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container || pages.length < 2) return;

      pagesRef.current = pagesRef.current.slice(0, pages.length);
      const transitionDefaults = { duration: 1, ease: "none" as const };

      const addPageTransition = (
        timeline: gsap.core.Timeline,
        pageEl: HTMLDivElement,
        prevEl: HTMLDivElement | null,
        position: number
      ) => {
        const segment = gsap.timeline();

        segment.fromTo(
          pageEl,
          { clipPath: "inset(0% 0% 0% 0%)", xPercent: 100, opacity: 0 },
          { xPercent: 0, opacity: 1, ...transitionDefaults },
          0
        );

        if (prevEl) {
          segment.to(
            prevEl,
            { xPercent: -30, opacity: 0, ...transitionDefaults },
            0
          );
        }

        const illustration = pageEl.querySelector("[data-illustration]");
        if (illustration) {
          segment.fromTo(
            illustration,
            { scale: 1.12 },
            { scale: 1, ...transitionDefaults },
            0
          );
        }

        timeline.add(segment, position);
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: () => `+=${(pages.length - 1) * window.innerHeight}`,
          pin: true,
          scrub: true, // instant — Lenis lerp handles all smoothing
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: {
            // Custom snap: require ≥18% scroll into the next page before
            // committing. Below that threshold, rubber-band back to current page.
            // This prevents accidental micro-scrolls from flipping pages.
            snapTo: (progress: number) => {
              const step = 1 / (pages.length - 1);
              const anchor = lastSnapProgressRef.current;
              const delta = progress - anchor;
              const threshold = step * 0.18;

              let target: number;
              if (Math.abs(delta) < threshold) {
                target = anchor; // dead-zone → stay
              } else {
                target =
                  delta > 0
                    ? Math.min(anchor + step, 1)
                    : Math.max(anchor - step, 0);
              }
              // Round to nearest step to avoid float drift
              target = Math.round(target / step) * step;
              lastSnapProgressRef.current = target;
              return target;
            },
            duration: { min: 0.25, max: 0.6 },
            delay: 0.12,
            ease: "power2.inOut",
          },
          onUpdate: (self) => {
            // Direct DOM update for silky progress bar (no React re-render)
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${self.progress * 100}%`;
            }

            const idx = Math.round(self.progress * (pages.length - 1));

            // Counter + React state update only when index actually changes.
            // This avoids avoidable work on every scroll tick.
            if (idx === scrollActiveIndexRef.current) return;
            scrollActiveIndexRef.current = idx;

            if (pageCounterRef.current) {
              const pNum = pages[idx]?.pageNumber ?? idx + 1;
              pageCounterRef.current.textContent = `${pNum}/${pages.length}`;
            }

            setActiveIndex(idx);
          },
          onRefresh: (self) => {
            const steps = pages.length - 1;
            if (steps <= 0) return;
            const step = 1 / steps;
            const snapped = Math.round(self.progress / step) * step;
            lastSnapProgressRef.current = gsap.utils.clamp(0, 1, snapped);
          },
        },
      });

      scrollTriggerRef.current = tl.scrollTrigger!;

      // ── Choreograph each page transition as independent segments ───────────
      pages.forEach((_, i) => {
        if (i === 0) return;

        const pageEl = pagesRef.current[i];
        const prevEl = pagesRef.current[i - 1];
        if (!pageEl) return;

        addPageTransition(tl, pageEl, prevEl, i - 1);
      });

      return () => {
        scrollTriggerRef.current = null;
      };
    },
    { scope: containerRef, dependencies: [pages] }
  );

  // ═══════════════════════════════════════════════════════════════
  // LAYER 3: WORD STAGGER ANIMATION ON PAGE CHANGE
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeIndex === prevActiveIndexRef.current) return;
    prevActiveIndexRef.current = activeIndex;

    let tween: gsap.core.Tween | null = null;

    // Slight delay for the clip-path transition to settle
    const timer = setTimeout(() => {
      const pageEl = pagesRef.current[activeIndex];
      if (!pageEl) return;

      const words = pageEl.querySelectorAll("[data-overlay-word]");
      if (words.length === 0) return;

      tween = gsap.fromTo(
        words,
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.04,
          duration: 0.35,
          ease: "power2.out",
        }
      );
    }, 180);

    return () => {
      clearTimeout(timer);
      if (tween) tween.kill();
    };
  }, [activeIndex]);

  // ═══════════════════════════════════════════════════════════════
  // KEYBOARD NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  const scrollToPage = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= pages.length) return;
      const st = scrollTriggerRef.current;
      if (!st) return;

      const targetProgress =
        pages.length > 1 ? targetIndex / (pages.length - 1) : 0;

      // Keep the snap anchor in sync so the dead-zone logic
      // doesn't fight the programmatic scroll on the next snap event.
      lastSnapProgressRef.current = targetProgress;

      const targetScroll =
        st.start + targetProgress * (st.end - st.start);
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    },
    [pages.length]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showSettingsPanel || showFeedbackModal) return;
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowRight" ||
        e.key === " "
      ) {
        e.preventDefault();
        scrollToPage(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToPage(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, scrollToPage, showSettingsPanel, showFeedbackModal]);

  // ═══════════════════════════════════════════════════════════════
  // PROGRESS RESTORATION
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (
      progressRestoredRef.current ||
      loading ||
      progressLoading ||
      pages.length < 2
    )
      return;

    let restoredPage: number | null = null;
    if (
      isAuthenticated &&
      savedProgress?.currentPage &&
      savedProgress.currentPage > 1
    ) {
      restoredPage = savedProgress.currentPage;
    } else if (!isAuthenticated) {
      const lp = loadProgressFromLocalStorage(bookId);
      if (lp?.currentPage && lp.currentPage > 1) restoredPage = lp.currentPage;
    }

    if (restoredPage && restoredPage <= totalPages) {
      const pageIndex = pages.findIndex(
        (p) => p.pageNumber === restoredPage
      );
      if (pageIndex > 0) {
        // Wait for GSAP ScrollTrigger to be ready
        const waitForST = () => {
          const st = scrollTriggerRef.current;
          if (!st) {
            requestAnimationFrame(waitForST);
            return;
          }
          const targetProgress = pageIndex / (pages.length - 1);
          // Sync snap anchor BEFORE scrolling so the dead-zone
          // treats the restored page as "home" on the first interaction.
          lastSnapProgressRef.current = targetProgress;
          const targetScroll =
            st.start + targetProgress * (st.end - st.start);
          window.scrollTo(0, targetScroll);
          setActiveIndex(pageIndex);
          progressRestoredRef.current = true;
          setProgressToast(`Continuing from page ${restoredPage}`);
          setTimeout(() => setProgressToast(null), 3000);
        };
        requestAnimationFrame(waitForST);
      } else {
        progressRestoredRef.current = true;
      }
    } else {
      progressRestoredRef.current = true;
    }
  }, [
    bookId,
    savedProgress,
    isAuthenticated,
    loading,
    progressLoading,
    totalPages,
    pages,
  ]);

  useAutoSaveProgressWithAuth({
    bookId,
    currentPage,
    totalPages,
    enabled: !loading && totalPages > 0,
  });

  // ═══════════════════════════════════════════════════════════════
  // WORD TIMESTAMP HIGHLIGHTING
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isNarrationPlaying || wordTimestamps.length === 0) {
      if (!isNarrationPlaying) setActiveWordIndex(-1);
      return;
    }
    const found = computeActiveWordIndexMobileCompat(wordTimestamps, narrationProgress);

    if (found === -1) {
      setActiveWordIndex(-1);
      return;
    }

    const trackStart = narrationTracks[narrationTrackIndex]?.wordStartIndex || 0;
    setActiveWordIndex(trackStart + found);
  }, [
    narrationProgress,
    wordTimestamps,
    isNarrationPlaying,
    narrationTracks,
    narrationTrackIndex,
  ]);

  // ═══════════════════════════════════════════════════════════════
  // FEEDBACK ELIGIBILITY
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const check = async () => {
      const skipped =
        sessionStorage.getItem("feedback_skipped") === "true";
      if (skipped) {
        setFeedbackEligible(false);
        return;
      }
      try {
        const res = await fetch("/api/feedback/status");
        if (res.ok) {
          const d = await res.json();
          setFeedbackEligible(d.shouldShowFeedback);
        }
      } catch {
        setFeedbackEligible(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    pageLoadTimeRef.current = Date.now();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // UMAMI ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  // Track book-open (once per reader session)
  useEffect(() => {
    if (hasTrackedOpenRef.current || loading || !readerData) return;
    hasTrackedOpenRef.current = true;
    window.umami?.track("book-open", {
      bookId,
      title: readerData.book.title,
    });
  }, [loading, readerData, bookId]);

  // Track page turns + reading time per page
  useEffect(() => {
    if (loading || !readerData) return;
    const now = Date.now();
    const secondsOnPrev = Math.round((now - pageEnteredAtRef.current) / 1000);

    // Send reading time for the previous page (skip if < 1s — likely initial mount)
    if (secondsOnPrev >= 1) {
      window.umami?.track("reading-time", {
        bookId,
        page: pages[prevActiveIndexRef.current]?.pageNumber ?? 0,
        seconds: secondsOnPrev,
      });
    }

    pageEnteredAtRef.current = now;

    window.umami?.track("page-view", {
      bookId,
      page: pages[activeIndex]?.pageNumber ?? 0,
    });

    // Track book completion when reaching the last page
    if (activeIndex === pages.length - 1 && pages.length > 1) {
      window.umami?.track("book-complete", {
        bookId,
        title: readerData.book.title,
        totalPages: pages.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Flush reading time on exit (tab close / navigate away)
  useEffect(() => {
    const flush = () => {
      const seconds = Math.round(
        (Date.now() - pageEnteredAtRef.current) / 1000
      );
      if (seconds >= 1) {
        window.umami?.track("reading-time", {
          bookId,
          page: currentPage,
          seconds,
        });
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, [bookId, currentPage]);

  // Track pages viewed
  useEffect(() => {
    if (currentPage > 0)
      setPagesViewed((prev) => new Set(prev).add(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (currentPage > 1) setHasNavigated(true);
  }, [currentPage]);

  // Login prompt timer
  useEffect(() => {
    if (isAuthenticated || !loading) return;
    const timer = setTimeout(() => {
      if (Date.now() - pageLoadTimeRef.current >= 30000 && hasNavigated)
        setShowLoginPrompt(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, loading, hasNavigated]);

  useEffect(() => {
    if (
      !isAuthenticated &&
      !loading &&
      currentPage > 1 &&
      !progressRestoredRef.current
    )
      setShowLoginPrompt(true);
  }, [isAuthenticated, loading, currentPage]);

  // ═══════════════════════════════════════════════════════════════
  // AUDIO
  // ═══════════════════════════════════════════════════════════════

  const toggleNarration = useCallback(() => {
    if (!narrationRef.current || !narrationUrl) return;

    narrationIntentVersionRef.current += 1;

    if (isNarrationPlaying) {
      narrationRef.current.pause();
      setIsNarrationPlaying(false);
      return;
    }

    const isAtEnd =
      narrationRef.current.duration > 0 &&
      narrationRef.current.currentTime >= narrationRef.current.duration - 0.05;

    if (isAtEnd && narrationTrackIndex === narrationTracks.length - 1) {
      setNarrationTrackIndex(0);
      setNarrationProgress(0);
      setActiveWordIndex(-1);
    }

    narrationRef.current.play();
    window.umami?.track("audio-play", { bookId, type: "narration", page: currentPage });
    setIsNarrationPlaying(true);
  }, [
    isNarrationPlaying,
    narrationUrl,
    narrationTrackIndex,
    narrationTracks.length,
    bookId,
    currentPage,
  ]);

  const toggleSoundscape = useCallback(() => {
    if (!soundscapeRef.current || !soundscapeUrl) return;
    if (!audioConnectedRef.current) {
      initAudioContext();
      const g = connectAudioElement(soundscapeRef.current);
      if (g) audioConnectedRef.current = true;
    }
    if (isSoundscapePlaying) {
      if (audioConnectedRef.current) {
        fadeOut(0.5);
        setTimeout(() => soundscapeRef.current?.pause(), 500);
      } else {
        soundscapeRef.current.pause();
      }
    } else {
      soundscapeRef.current.play();
      if (audioConnectedRef.current) fadeIn(0.5, soundscapeVolume);
      window.umami?.track("audio-play", { bookId, type: "soundscape", page: currentPage });
    }
    setIsSoundscapePlaying(!isSoundscapePlaying);
  }, [
    isSoundscapePlaying,
    soundscapeUrl,
    soundscapeVolume,
    bookId,
    currentPage,
    initAudioContext,
    connectAudioElement,
    fadeIn,
    fadeOut,
  ]);

  const handleSoundscapeModeChange = (mode: SoundscapeMode) => {
    setSoundscapeMode(mode);
  };

  const handlePronunciationModeChange = (mode: PronunciationMode) => {
    setPronunciationMode(mode);
  };

  // Narration source change — debounced play to avoid stutter during fast scroll
  useEffect(() => {
    const audio = narrationRef.current;
    if (!audio) return;

    if (!narrationUrl) {
      audio.pause();
      setActiveWordIndex(-1);
      return;
    }

    audio.src = narrationUrl;
    audio.currentTime = 0;
    setActiveWordIndex(-1);

    if (isNarrationPlayingRef.current) {
      const t = setTimeout(() => audio.play().catch(() => {}), 250);
      return () => clearTimeout(t);
    }
  }, [narrationUrl]);

  // Soundscape source change
  useEffect(() => {
    if (soundscapeRef.current && soundscapeUrl) {
      const prevSrc = soundscapeRef.current.src;
      const isNew = prevSrc && !prevSrc.includes(soundscapeUrl);
      if (isNew && isSoundscapePlaying && audioConnectedRef.current) {
        fadeOut(1.0);
        setTimeout(() => {
          if (soundscapeRef.current) {
            soundscapeRef.current.src = soundscapeUrl;
            soundscapeRef.current.play();
            fadeIn(1.0, soundscapeVolume);
          }
        }, 1000);
      } else {
        soundscapeRef.current.src = soundscapeUrl;
        if (isSoundscapePlaying) soundscapeRef.current.play();
      }
    }
  }, [fadeIn, fadeOut, isSoundscapePlaying, soundscapeUrl, soundscapeVolume]);

  // Loop attribute
  useEffect(() => {
    if (soundscapeRef.current) {
      soundscapeRef.current.loop =
        preferences.soundscapeMode === "continuous";
    }
  }, [preferences.soundscapeMode]);

  // Volume
  useEffect(() => {
    if (narrationRef.current) narrationRef.current.volume = narrationVolume;
  }, [narrationVolume]);
  useEffect(() => {
    if (soundscapeRef.current)
      soundscapeRef.current.volume = soundscapeVolume;
  }, [soundscapeVolume]);

  // ═══════════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════════

  const handleExitAttempt = useCallback(
    (navFn: () => void) => {
      const enough = pagesViewed.size >= 2;
      const skipped =
        sessionStorage.getItem("feedback_skipped") === "true";
      if (feedbackEligible && enough && !skipped) {
        setPendingNavigation(() => navFn);
        setShowFeedbackModal(true);
      } else {
        navFn();
      }
    },
    [feedbackEligible, pagesViewed]
  );

  const handleFeedbackSubmit = async (
    rating: number,
    feedback?: string
  ) => {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, feedback }),
    });
    if (!res.ok) throw new Error("Failed to submit feedback");
    setFeedbackEligible(false);
  };

  const handleFeedbackSkip = useCallback(() => {
    sessionStorage.setItem("feedback_skipped", "true");
    setShowFeedbackModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (loading) {
    return <ReaderLoadingState />;
  }

  if (error || !readerData) {
    return (
      <ReaderErrorState
        error={error || "Book not found"}
        onGoBack={() => handleExitAttempt(() => router.back())}
      />
    );
  }

  return (
    <>
      {/* Lenis smooth-scroll on the root scroller — RAF driven by GSAP ticker */}
      <ReactLenis
        root
        ref={lenisRef}
        options={{
          autoRaf: false,
          smoothWheel: true,
          lerp: 0.08,
          wheelMultiplier: 1,
          touchMultiplier: 1.5,
        }}
      />

      <div
        className="select-none"
        style={{
          backgroundColor: "var(--reader-bg)",
          color: "var(--reader-text)",
        }}
      >
        <ReaderAudioElements
          narrationRef={narrationRef}
          soundscapeRef={soundscapeRef}
          soundscapeMode={preferences.soundscapeMode}
          onNarrationTimeUpdate={setNarrationProgress}
          onNarrationEnded={() => {
            const hasNextTrack = narrationTrackIndex < narrationTracks.length - 1;
            if (hasNextTrack) {
              setNarrationTrackIndex((prev) => prev + 1);
              setNarrationProgress(0);
              setActiveWordIndex(-1);
              return;
            }
            setIsNarrationPlaying(false);
            setActiveWordIndex(-1);
          }}
          onSoundscapeEnded={() => setIsSoundscapePlaying(false)}
        />

        <ReaderHeader
          progressBarRef={progressBarRef}
          pageCounterRef={pageCounterRef}
          currentPage={currentPage}
          totalPages={totalPages}
          onClose={() => handleExitAttempt(() => router.back())}
          onOpenSettings={() => setShowSettingsPanel(true)}
        />

        <ReaderAudioControls
          narrationUrl={narrationUrl}
          soundscapeUrl={soundscapeUrl}
          isNarrationPlaying={isNarrationPlaying}
          isSoundscapePlaying={isSoundscapePlaying}
          soundscapeMode={preferences.soundscapeMode}
          onToggleNarration={toggleNarration}
          onToggleSoundscape={toggleSoundscape}
          onChangeSoundscapeMode={handleSoundscapeModeChange}
        />

        <ReaderStage
          containerRef={containerRef}
          pages={pages}
          activeIndex={activeIndex}
          activeWordIndex={activeWordIndex}
          pronouncingIndex={pronouncingIndex}
          onWordPrimaryAction={handleWordPrimaryAction}
          onWordSecondaryAction={handleWordSecondaryAction}
          setPageRef={(index, el) => {
            pagesRef.current[index] = el;
          }}
        />

        <ReaderScrollHint totalPages={totalPages} activeIndex={activeIndex} />

        <ReaderOutro
          title={readerData.book.title}
          onFeedback={() => setShowFeedbackModal(true)}
          onBackToLibrary={() => handleExitAttempt(() => router.back())}
          onReadAgain={() => scrollToPage(0)}
        />

        <ReaderProgressToast message={progressToast} />

        <ReaderSettingsPanel
          open={showSettingsPanel}
          narrationUrl={narrationUrl}
          soundscapeUrl={soundscapeUrl}
          isNarrationPlaying={isNarrationPlaying}
          isSoundscapePlaying={isSoundscapePlaying}
          narrationVolume={narrationVolume}
          soundscapeVolume={soundscapeVolume}
          soundscapeMode={preferences.soundscapeMode}
          pronunciationMode={preferences.pronunciationMode}
          pronunciationEnabled={pronunciationFeatureEnabled}
          onClose={() => setShowSettingsPanel(false)}
          onToggleNarration={toggleNarration}
          onToggleSoundscape={toggleSoundscape}
          onNarrationVolumeChange={setNarrationVolume}
          onSoundscapeVolumeChange={setSoundscapeVolume}
          onChangeSoundscapeMode={handleSoundscapeModeChange}
          onChangePronunciationMode={handlePronunciationModeChange}
        />

        {/* Feedback & Login */}
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={handleFeedbackClose}
          onSubmit={handleFeedbackSubmit}
          onSkip={handleFeedbackSkip}
        />
        <LoginPrompt
          show={showLoginPrompt && !session}
          onDismiss={() => setShowLoginPrompt(false)}
        />
      </div>
    </>
  );
}

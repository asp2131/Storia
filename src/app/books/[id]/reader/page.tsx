"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  Volume2,
  Play,
  Pause,
  Music,
  Loader2,
  X,
  Volume1,
  Settings,
  Bookmark,
  ChevronDown,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ReactLenis, type LenisRef } from "lenis/react";
import FeedbackModal from "@/components/FeedbackModal";
import LoginPrompt from "@/components/LoginPrompt";
import IntegratedIllustration from "@/components/IntegratedIllustration";
import { useWordPronunciation } from "@/hooks/useWordPronunciation";
import { useLocalPreferences, SoundscapeMode } from "@/hooks/useLocalPreferences";
import { useAudioCrossFade } from "@/hooks/useAudioCrossFade";
import { useReaderData, WordTimestamp } from "@/hooks/useBookData";
import {
  useReadingProgress,
  useAutoSaveProgressWithAuth,
  loadProgressFromLocalStorage,
} from "@/hooks/useReadingProgress";
import { useSession } from "@/lib/auth-client";

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
  const pageLoadTimeRef = useRef<number>(0);

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


  // ─── Preferences & audio cross-fade ────────────────────────────
  const { preferences, setSoundscapeMode } = useLocalPreferences();
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
  const narrationUrl =
    narrationAssignment?.audioUrl || pageData?.narrationUrl;
  const soundscapeUrl = soundscapeAssignment?.audioUrl;

  const wordTimestamps = useMemo(
    () =>
      (pageData?.narrationTimestamps as WordTimestamp[] | null) || [],
    [pageData?.narrationTimestamps]
  );

  const nextPageData = pages[activeIndex + 1] ?? null;
  const { pronounceWord, pronouncingIndex } = useWordPronunciation({
    wordPronunciations: pageData?.wordPronunciations || null,
    nextPagePronunciations: nextPageData?.wordPronunciations || null,
  });

  // ─── Umami analytics refs ──────────────────────────────────────
  const pageEnteredAtRef = useRef<number>(Date.now());
  const hasTrackedOpenRef = useRef(false);

  // Keep the ref in sync with state (for use inside GSAP callbacks)
  useEffect(() => {
    isNarrationPlayingRef.current = isNarrationPlaying;
  }, [isNarrationPlaying]);

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

      const isMobile = window.matchMedia("(max-width: 768px)").matches;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: `+=${(pages.length - 1) * 100}%`,
          pin: true,
          scrub: true, // instant — Lenis lerp handles all smoothing
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

            if (pageCounterRef.current) {
              const pNum = pages[idx]?.pageNumber ?? idx + 1;
              pageCounterRef.current.textContent = `${pNum}/${pages.length}`;
            }

            // Only trigger React re-render when the active page actually changes
            setActiveIndex((prev) => (prev !== idx ? idx : prev));
          },
        },
      });

      scrollTriggerRef.current = tl.scrollTrigger!;

      // ── Choreograph each page transition ─────────────────────
      pages.forEach((_, i) => {
        if (i === 0) return;

        const pageEl = pagesRef.current[i];
        const prevEl = pagesRef.current[i - 1];
        if (!pageEl) return;

        // Layer 2: New page reveals from bottom via clip-path
        tl.fromTo(
          pageEl,
          {
            clipPath: "inset(100% 0% 0% 0%)",
            ...(isMobile ? {} : { skewY: 2 }),
          },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            ...(isMobile ? {} : { skewY: 0 }),
            duration: 1,
            ease: "none",
          },
          i - 1
        );

        // Layer 3: Illustration scale-in
        const illustration = pageEl.querySelector("[data-illustration]");
        if (illustration) {
          tl.fromTo(
            illustration,
            { scale: 1.12 },
            { scale: 1, duration: 1, ease: "none" },
            i - 1
          );
        }

        // Previous page exit: drift up + fade (+ blur on desktop)
        if (prevEl) {
          tl.to(
            prevEl,
            {
              yPercent: -20,
              ...(isMobile
                ? { opacity: 0 }
                : { filter: "blur(6px)", opacity: 0.4 }),
              duration: 1,
              ease: "none",
            },
            i - 1
          );
        }
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
    const ct = narrationProgress;
    let found = -1;
    for (let i = 0; i < wordTimestamps.length; i++) {
      if (ct >= wordTimestamps[i].start) found = i;
      else break;
    }
    setActiveWordIndex(found);
  }, [narrationProgress, wordTimestamps, isNarrationPlaying]);

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
    if (isNarrationPlaying) {
      narrationRef.current.pause();
    } else {
      narrationRef.current.play();
      window.umami?.track("audio-play", { bookId, type: "narration", page: currentPage });
    }
    setIsNarrationPlaying(!isNarrationPlaying);
  }, [isNarrationPlaying, narrationUrl, bookId, currentPage]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--reader-bg)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "var(--reader-progress-bar-fill)" }}
          />
          <span style={{ color: "var(--reader-text-secondary)" }}>
            Loading book...
          </span>
        </div>
      </div>
    );
  }

  if (error || !readerData) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--reader-bg)" }}
      >
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Book not found"}</p>
          <button
            onClick={() => handleExitAttempt(() => router.back())}
            className="font-medium"
            style={{ color: "var(--reader-nav-btn-bg)" }}
          >
            Go back
          </button>
        </div>
      </div>
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
        {/* Hidden audio elements */}
      <audio
        ref={narrationRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) =>
          setNarrationProgress(e.currentTarget.currentTime)
        }
        onEnded={() => {
          setIsNarrationPlaying(false);
          setActiveWordIndex(-1);
        }}
      />
      <audio
        ref={soundscapeRef}
        loop={preferences.soundscapeMode === "continuous"}
        crossOrigin="anonymous"
        onEnded={() => setIsSoundscapePlaying(false)}
      />

      {/* ═══ FLOATING HEADER ═══ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 safe-area-top"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--reader-bg) 80%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <button
          onClick={() => handleExitAttempt(() => router.back())}
          className="shrink-0 p-1"
          aria-label="Close"
        >
          <X
            className="w-6 h-6"
            style={{ color: "var(--reader-close-color)" }}
          />
        </button>
        <div
          className="flex-1 h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--reader-progress-bar-bg)" }}
        >
          <div
            ref={progressBarRef}
            className="h-full rounded-full"
            style={{
              // Single-page books start at 100%; multi-page starts at 0%
              // and is driven by GSAP onUpdate via the ref.
              width: totalPages <= 1 ? "100%" : "0%",
              backgroundColor: "var(--reader-progress-bar-fill)",
              transition: "none",
            }}
          />
        </div>
        <span
          ref={pageCounterRef}
          className="text-xs font-medium shrink-0 tabular-nums"
          style={{ color: "var(--reader-text-secondary)" }}
        >
          {currentPage}/{totalPages}
        </span>
        <button
          onClick={() => setShowSettingsPanel(true)}
          className="shrink-0 p-1"
          aria-label="Settings"
        >
          <Settings
            className="w-5 h-5"
            style={{ color: "var(--reader-close-color)" }}
          />
        </button>
      </header>

      {/* ═══ FLOATING AUDIO CONTROLS ═══
           Always mounted to avoid React insertBefore conflicts with GSAP pin.
           Hidden via CSS when no audio is available for the current page. */}
      <div
        className="fixed top-14 left-1/2 -translate-x-1/2 z-40 w-[min(620px,calc(100%-3rem))] transition-opacity duration-200"
        style={{
          opacity: narrationUrl || soundscapeUrl ? 1 : 0,
          pointerEvents: narrationUrl || soundscapeUrl ? "auto" : "none",
        }}
      >
        <div className="mx-auto flex items-center justify-center gap-2">
          {/* Narration pill — always in DOM, hidden via CSS */}
          <button
            onClick={toggleNarration}
            className={`flex items-center gap-2 py-1.5 px-3 backdrop-blur-xl border rounded-full shadow-lg transition-all ${
              isNarrationPlaying
                ? "bg-orange-500/90 border-orange-400/60 text-white"
                : "bg-black/60 border-white/15 text-slate-200 hover:bg-black/70"
            }`}
            style={{
              display: narrationUrl ? undefined : "none",
            }}
          >
            {isNarrationPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
            <span className="text-[10px] font-semibold">
              {isNarrationPlaying ? "Reading" : "Read"}
            </span>
          </button>

          {/* Soundscape pill — always in DOM, hidden via CSS */}
          <button
            onClick={toggleSoundscape}
            className="flex items-center gap-3 py-1.5 pl-3 pr-1.5 bg-black/60 backdrop-blur-xl border border-white/15 rounded-full shadow-lg overflow-hidden transition-all hover:bg-black/70"
            style={{
              display: soundscapeUrl ? undefined : "none",
            }}
          >
            <div className="flex items-center gap-2">
              {isSoundscapePlaying ? (
                <Pause className="w-4 h-4 text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]" />
              ) : (
                <Music className="w-4 h-4 text-slate-200" />
              )}
              {isSoundscapePlaying && (
                <div className="flex items-end gap-0.5 h-3">
                  <div
                    className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-1"
                    style={{ height: "6px" }}
                  />
                  <div
                    className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-2"
                    style={{ height: "12px" }}
                  />
                  <div
                    className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-3"
                    style={{ height: "8px" }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center bg-black/50 rounded-full p-0.5 gap-0.5 border border-white/10">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleSoundscapeModeChange("intro-only");
                }}
                className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                  preferences.soundscapeMode === "intro-only"
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                Intro
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleSoundscapeModeChange("continuous");
                }}
                className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                  preferences.soundscapeMode === "continuous"
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                Loop
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ═══ THE STAGE — Pinned scroll container ═══ */}
      <div
        ref={containerRef}
        className="relative w-full h-screen overflow-hidden"
      >
        {pages.map((page, index) => {
          const isInWindow = Math.abs(index - activeIndex) <= 2;

          return (
            <div
              key={page.id}
              ref={(el) => {
                pagesRef.current[index] = el;
              }}
              className="absolute inset-0 w-full h-full will-change-[clip-path,transform,opacity]"
              style={{
                clipPath:
                  index === 0
                    ? "inset(0% 0% 0% 0%)"
                    : "inset(100% 0% 0% 0%)",
                zIndex: index,
              }}
            >
              <div
                data-illustration
                className="w-full h-full flex items-center justify-center p-4 pt-20 pb-6"
              >
                {isInWindow ? (
                  page.imageUrl || page.compositedImageUrl ? (
                    <div className="max-w-full max-h-full w-full h-full flex items-center justify-center">
                      <div className="w-full h-full max-w-5xl max-h-[calc(100vh-7rem)] flex items-center justify-center">
                        <div className="w-full max-h-full">
                          <IntegratedIllustration
                            imageUrl={page.imageUrl || ""}
                            compositedImageUrl={
                              page.compositedImageUrl || null
                            }
                            overlay={page.overlay || null}
                            alt={`Page ${page.pageNumber}`}
                            preferDynamicOverlay
                            activeWordIndex={
                              index === activeIndex
                                ? activeWordIndex
                                : -1
                            }
                            pronouncingWordIndex={
                              index === activeIndex
                                ? pronouncingIndex
                                : null
                            }
                            onWordTap={
                              index === activeIndex
                                ? pronounceWord
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full max-w-2xl aspect-[3/4] rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: "var(--reader-card-bg)",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--reader-text-secondary)",
                        }}
                      >
                        No illustration
                      </span>
                    </div>
                  )
                ) : (
                  /* Placeholder for virtualized-out pages */
                  <div
                    className="w-full max-w-2xl aspect-[3/4] rounded-xl"
                    style={{
                      backgroundColor: "var(--reader-card-bg)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ SCROLL HINT — visible only on first page ═══ */}
      {totalPages > 1 && (
        <div
          className="fixed bottom-8 left-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5 transition-opacity duration-500"
          style={{
            opacity: activeIndex === 0 ? 0.7 : 0,
            transform: "translateX(-50%)",
          }}
        >
          <span
            className="text-[11px] tracking-wide uppercase font-medium"
            style={{ color: "var(--reader-text-secondary)" }}
          >
            Swipe up next page
          </span>
          <ChevronDown
            className="w-5 h-5 animate-bounce"
            style={{ color: "var(--reader-text-secondary)" }}
          />
        </div>
      )}

      {/* ═══ OUTRO / CTA ═══ */}
      <section
        className="h-screen flex flex-col items-center justify-center gap-8 px-6"
        style={{ backgroundColor: "var(--reader-bg)" }}
      >
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl"
            style={{ backgroundColor: "var(--reader-card-bg)" }}
          >
            &#10024;
          </div>
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--reader-text)" }}
          >
            The End
          </h2>
          <p
            className="text-sm max-w-sm mx-auto leading-relaxed"
            style={{ color: "var(--reader-text-secondary)" }}
          >
            You&apos;ve finished reading &ldquo;
            {readerData.book.title}&rdquo;
          </p>
        </div>
        <div className="flex flex-col gap-3 items-center w-full max-w-xs">
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="w-full px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{
              backgroundColor: "var(--reader-nav-btn-bg)",
              color: "var(--reader-nav-btn-text)",
            }}
          >
            Share Feedback
          </button>
          <button
            onClick={() => handleExitAttempt(() => router.back())}
            className="w-full px-6 py-2.5 rounded-full text-sm font-medium border transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{
              borderColor: "var(--reader-progress-bar-bg)",
              color: "var(--reader-text-secondary)",
            }}
          >
            Back to Library
          </button>
          <button
            onClick={() => scrollToPage(0)}
            className="mt-2 text-xs underline underline-offset-4 transition-opacity hover:opacity-80"
            style={{ color: "var(--reader-text-secondary)" }}
          >
            Read again
          </button>
        </div>
      </section>

      {/* ═══ TOAST ═══ */}
      <div
        className={`fixed top-16 left-1/2 -translate-x-1/2 pointer-events-none z-[60] transition-all duration-500 ${
          progressToast
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="bg-teal-600/90 backdrop-blur text-white text-sm px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-teal-400/30">
          <Bookmark className="w-4 h-4 text-teal-200" />
          <span className="font-medium">{progressToast}</span>
        </div>
      </div>

      {/* ═══ SETTINGS PANEL ═══
           Always mounted to avoid React insertBefore conflicts with GSAP pin.
           Hidden via CSS when closed. */}
      <div
        className="fixed inset-0 z-[70] transition-opacity duration-200"
        style={{
          opacity: showSettingsPanel ? 1 : 0,
          pointerEvents: showSettingsPanel ? "auto" : "none",
          visibility: showSettingsPanel ? "visible" : "hidden",
        }}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSettingsPanel(false)}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-slate-900/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300"
          style={{
            transform: showSettingsPanel
              ? "translateX(0)"
              : "translateX(100%)",
          }}
        >
          <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                Settings
              </h2>
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Narration */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Narration
                    </h3>
                    <p className="text-xs text-slate-400">
                      Voice reading
                    </p>
                  </div>
                </div>
                {narrationUrl ? (
                  <div className="space-y-3 pl-[52px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        Playback
                      </span>
                      <button
                        onClick={toggleNarration}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                          isNarrationPlaying
                            ? "bg-orange-500 text-white"
                            : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {isNarrationPlaying ? (
                          <>
                            <Pause className="w-4 h-4" />
                            Playing
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Play
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Volume1 className="w-4 h-4 text-slate-400" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(narrationVolume * 100)}
                        onChange={(e) =>
                          setNarrationVolume(
                            Number(e.target.value) / 100
                          )
                        }
                        className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                      />
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ) : (
                  <p className="pl-[52px] text-sm text-slate-500 italic">
                    No narration for this page
                  </p>
                )}
              </div>

              <div className="border-t border-white/10" />

              {/* Soundscape */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Soundscape
                    </h3>
                    <p className="text-xs text-slate-400">
                      Ambient audio
                    </p>
                  </div>
                </div>
                {soundscapeUrl ? (
                  <div className="space-y-3 pl-[52px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        Playback
                      </span>
                      <button
                        onClick={toggleSoundscape}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                          isSoundscapePlaying
                            ? "bg-teal-500 text-white"
                            : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {isSoundscapePlaying ? (
                          <>
                            <Pause className="w-4 h-4" />
                            Playing
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Play
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Volume1 className="w-4 h-4 text-slate-400" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(soundscapeVolume * 100)}
                        onChange={(e) =>
                          setSoundscapeVolume(
                            Number(e.target.value) / 100
                          )
                        }
                        className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-teal-500"
                      />
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        Mode
                      </span>
                      <div className="flex items-center bg-white/10 rounded-full p-1 gap-1">
                        <button
                          onClick={() =>
                            handleSoundscapeModeChange("intro-only")
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                            preferences.soundscapeMode === "intro-only"
                              ? "bg-teal-500 text-white"
                              : "text-slate-400"
                          }`}
                        >
                          One-shot
                        </button>
                        <button
                          onClick={() =>
                            handleSoundscapeModeChange("continuous")
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                            preferences.soundscapeMode === "continuous"
                              ? "bg-teal-500 text-white"
                              : "text-slate-400"
                          }`}
                        >
                          Loop
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="pl-[52px] text-sm text-slate-500 italic">
                    No soundscape for this page
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

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

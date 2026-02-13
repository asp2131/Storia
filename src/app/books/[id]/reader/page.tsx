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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import FeedbackModal from "@/components/FeedbackModal";
import LoginPrompt from "@/components/LoginPrompt";
import IntegratedIllustration from "@/components/IntegratedIllustration";
import { useWordPronunciation } from "@/hooks/useWordPronunciation";
import { useLocalPreferences, SoundscapeMode } from "@/hooks/useLocalPreferences";
import { useAudioCrossFade } from "@/hooks/useAudioCrossFade";
import { useReaderData, WordTimestamp } from "@/hooks/useBookData";
import { useReadingProgress, useAutoSaveProgressWithAuth, loadProgressFromLocalStorage } from "@/hooks/useReadingProgress";
import { useSession } from "@/lib/auth-client";
// ─── Swipe hook ──────────────────────────────────────────────────

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      // Only trigger horizontal swipes (more horizontal than vertical)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold]
  );

  return { onTouchStart, onTouchEnd };
}

// ─── Main Reader ─────────────────────────────────────────────────

export default function BookReader() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // Auth session
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // Data
  const { data: readerData, isLoading: loading, error: queryError } = useReaderData(bookId);
  const error = queryError?.message || null;

  // Progress
  const { data: savedProgress, isLoading: progressLoading } = useReadingProgress(bookId);
  const progressRestoredRef = useRef(false);
  const hasManuallyNavigatedRef = useRef(false);

  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [progressToast, setProgressToast] = useState<string | null>(null);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  // Audio state
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(false);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [narrationProgress, setNarrationProgress] = useState(0);

  // Word highlighting state
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  // Feedback & login state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackEligible, setFeedbackEligible] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set<number>());
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const pageLoadTimeRef = useRef<number>(0);

  // Settings
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showAudioBar, setShowAudioBar] = useState(true);

  // Soundscape mode
  const { preferences, setSoundscapeMode } = useLocalPreferences();
  const { initAudioContext, connectAudioElement, fadeIn, fadeOut } = useAudioCrossFade();
  const audioConnectedRef = useRef(false);

  // Refs
  const narrationRef = useRef<HTMLAudioElement>(null);
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derived data
  const pageData = readerData?.pages.find((p) => p.pageNumber === currentPage);
  const totalPages = readerData?.pages.length ?? 0;

  const narrationAssignment = pageData?.assignments?.find((a) => a.audioType === "narration");
  const soundscapeAssignment = pageData?.assignments?.find((a) => a.audioType === "soundscape");
  const narrationUrl = narrationAssignment?.audioUrl || pageData?.narrationUrl;
  const soundscapeUrl = soundscapeAssignment?.audioUrl;

  const wordTimestamps = useMemo(
    () => (pageData?.narrationTimestamps as WordTimestamp[] | null) || [],
    [pageData?.narrationTimestamps]
  );
  const nextPageData = readerData?.pages.find((p) => p.pageNumber === currentPage + 1);
  const { pronounceWord, pronouncingIndex } = useWordPronunciation({
    wordPronunciations: pageData?.wordPronunciations || null,
    nextPagePronunciations: nextPageData?.wordPronunciations || null,
  });

  // Word timestamp highlighting
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

  // Feedback eligibility
  useEffect(() => {
    const check = async () => {
      const skipped = sessionStorage.getItem("feedback_skipped") === "true";
      if (skipped) { setFeedbackEligible(false); return; }
      try {
        const res = await fetch("/api/feedback/status");
        if (res.ok) { const d = await res.json(); setFeedbackEligible(d.shouldShowFeedback); }
      } catch { setFeedbackEligible(false); }
    };
    check();
  }, []);

  useEffect(() => {
    pageLoadTimeRef.current = Date.now();
  }, []);

  // Track pages viewed
  useEffect(() => { if (currentPage > 0) setPagesViewed((prev) => new Set(prev).add(currentPage)); }, [currentPage]);
  useEffect(() => { if (currentPage > 1) setHasNavigated(true); }, [currentPage]);

  // Login prompt timer
  useEffect(() => {
    if (isAuthenticated || !loading) return;
    const timer = setTimeout(() => {
      if (Date.now() - pageLoadTimeRef.current >= 30000 && hasNavigated) setShowLoginPrompt(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, loading, hasNavigated]);

  useEffect(() => {
    if (!isAuthenticated && !loading && currentPage > 1 && !progressRestoredRef.current) setShowLoginPrompt(true);
  }, [isAuthenticated, loading, currentPage]);

  // Restore progress
  useEffect(() => {
    if (progressRestoredRef.current || loading || progressLoading || hasManuallyNavigatedRef.current) return;
    let restoredPage: number | null = null;
    if (isAuthenticated && savedProgress?.currentPage && savedProgress.currentPage > 1) {
      restoredPage = savedProgress.currentPage;
    } else if (!isAuthenticated) {
      const lp = loadProgressFromLocalStorage(bookId);
      if (lp?.currentPage && lp.currentPage > 1) restoredPage = lp.currentPage;
    }
    if (restoredPage && restoredPage <= totalPages) {
      setCurrentPage(restoredPage);
      progressRestoredRef.current = true;
      setProgressToast(`Continuing from page ${restoredPage}`);
      setTimeout(() => setProgressToast(null), 3000);
    } else {
      progressRestoredRef.current = true;
    }
  }, [bookId, savedProgress, isAuthenticated, loading, progressLoading, totalPages]);

  useAutoSaveProgressWithAuth({ bookId, currentPage, totalPages, enabled: !loading && totalPages > 0 });

  // ─── Navigation ──────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const markSwipeHintSeen = useCallback(() => {
    try {
      sessionStorage.setItem(`reader_swipe_hint_seen:${bookId}`, "1");
    } catch {
      // Ignore storage errors on restricted browsers.
    }
  }, [bookId]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        hasManuallyNavigatedRef.current = true;
        if (showSwipeHint) {
          setShowSwipeHint(false);
          markSwipeHintSeen();
        }
        setSlideDirection(page > currentPage ? "left" : "right");
        setCurrentPage(page);
        showToast(`Page ${page} of ${totalPages}`);
      }
    },
    [currentPage, markSwipeHintSeen, showSwipeHint, showToast, totalPages]
  );

  const nextPage = useCallback(() => { if (currentPage < totalPages) goToPage(currentPage + 1); }, [currentPage, totalPages, goToPage]);
  const prevPage = useCallback(() => { if (currentPage > 1) goToPage(currentPage - 1); }, [currentPage, goToPage]);

  // Clear slide direction after animation
  useEffect(() => {
    if (slideDirection) {
      const t = setTimeout(() => setSlideDirection(null), 400);
      return () => clearTimeout(t);
    }
  }, [slideDirection]);

  // Keyboard & swipe
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); nextPage(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prevPage(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextPage, prevPage]);

  const swipe = useSwipe(nextPage, prevPage);

  // Show a short swipe hint for first-time reader sessions.
  useEffect(() => {
    if (loading || totalPages < 2) return;

    let seen = false;
    try {
      seen = sessionStorage.getItem(`reader_swipe_hint_seen:${bookId}`) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    setShowSwipeHint(true);
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
      markSwipeHintSeen();
    }, 4500);

    return () => clearTimeout(timer);
  }, [bookId, loading, markSwipeHintSeen, totalPages]);

  // ─── Audio ───────────────────────────────────────────────────────

  const toggleNarration = () => {
    if (!narrationRef.current || !narrationUrl) return;
    if (isNarrationPlaying) narrationRef.current.pause();
    else narrationRef.current.play();
    setIsNarrationPlaying(!isNarrationPlaying);
  };

  const toggleSoundscape = () => {
    if (!soundscapeRef.current || !soundscapeUrl) return;
    if (!audioConnectedRef.current) {
      initAudioContext();
      const g = connectAudioElement(soundscapeRef.current);
      if (g) audioConnectedRef.current = true;
    }
    if (isSoundscapePlaying) {
      if (audioConnectedRef.current) { fadeOut(0.5); setTimeout(() => soundscapeRef.current?.pause(), 500); }
      else soundscapeRef.current.pause();
    } else {
      soundscapeRef.current.play();
      if (audioConnectedRef.current) fadeIn(0.5, soundscapeVolume);
    }
    setIsSoundscapePlaying(!isSoundscapePlaying);
  };

  const handleSoundscapeModeChange = (mode: SoundscapeMode) => {
    setSoundscapeMode(mode);
  };

  // Narration source change
  useEffect(() => {
    if (narrationRef.current && narrationUrl) {
      narrationRef.current.src = narrationUrl;
      if (isNarrationPlaying) narrationRef.current.play();
    }
  }, [narrationUrl, isNarrationPlaying]);

  // Soundscape source change
  useEffect(() => {
    if (soundscapeRef.current && soundscapeUrl) {
      const prevSrc = soundscapeRef.current.src;
      const isNew = prevSrc && !prevSrc.includes(soundscapeUrl);
      if (isNew && isSoundscapePlaying && audioConnectedRef.current) {
        fadeOut(1.0);
        setTimeout(() => {
          if (soundscapeRef.current) { soundscapeRef.current.src = soundscapeUrl; soundscapeRef.current.play(); fadeIn(1.0, soundscapeVolume); }
        }, 1000);
      } else {
        soundscapeRef.current.src = soundscapeUrl;
        if (isSoundscapePlaying) soundscapeRef.current.play();
      }
    }
  }, [fadeIn, fadeOut, isSoundscapePlaying, soundscapeUrl, soundscapeVolume]);

  // Keep the element loop attribute in sync with reader mode.
  useEffect(() => {
    if (soundscapeRef.current) {
      soundscapeRef.current.loop = preferences.soundscapeMode === "continuous";
    }
  }, [preferences.soundscapeMode]);

  // Volume
  useEffect(() => { if (narrationRef.current) narrationRef.current.volume = narrationVolume; }, [narrationVolume]);
  useEffect(() => { if (soundscapeRef.current) soundscapeRef.current.volume = soundscapeVolume; }, [soundscapeVolume]);

  // ─── Feedback ────────────────────────────────────────────────────

  const handleExitAttempt = useCallback((navFn: () => void) => {
    const enough = pagesViewed.size >= 2;
    const skipped = sessionStorage.getItem("feedback_skipped") === "true";
    if (feedbackEligible && enough && !skipped) { setPendingNavigation(() => navFn); setShowFeedbackModal(true); }
    else navFn();
  }, [feedbackEligible, pagesViewed]);

  const handleFeedbackSubmit = async (rating: number, feedback?: string) => {
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, feedback }) });
    if (!res.ok) throw new Error("Failed to submit feedback");
    setFeedbackEligible(false);
  };

  const handleFeedbackSkip = useCallback(() => {
    sessionStorage.setItem("feedback_skipped", "true");
    setShowFeedbackModal(false);
    if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
  }, [pendingNavigation]);

  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false);
    if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
  }, [pendingNavigation]);

  // ─── Progress ────────────────────────────────────────────────────

  const progressPercent = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  // ─── Tap navigation zones ────────────────────────────────────────

  const handlePageTap = useCallback(
    (e: React.MouseEvent) => {
      // Ignore taps on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target.closest("input") ||
        target.closest("[data-overlay-word='true']")
      ) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const third = rect.width / 3;

      if (x < third) prevPage();
      else if (x > third * 2) nextPage();
      // Middle third: toggle audio bar
      else setShowAudioBar((v) => !v);
    },
    [nextPage, prevPage]
  );

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--reader-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--reader-progress-bar-fill)" }} />
          <span style={{ color: "var(--reader-text-secondary)" }}>Loading book...</span>
        </div>
      </div>
    );
  }

  if (error || !readerData) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--reader-bg)" }}>
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Book not found"}</p>
          <button onClick={() => handleExitAttempt(() => router.back())} className="font-medium" style={{ color: "var(--reader-nav-btn-bg)" }}>Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col relative overflow-hidden select-none"
      style={{ backgroundColor: "var(--reader-bg)", color: "var(--reader-text)" }}
    >
      {/* Audio elements */}
      <audio
        ref={narrationRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => setNarrationProgress(e.currentTarget.currentTime)}
        onEnded={() => { setIsNarrationPlaying(false); setActiveWordIndex(-1); }}
      />
      <audio
        ref={soundscapeRef}
        loop={preferences.soundscapeMode === "continuous"}
        crossOrigin="anonymous"
        onEnded={() => setIsSoundscapePlaying(false)}
      />

      {/* ═══ TOP BAR ═══ */}
      <header
        className="shrink-0 flex items-center gap-3 px-4 py-3 safe-area-top z-40"
        style={{ backgroundColor: "var(--reader-bg)" }}
      >
        <button onClick={() => handleExitAttempt(() => router.back())} className="shrink-0 p-1" aria-label="Close">
          <X className="w-6 h-6" style={{ color: "var(--reader-close-color)" }} />
        </button>
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--reader-progress-bar-bg)" }}>
          <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%`, backgroundColor: "var(--reader-progress-bar-fill)" }} />
        </div>
        <span className="text-xs font-medium shrink-0 tabular-nums" style={{ color: "var(--reader-text-secondary)" }}>
          {currentPage}/{totalPages}
        </span>
        <button onClick={() => setShowSettingsPanel(true)} className="shrink-0 p-1" aria-label="Settings">
          <Settings className="w-5 h-5" style={{ color: "var(--reader-close-color)" }} />
        </button>
      </header>

      {/* ═══ PAGE CONTENT ═══ */}
      <main
        className="flex-1 relative overflow-hidden"
        onClick={handlePageTap}
        {...swipe}
      >
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={(e) => {
            e.stopPropagation();
            prevPage();
          }}
          className="absolute top-4 left-4 z-30 h-11 w-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "rgba(255,255,255,0.22)",
            borderColor: "rgba(255,255,255,0.28)",
            color: "var(--reader-text)",
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage >= totalPages}
          onClick={(e) => {
            e.stopPropagation();
            nextPage();
          }}
          className="absolute top-4 right-4 z-30 h-11 w-11 rounded-full border backdrop-blur-md flex items-center justify-center transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "rgba(255,255,255,0.22)",
            borderColor: "rgba(255,255,255,0.28)",
            color: "var(--reader-text)",
          }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {(narrationUrl || soundscapeUrl) && showAudioBar && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[min(620px,calc(100%-7.5rem))]">
            <div className="mx-auto flex items-center justify-center gap-2">
              {narrationUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNarration();
                  }}
                  className={`flex items-center gap-2 py-1.5 px-3 backdrop-blur-2xl border rounded-full shadow-lg transition-all ${
                    isNarrationPlaying
                      ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {isNarrationPlaying ? <Pause className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-semibold">{isNarrationPlaying ? "Reading" : "Read"}</span>
                </button>
              )}

              {soundscapeUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSoundscape();
                  }}
                  className="flex items-center gap-3 py-1.5 pl-3 pr-1.5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full shadow-lg overflow-hidden transition-all hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    {isSoundscapePlaying ? (
                      <Pause className="w-4 h-4 text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]" />
                    ) : (
                      <Music className="w-4 h-4 text-slate-400" />
                    )}
                    {isSoundscapePlaying && (
                      <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-1" style={{ height: "6px" }} />
                        <div className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-2" style={{ height: "12px" }} />
                        <div className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-3" style={{ height: "8px" }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center bg-black/40 rounded-full p-0.5 gap-0.5 border border-white/5">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSoundscapeModeChange("intro-only");
                      }}
                      className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                        preferences.soundscapeMode === "intro-only"
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-white/40 hover:text-white/60"
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
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Loop
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Page image — composited image has text baked in */}
        <div
          className={`absolute inset-0 flex items-center justify-center p-4 ${
            slideDirection === "left"
              ? "animate-slide-in-from-right"
              : slideDirection === "right"
              ? "animate-slide-in-from-left"
              : ""
          }`}
          key={currentPage}
        >
          {pageData?.imageUrl || pageData?.compositedImageUrl ? (
            <div className="max-w-full max-h-full w-full h-full flex items-center justify-center">
              <div className="w-full h-full max-w-5xl max-h-[calc(100vh-10rem)] flex items-center justify-center">
                <div className="w-full max-h-full">
                  <IntegratedIllustration
                    imageUrl={pageData?.imageUrl || ""}
                    compositedImageUrl={pageData?.compositedImageUrl || null}
                    overlay={pageData?.overlay || null}
                    alt={`Page ${currentPage}`}
                    preferDynamicOverlay
                    activeWordIndex={activeWordIndex}
                    pronouncingWordIndex={pronouncingIndex}
                    onWordTap={pronounceWord}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-full max-w-2xl aspect-3/4 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "var(--reader-card-bg)" }}
            >
              <span style={{ color: "var(--reader-text-secondary)" }}>No illustration</span>
            </div>
          )}
        </div>
      </main>

      {showSwipeHint && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute inset-y-0 left-0 w-14 flex items-center justify-center">
            <div
              className="h-28 w-full rounded-r-full animate-edge-glow"
              style={{ background: "linear-gradient(to right, rgba(255,255,255,0.16), rgba(255,255,255,0))" }}
            />
            <span className="absolute text-white/80 text-2xl font-light animate-hint-pulse-left">‹</span>
          </div>
          <div className="absolute inset-y-0 right-0 w-14 flex items-center justify-center">
            <div
              className="h-28 w-full rounded-l-full animate-edge-glow"
              style={{ background: "linear-gradient(to left, rgba(255,255,255,0.16), rgba(255,255,255,0))" }}
            />
            <span className="absolute text-white/80 text-2xl font-light animate-hint-pulse">›</span>
          </div>
          <div
            className={`absolute left-1/2 -translate-x-1/2 text-[11px] tracking-wide uppercase text-white/80 ${
              showAudioBar ? "bottom-20" : "bottom-8"
            }`}
          >
            Swipe to navigate
          </div>
        </div>
      )}

      {/* ═══ TOASTS ═══ */}
      <div className={`fixed top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-300 ${toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <div className="backdrop-blur text-sm px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 border" style={{ backgroundColor: "var(--reader-card-bg)", color: "var(--reader-text)", borderColor: "var(--reader-progress-bar-bg)" }}>
          <span>{toast}</span>
        </div>
      </div>

      <div className={`fixed top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-500 ${progressToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <div className="bg-teal-600/90 backdrop-blur text-white text-sm px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-teal-400/30">
          <Bookmark className="w-4 h-4 text-teal-200" />
          <span className="font-medium">{progressToast}</span>
        </div>
      </div>

      {/* ═══ SETTINGS PANEL ═══ */}
      {showSettingsPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettingsPanel(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-slate-900/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <button onClick={() => setShowSettingsPanel(false)} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
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
                    <h3 className="text-sm font-semibold text-white">Narration</h3>
                    <p className="text-xs text-slate-400">Voice reading</p>
                  </div>
                </div>
                {narrationUrl ? (
                  <div className="space-y-3 pl-[52px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Playback</span>
                      <button onClick={toggleNarration} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isNarrationPlaying ? "bg-orange-500 text-white" : "bg-white/10 text-slate-300"}`}>
                        {isNarrationPlaying ? <><Pause className="w-4 h-4" />Playing</> : <><Play className="w-4 h-4" />Play</>}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Volume1 className="w-4 h-4 text-slate-400" />
                      <input type="range" min="0" max="100" value={Math.round(narrationVolume * 100)} onChange={(e) => setNarrationVolume(Number(e.target.value) / 100)} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500" />
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ) : (
                  <p className="pl-[52px] text-sm text-slate-500 italic">No narration for this page</p>
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
                    <h3 className="text-sm font-semibold text-white">Soundscape</h3>
                    <p className="text-xs text-slate-400">Ambient audio</p>
                  </div>
                </div>
                {soundscapeUrl ? (
                  <div className="space-y-3 pl-[52px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Playback</span>
                      <button onClick={toggleSoundscape} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isSoundscapePlaying ? "bg-teal-500 text-white" : "bg-white/10 text-slate-300"}`}>
                        {isSoundscapePlaying ? <><Pause className="w-4 h-4" />Playing</> : <><Play className="w-4 h-4" />Play</>}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Volume1 className="w-4 h-4 text-slate-400" />
                      <input type="range" min="0" max="100" value={Math.round(soundscapeVolume * 100)} onChange={(e) => setSoundscapeVolume(Number(e.target.value) / 100)} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-teal-500" />
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Mode</span>
                      <div className="flex items-center bg-white/10 rounded-full p-1 gap-1">
                        <button onClick={() => handleSoundscapeModeChange("intro-only")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${preferences.soundscapeMode === "intro-only" ? "bg-teal-500 text-white" : "text-slate-400"}`}>One-shot</button>
                        <button onClick={() => handleSoundscapeModeChange("continuous")} className={`px-3 py-1.5 rounded-full text-xs font-medium ${preferences.soundscapeMode === "continuous" ? "bg-teal-500 text-white" : "text-slate-400"}`}>Loop</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="pl-[52px] text-sm text-slate-500 italic">No soundscape for this page</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback & Login */}
      <FeedbackModal isOpen={showFeedbackModal} onClose={handleFeedbackClose} onSubmit={handleFeedbackSubmit} onSkip={handleFeedbackSkip} />
      <LoginPrompt show={showLoginPrompt && !session} onDismiss={() => setShowLoginPrompt(false)} />
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
import FeedbackModal from "@/components/FeedbackModal";
import LoginPrompt from "@/components/LoginPrompt";
import { useLocalPreferences, SoundscapeMode } from "@/hooks/useLocalPreferences";
import { useAudioCrossFade } from "@/hooks/useAudioCrossFade";
import { useReaderData, WordTimestamp } from "@/hooks/useBookData";
import { useReadingProgress, useAutoSaveProgressWithAuth, loadProgressFromLocalStorage } from "@/hooks/useReadingProgress";
import { useSession } from "@/lib/auth-client";

export default function BookReader() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // Auth session for progress tracking
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // Fetch data with React Query
  const { data: readerData, isLoading: loading, error: queryError } = useReaderData(bookId);
  const error = queryError?.message || null;

  // Reading progress tracking
  const { data: savedProgress, isLoading: progressLoading } = useReadingProgress(bookId);
  const progressRestoredRef = useRef(false);
  const hasManuallyNavigatedRef = useRef(false);

  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [progressToast, setProgressToast] = useState<string | null>(null);

  // Audio state
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(false);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [narrationDuration, setNarrationDuration] = useState(0);

  // Word highlighting state
  const [wordTimestamps, setWordTimestamps] = useState<WordTimestamp[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [timestampsLoaded, setTimestampsLoaded] = useState(false);

  // Feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackEligible, setFeedbackEligible] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set<number>());
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Login prompt state
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const pageLoadTimeRef = useRef<number>(Date.now());

  // Settings panel state
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [narrationAutoPlay, setNarrationAutoPlay] = useState(false);

  // Soundscape mode state
  const [introFadedPages, setIntroFadedPages] = useState<Set<number>>(new Set());
  const introFadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { preferences, setSoundscapeMode } = useLocalPreferences();
  const { initAudioContext, connectAudioElement, fadeIn, fadeOut } = useAudioCrossFade();
  const audioConnectedRef = useRef(false);

  // Refs
  const narrationRef = useRef<HTMLAudioElement>(null);
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current page data
  const pageData = readerData?.pages.find((p) => p.pageNumber === currentPage);
  const totalPages = readerData?.pages.length ?? 0;

  // Get audio for current page
  const narrationAssignment = pageData?.assignments?.find(
    (a) => a.audioType === "narration"
  );
  const soundscapeAssignment = pageData?.assignments?.find(
    (a) => a.audioType === "soundscape"
  );
  const narrationUrl = narrationAssignment?.audioUrl || pageData?.narrationUrl;
  const soundscapeUrl = soundscapeAssignment?.audioUrl;

  // Load word timestamps from page data when page changes
  useEffect(() => {
    if (!narrationUrl || !pageData?.narrationTimestamps) {
      setWordTimestamps([]);
      setTimestampsLoaded(false);
      setActiveWordIndex(-1);
      return;
    }

    const timestamps = pageData.narrationTimestamps as WordTimestamp[];
    if (Array.isArray(timestamps) && timestamps.length > 0) {
      setWordTimestamps(timestamps);
      setTimestampsLoaded(true);
    } else {
      setWordTimestamps([]);
      setTimestampsLoaded(false);
    }
  }, [narrationUrl, pageData?.narrationTimestamps]);

  // Calculate active word based on narration progress and timestamps
  useEffect(() => {
    if (!isNarrationPlaying || wordTimestamps.length === 0) {
      if (!isNarrationPlaying) setActiveWordIndex(-1);
      return;
    }

    const currentTime = narrationProgress;
    let foundIndex = -1;

    for (let i = 0; i < wordTimestamps.length; i++) {
      const wordData = wordTimestamps[i];
      const nextWord = wordTimestamps[i + 1];

      if (currentTime >= wordData.start && currentTime <= wordData.end) {
        foundIndex = i;
        break;
      }

      if (nextWord && currentTime > wordData.end && currentTime < nextWord.start) {
        foundIndex = i;
        break;
      }

      if (!nextWord && currentTime >= wordData.start) {
        foundIndex = i;
        break;
      }

      if (currentTime > wordData.end) {
        foundIndex = i;
      }
    }

    setActiveWordIndex(foundIndex);
  }, [narrationProgress, wordTimestamps, isNarrationPlaying]);

  // Check feedback eligibility on mount
  useEffect(() => {
    const checkFeedbackEligibility = async () => {
      const skippedThisSession = sessionStorage.getItem("feedback_skipped") === "true";
      if (skippedThisSession) {
        setFeedbackEligible(false);
        return;
      }

      try {
        const response = await fetch("/api/feedback/status");
        if (response.ok) {
          const data = await response.json();
          setFeedbackEligible(data.shouldShowFeedback);
        }
      } catch (error) {
        console.error("Failed to check feedback eligibility:", error);
        setFeedbackEligible(false);
      }
    };

    checkFeedbackEligibility();
  }, []);

  // Track pages viewed
  useEffect(() => {
    if (currentPage > 0) {
      setPagesViewed((prev) => new Set(prev).add(currentPage));
    }
  }, [currentPage]);

  // Track navigation for login prompt
  useEffect(() => {
    if (currentPage > 1) {
      setHasNavigated(true);
    }
  }, [currentPage]);

  // Show login prompt after 30 seconds AND user has navigated
  useEffect(() => {
    if (isAuthenticated || !loading) {
      return;
    }

    const timer = setTimeout(() => {
      const timeOnPage = Date.now() - pageLoadTimeRef.current;
      const hasBeen30Seconds = timeOnPage >= 30000;

      if (hasBeen30Seconds && hasNavigated) {
        setShowLoginPrompt(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, loading, hasNavigated]);

  // Show login prompt when accessing page > 1 directly
  useEffect(() => {
    if (!isAuthenticated && !loading && currentPage > 1 && !progressRestoredRef.current) {
      setShowLoginPrompt(true);
    }
  }, [isAuthenticated, loading, currentPage]);

  // Restore reading progress on mount
  useEffect(() => {
    if (progressRestoredRef.current || loading || progressLoading) {
      return;
    }

    if (hasManuallyNavigatedRef.current) {
      return;
    }

    let restoredPage: number | null = null;

    if (isAuthenticated && savedProgress?.currentPage && savedProgress.currentPage > 1) {
      restoredPage = savedProgress.currentPage;
    } else if (!isAuthenticated) {
      const localProgress = loadProgressFromLocalStorage(bookId);
      if (localProgress?.currentPage && localProgress.currentPage > 1) {
        restoredPage = localProgress.currentPage;
      }
    }

    if (restoredPage && restoredPage <= totalPages) {
      setCurrentPage(restoredPage);
      progressRestoredRef.current = true;

      setProgressToast(`Continuing from page ${restoredPage}`);
      setTimeout(() => {
        setProgressToast(null);
      }, 3000);
    } else {
      progressRestoredRef.current = true;
    }
  }, [bookId, savedProgress, isAuthenticated, loading, progressLoading, totalPages]);

  // Auto-save reading progress on page change
  useAutoSaveProgressWithAuth({
    bookId,
    currentPage,
    totalPages,
    enabled: !loading && totalPages > 0,
  });

  // Exit handling - check if feedback modal should be shown
  const handleExitAttempt = useCallback(
    (navigateFn: () => void) => {
      const hasViewedEnoughPages = pagesViewed.size >= 2;
      const skippedThisSession = sessionStorage.getItem("feedback_skipped") === "true";

      if (feedbackEligible && hasViewedEnoughPages && !skippedThisSession) {
        setPendingNavigation(() => navigateFn);
        setShowFeedbackModal(true);
      } else {
        navigateFn();
      }
    },
    [feedbackEligible, pagesViewed]
  );

  // Handle feedback submission
  const handleFeedbackSubmit = async (rating: number, feedback?: string) => {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, feedback }),
    });

    if (!response.ok) {
      throw new Error("Failed to submit feedback");
    }

    setFeedbackEligible(false);
  };

  // Handle feedback skip
  const handleFeedbackSkip = useCallback(() => {
    sessionStorage.setItem("feedback_skipped", "true");
    setShowFeedbackModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // Handle feedback close (after successful submit)
  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // Show toast
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2000);
  }, []);

  // Navigation
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        hasManuallyNavigatedRef.current = true;
        setCurrentPage(page);
        showToast(`Page ${page} of ${totalPages}`);
      }
    },
    [totalPages, showToast]
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextPage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage]);

  // Audio controls
  const toggleNarration = () => {
    if (!narrationRef.current || !narrationUrl) return;

    if (isNarrationPlaying) {
      narrationRef.current.pause();
    } else {
      narrationRef.current.play();
    }
    setIsNarrationPlaying(!isNarrationPlaying);
  };

  const toggleSoundscape = () => {
    if (!soundscapeRef.current || !soundscapeUrl) return;

    if (!audioConnectedRef.current) {
      initAudioContext();
      const gainNode = connectAudioElement(soundscapeRef.current);
      if (gainNode) {
        audioConnectedRef.current = true;
      }
    }

    if (isSoundscapePlaying) {
      if (audioConnectedRef.current) {
        fadeOut(0.5);
        setTimeout(() => {
          soundscapeRef.current?.pause();
        }, 500);
      } else {
        soundscapeRef.current.pause();
      }
    } else {
      soundscapeRef.current.play();
      if (audioConnectedRef.current) {
        fadeIn(0.5, soundscapeVolume);
      }
    }
    setIsSoundscapePlaying(!isSoundscapePlaying);
  };

  // Handle soundscape mode toggle
  const handleSoundscapeModeChange = (mode: SoundscapeMode) => {
    setSoundscapeMode(mode);
    if (mode === 'continuous') {
      setIntroFadedPages(new Set());
    }
  };

  // Update audio sources when page changes
  useEffect(() => {
    if (narrationRef.current && narrationUrl) {
      narrationRef.current.src = narrationUrl;
      if (isNarrationPlaying) {
        narrationRef.current.play();
      }
    }
  }, [narrationUrl, isNarrationPlaying]);

  // Handle soundscape source changes with cross-fade
  useEffect(() => {
    if (soundscapeRef.current && soundscapeUrl) {
      const prevSrc = soundscapeRef.current.src;
      const isNewSource = prevSrc && !prevSrc.includes(soundscapeUrl);

      if (isNewSource && isSoundscapePlaying) {
        if (audioConnectedRef.current) {
          fadeOut(1.0);
          setTimeout(() => {
            if (soundscapeRef.current) {
              soundscapeRef.current.src = soundscapeUrl;
              soundscapeRef.current.play();
              fadeIn(1.0, soundscapeVolume);
            }
          }, 1000);
        } else {
          const audio = soundscapeRef.current;
          const startVolume = audio.volume;
          audio.volume = 0;
          audio.src = soundscapeUrl;
          audio.play();
          let step = 0;
          const steps = 10;
          const fadeInterval = setInterval(() => {
            step++;
            audio.volume = startVolume * (step / steps);
            if (step >= steps) {
              clearInterval(fadeInterval);
            }
          }, 100);
        }
      } else {
        soundscapeRef.current.src = soundscapeUrl;
        if (isSoundscapePlaying) {
          soundscapeRef.current.play();
        }
      }
    }
  }, [soundscapeUrl]);

  // Intro-only mode: fade out after 10 seconds
  useEffect(() => {
    if (introFadeTimerRef.current) {
      clearTimeout(introFadeTimerRef.current);
      introFadeTimerRef.current = null;
    }

    if (
      preferences.soundscapeMode === 'intro-only' &&
      isSoundscapePlaying &&
      soundscapeUrl &&
      !introFadedPages.has(currentPage)
    ) {
      introFadeTimerRef.current = setTimeout(() => {
        setIntroFadedPages((prev) => new Set(prev).add(currentPage));

        if (audioConnectedRef.current) {
          fadeOut(3.0);
          setTimeout(() => {
            if (soundscapeRef.current) {
              soundscapeRef.current.pause();
            }
            setIsSoundscapePlaying(false);
          }, 3000);
        } else {
          const audio = soundscapeRef.current;
          if (audio) {
            const startVolume = audio.volume;
            const steps = 30;
            const stepDuration = 3000 / steps;
            let step = 0;
            const fadeInterval = setInterval(() => {
              step++;
              audio.volume = Math.max(0, startVolume * (1 - step / steps));
              if (step >= steps) {
                clearInterval(fadeInterval);
                audio.pause();
                audio.volume = startVolume;
                setIsSoundscapePlaying(false);
              }
            }, stepDuration);
          }
        }
      }, 10000);
    }

    return () => {
      if (introFadeTimerRef.current) {
        clearTimeout(introFadeTimerRef.current);
      }
    };
  }, [currentPage, preferences.soundscapeMode, isSoundscapePlaying, soundscapeUrl, introFadedPages, fadeOut]);

  // Volume controls
  useEffect(() => {
    if (narrationRef.current) {
      narrationRef.current.volume = narrationVolume;
    }
  }, [narrationVolume]);

  useEffect(() => {
    if (soundscapeRef.current) {
      soundscapeRef.current.volume = soundscapeVolume;
    }
  }, [soundscapeVolume]);

  // Progress percentage
  const progressPercent = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--reader-bg)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--reader-progress-bar-fill)' }} />
          <span style={{ color: 'var(--reader-text-secondary)' }}>Loading book...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !readerData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--reader-bg)' }}
      >
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Book not found"}</p>
          <button
            onClick={() => handleExitAttempt(() => router.back())}
            className="font-medium"
            style={{ color: 'var(--reader-nav-btn-bg)' }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--reader-text)' }}
    >
      {/* Hidden Audio Elements */}
      <audio
        ref={narrationRef}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => setNarrationProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setNarrationDuration(e.currentTarget.duration)}
        onEnded={() => {
          setIsNarrationPlaying(false);
          setActiveWordIndex(-1);
        }}
      />
      <audio ref={soundscapeRef} loop crossOrigin="anonymous" />

      {/* ═══ FIXED TOP BAR: Close + Progress ═══ */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 safe-area-top"
        style={{ backgroundColor: 'var(--reader-bg)' }}
      >
        {/* Close Button */}
        <button
          onClick={() => handleExitAttempt(() => router.back())}
          className="flex-shrink-0 p-1"
          aria-label="Close reader"
        >
          <X className="w-6 h-6" style={{ color: 'var(--reader-close-color)' }} />
        </button>

        {/* Progress Bar */}
        <div
          className="flex-1 h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--reader-progress-bar-bg)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: 'var(--reader-progress-bar-fill)',
            }}
          />
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettingsPanel(true)}
          className="flex-shrink-0 p-1"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" style={{ color: 'var(--reader-close-color)' }} />
        </button>
      </header>

      {/* ═══ SCROLLABLE CONTENT AREA ═══ */}
      <main className="flex-1 flex flex-col items-center px-4 md:px-6 pt-4 pb-4 overflow-y-auto">
        {/* Image Card */}
        <div className="w-full max-w-md">
          {pageData?.imageUrl ? (
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
              <Image
                src={pageData.imageUrl}
                alt={`Page ${currentPage} illustration`}
                fill
                className="object-cover"
                priority
              />
            </div>
          ) : (
            <div
              className="w-full aspect-[4/3] rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--reader-card-bg)' }}
            >
              <span style={{ color: 'var(--reader-text-secondary)' }}>
                No illustration
              </span>
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="mt-8 mb-6 text-center max-w-lg px-2 w-full">
          {pageData?.textContent ? (
            <p className="text-2xl md:text-3xl font-bold font-sans leading-relaxed whitespace-pre-wrap">
              {timestampsLoaded && wordTimestamps.length > 0 ? (
                wordTimestamps.map((wordData, index) => (
                  <span
                    key={index}
                    className={`transition-all duration-200 ${
                      index === activeWordIndex && isNarrationPlaying
                        ? "rounded px-1 -mx-0.5 font-extrabold"
                        : ""
                    }`}
                    style={
                      index === activeWordIndex && isNarrationPlaying
                        ? { backgroundColor: 'var(--reader-highlight-bg)' }
                        : undefined
                    }
                  >
                    {wordData.word}{" "}
                  </span>
                ))
              ) : (
                <span>{pageData.textContent}</span>
              )}
            </p>
          ) : (
            <p style={{ color: 'var(--reader-text-secondary)' }} className="italic">
              No text content
            </p>
          )}
        </div>

        {/* Audio Controls Island */}
        {(narrationUrl || soundscapeUrl) && (
          <div className="flex items-center gap-2 mb-4">
            {/* Narration Toggle */}
            {narrationUrl && (
              <button
                onClick={toggleNarration}
                className={`flex items-center gap-2 py-2 px-4 rounded-full border shadow-sm transition-all text-sm font-medium ${
                  isNarrationPlaying
                    ? "bg-orange-500/15 border-orange-400/40 text-orange-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                style={
                  !isNarrationPlaying
                    ? { color: 'var(--reader-text-secondary)' }
                    : undefined
                }
              >
                {isNarrationPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                <span>{isNarrationPlaying ? "Reading" : "Read"}</span>
              </button>
            )}

            {/* Soundscape Toggle */}
            {soundscapeUrl && (
              <button
                onClick={toggleSoundscape}
                className={`flex items-center gap-2 py-2 px-4 rounded-full border shadow-sm transition-all text-sm font-medium ${
                  isSoundscapePlaying
                    ? "bg-teal-500/15 border-teal-400/40 text-teal-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                style={
                  !isSoundscapePlaying
                    ? { color: 'var(--reader-text-secondary)' }
                    : undefined
                }
              >
                {isSoundscapePlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    <div className="w-1 bg-teal-400 rounded-full animate-sound-wave-1" style={{ height: '60%' }} />
                    <div className="w-1 bg-teal-400 rounded-full animate-sound-wave-2" style={{ height: '100%' }} />
                    <div className="w-1 bg-teal-400 rounded-full animate-sound-wave-3" style={{ height: '80%' }} />
                  </div>
                ) : (
                  <Music className="w-4 h-4" />
                )}
                <span>{isSoundscapePlaying ? "BGM On" : "BGM"}</span>
              </button>
            )}

            {/* Soundscape Mode Toggle (only when soundscape is playing) */}
            {soundscapeUrl && isSoundscapePlaying && (
              <div className="flex items-center rounded-full p-0.5 gap-0.5 border border-gray-300 dark:border-gray-600">
                <button
                  onClick={() => handleSoundscapeModeChange('intro-only')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    preferences.soundscapeMode === 'intro-only'
                      ? 'bg-teal-500 text-white'
                      : ''
                  }`}
                  style={
                    preferences.soundscapeMode !== 'intro-only'
                      ? { color: 'var(--reader-text-secondary)' }
                      : undefined
                  }
                >
                  Intro
                </button>
                <button
                  onClick={() => handleSoundscapeModeChange('continuous')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    preferences.soundscapeMode === 'continuous'
                      ? 'bg-teal-500 text-white'
                      : ''
                  }`}
                  style={
                    preferences.soundscapeMode !== 'continuous'
                      ? { color: 'var(--reader-text-secondary)' }
                      : undefined
                  }
                >
                  Loop
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ FIXED BOTTOM NAV BAR ═══ */}
      <nav
        className="sticky bottom-0 z-40 px-4 pb-4 pt-2 safe-area-bottom"
        style={{ backgroundColor: 'var(--reader-bg)' }}
      >
        {currentPage === 1 ? (
          /* Page 1: Single next button (Duolingo cover page pattern) */
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              backgroundColor: 'var(--reader-nav-btn-bg)',
              color: 'var(--reader-nav-btn-text)',
            }}
            aria-label="Next page"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        ) : (
          /* Page 2+: Prev + Next buttons */
          <div className="flex gap-3">
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="py-4 px-6 rounded-2xl font-bold text-lg flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-40 border-2"
              style={{
                borderColor: 'var(--reader-progress-bar-bg)',
                color: 'var(--reader-text-secondary)',
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextPage}
              disabled={currentPage >= totalPages}
              className="flex-1 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
              style={{
                backgroundColor: 'var(--reader-nav-btn-bg)',
                color: 'var(--reader-nav-btn-text)',
              }}
              aria-label="Next page"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </nav>

      {/* ═══ TOAST NOTIFICATIONS ═══ */}
      <div
        className={`fixed top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div
          className="backdrop-blur text-sm px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 border"
          style={{
            backgroundColor: 'var(--reader-card-bg)',
            color: 'var(--reader-text)',
            borderColor: 'var(--reader-progress-bar-bg)',
          }}
        >
          <span>{toast}</span>
        </div>
      </div>

      {/* Progress Restored Toast */}
      <div
        className={`fixed top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-500 ${
          progressToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="bg-teal-600/90 backdrop-blur text-white text-sm px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-teal-400/30">
          <Bookmark className="w-4 h-4 text-teal-200" />
          <span className="font-medium">{progressToast}</span>
        </div>
      </div>

      {/* ═══ SETTINGS PANEL ═══ */}
      {showSettingsPanel && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettingsPanel(false)}
          />

          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-slate-900/95 backdrop-blur-md border-l border-white/10 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Narration Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">Narration</h3>
                    <p className="text-xs text-slate-400">Voice reading of the story</p>
                  </div>
                </div>

                {narrationUrl ? (
                  <div className="space-y-3 pl-[52px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Playback</span>
                      <button
                        onClick={toggleNarration}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isNarrationPlaying
                            ? "bg-orange-500 text-white"
                            : "bg-white/10 text-slate-300 hover:bg-white/20"
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
                        onChange={(e) => setNarrationVolume(Number(e.target.value) / 100)}
                        className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:appearance-none"
                      />
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Auto-play on page turn</span>
                      <button
                        onClick={() => setNarrationAutoPlay(!narrationAutoPlay)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          narrationAutoPlay ? "bg-orange-500" : "bg-white/20"
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            narrationAutoPlay ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pl-[52px]">
                    <p className="text-sm text-slate-500 italic">
                      No narration available for this page
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10" />

              {/* Soundscape Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">Soundscape</h3>
                    <p className="text-xs text-slate-400">Ambient background audio</p>
                  </div>
                </div>

                {soundscapeUrl ? (
                  <div className="space-y-3 pl-[52px]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Playback</span>
                      <button
                        onClick={toggleSoundscape}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSoundscapePlaying
                            ? "bg-teal-500 text-white"
                            : "bg-white/10 text-slate-300 hover:bg-white/20"
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
                        onChange={(e) => setSoundscapeVolume(Number(e.target.value) / 100)}
                        className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-teal-500 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:appearance-none"
                      />
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Play mode</span>
                      <div className="flex items-center bg-white/10 rounded-full p-1 gap-1">
                        <button
                          onClick={() => handleSoundscapeModeChange('intro-only')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            preferences.soundscapeMode === 'intro-only'
                              ? 'bg-teal-500 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Intro
                        </button>
                        <button
                          onClick={() => handleSoundscapeModeChange('continuous')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            preferences.soundscapeMode === 'continuous'
                              ? 'bg-teal-500 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Loop
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pl-[52px]">
                    <p className="text-sm text-slate-500 italic">
                      No soundscape available for this page
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={handleFeedbackClose}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
      />

      {/* Login Prompt */}
      <LoginPrompt
        show={showLoginPrompt && !session}
        onDismiss={() => setShowLoginPrompt(false)}
      />
    </div>
  );
}

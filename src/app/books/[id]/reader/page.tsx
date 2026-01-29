"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Sheet, SheetRef } from "react-modal-sheet";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  Bookmark,
  Mic,
  Volume2,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  ChevronDown,
  Info,
  Music,
  Loader2,
  DoorOpen,
  Waves,
} from "lucide-react";
import FeedbackModal from "@/components/FeedbackModal";
import { useLocalPreferences, SoundscapeMode } from "@/hooks/useLocalPreferences";
import { useAudioCrossFade } from "@/hooks/useAudioCrossFade";

type AudioAssignment = {
  id: string;
  audioUrl: string;
  audioType: "narration" | "soundscape";
  scope: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  volume: number | null;
};

type PageData = {
  id: string;
  pageNumber: number;
  textContent: string | null;
  imageUrl: string | null;
  narrationUrl: string | null;
  assignments: AudioAssignment[];
};

type BookData = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
};

type ReaderData = {
  book: BookData;
  pages: PageData[];
};

export default function BookReader() {
  console.log("🔵 BookReader component rendered");

  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readerData, setReaderData] = useState<ReaderData | null>(null);

  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [uiVisible, setUiVisible] = useState(false);
  const [audioExpanded, setAudioExpanded] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [textSheetOpen, setTextSheetOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Audio state
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(false);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [narrationDuration, setNarrationDuration] = useState(0);

  // Feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackEligible, setFeedbackEligible] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set<number>());
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Navigation hint state
  const [showNavigationHint, setShowNavigationHint] = useState(false);
  const [hintDismissing, setHintDismissing] = useState(false);

  // Soundscape mode state
  const [showSoundscapeMenu, setShowSoundscapeMenu] = useState(false);
  const [introFadedPages, setIntroFadedPages] = useState<Set<number>>(new Set());
  const introFadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { preferences, isLoaded: prefsLoaded, setSoundscapeMode } = useLocalPreferences();
  const { initAudioContext, connectAudioElement, fadeIn, fadeOut, setVolume } = useAudioCrossFade();
  const audioConnectedRef = useRef(false);

  // Refs
  const narrationRef = useRef<HTMLAudioElement>(null);
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const sheetRef = useRef<SheetRef>(null);

  // Get current page data
  const pageData = readerData?.pages.find((p) => p.pageNumber === currentPage);
  const totalPages = readerData?.pages.length ?? 0;

  // Get audio for current page
  const narrationAssignment = pageData?.assignments.find(
    (a) => a.audioType === "narration"
  );
  const soundscapeAssignment = pageData?.assignments.find(
    (a) => a.audioType === "soundscape"
  );
  const narrationUrl = narrationAssignment?.audioUrl || pageData?.narrationUrl;
  const soundscapeUrl = soundscapeAssignment?.audioUrl;

  // Detect if we're on mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkIsMobile();

    // Listen for window resize
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Check if user has seen navigation hints
  useEffect(() => {
    if (isMobile && !loading) {
      const hasSeenHint = localStorage.getItem('storia-nav-hint-seen');
      if (!hasSeenHint) {
        // Show hint after a brief delay
        const timer = setTimeout(() => {
          setShowNavigationHint(true);
          // Auto-dismiss after 3 seconds
          setTimeout(() => {
            setHintDismissing(true);
            setTimeout(() => {
              setShowNavigationHint(false);
              setHintDismissing(false);
              localStorage.setItem('storia-nav-hint-seen', 'true');
            }, 500);
          }, 3000);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isMobile, loading]);

  // Load book data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/api/books/${bookId}/reader`);
        if (!response.ok) {
          throw new Error("Failed to load book");
        }
        const data = await response.json();
        setReaderData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load book");
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      loadData();
    }
  }, [bookId]);

  // Check feedback eligibility on mount
  useEffect(() => {
    const checkFeedbackEligibility = async () => {
      // Check if already skipped this session
      const skippedThisSession = sessionStorage.getItem("feedback_skipped") === "true";
      if (skippedThisSession) {
        setFeedbackEligible(false);
        return;
      }

      try {
        const response = await fetch("/api/feedback/status");
        if (response.ok) {
          const data = await response.json();
          console.log("[Feedback] Eligibility response:", data);
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

  // Exit handling - check if feedback modal should be shown
  const handleExitAttempt = useCallback(
    (navigateFn: () => void) => {
      const hasViewedEnoughPages = pagesViewed.size >= 2;
      const skippedThisSession = sessionStorage.getItem("feedback_skipped") === "true";

      console.log("[Feedback Debug]", {
        feedbackEligible,
        pagesViewedCount: pagesViewed.size,
        hasViewedEnoughPages,
        skippedThisSession,
        shouldShowModal: feedbackEligible && hasViewedEnoughPages && !skippedThisSession,
      });

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

    // After successful submit, navigate away
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

  // Auto-hide UI
  const resetAutoHide = useCallback(() => {
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }
    if (uiVisible) {
      uiTimeoutRef.current = setTimeout(() => {
        setUiVisible(false);
      }, 4000);
    }
  }, [uiVisible]);

  useEffect(() => {
    resetAutoHide();
    return () => {
      if (uiTimeoutRef.current) {
        clearTimeout(uiTimeoutRef.current);
      }
    };
  }, [uiVisible, resetAutoHide]);

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
      } else if (e.key === "Escape") {
        setUiVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage]);

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextPage();
      } else {
        prevPage();
      }
    }
  };

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

    // Initialize Web Audio API on first interaction (iOS requirement)
    // Only attempt if not already connected
    if (!audioConnectedRef.current) {
      initAudioContext();
      const gainNode = connectAudioElement(soundscapeRef.current);
      if (gainNode) {
        audioConnectedRef.current = true;
      }
      // If connection failed (CORS), we'll use native volume control as fallback
    }

    if (isSoundscapePlaying) {
      if (audioConnectedRef.current) {
        // Fade out instead of abrupt pause
        fadeOut(0.5);
        setTimeout(() => {
          soundscapeRef.current?.pause();
        }, 500);
      } else {
        // Fallback: direct pause
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
    setShowSoundscapeMenu(false);
    // Reset intro faded pages when switching modes
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
          // Web Audio API available - smooth cross-fade
          fadeOut(1.0);
          setTimeout(() => {
            if (soundscapeRef.current) {
              soundscapeRef.current.src = soundscapeUrl;
              soundscapeRef.current.play();
              fadeIn(1.0, soundscapeVolume);
            }
          }, 1000);
        } else {
          // Fallback: quick volume dip for transition
          const audio = soundscapeRef.current;
          const startVolume = audio.volume;
          audio.volume = 0;
          audio.src = soundscapeUrl;
          audio.play();
          // Fade back in
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
    // Clear any existing timer
    if (introFadeTimerRef.current) {
      clearTimeout(introFadeTimerRef.current);
      introFadeTimerRef.current = null;
    }

    // Only apply intro-only logic when playing and in intro-only mode
    if (
      preferences.soundscapeMode === 'intro-only' &&
      isSoundscapePlaying &&
      soundscapeUrl &&
      !introFadedPages.has(currentPage)
    ) {
      introFadeTimerRef.current = setTimeout(() => {
        // Mark this page as having played its intro
        setIntroFadedPages((prev) => new Set(prev).add(currentPage));

        if (audioConnectedRef.current) {
          // Web Audio API available - smooth fade
          fadeOut(3.0);
          setTimeout(() => {
            if (soundscapeRef.current) {
              soundscapeRef.current.pause();
            }
            setIsSoundscapePlaying(false);
          }, 3000);
        } else {
          // Fallback: manual volume fade using native API
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
                audio.volume = startVolume; // Reset volume for next play
                setIsSoundscapePlaying(false);
              }
            }, stepDuration);
          }
        }
      }, 10000); // Play for 10 seconds before fading
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

  // Narration progress tracking
  useEffect(() => {
    const audio = narrationRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setNarrationProgress(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setNarrationDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsNarrationPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Toggle UI
  const toggleUI = () => {
    setUiVisible(!uiVisible);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          <span className="text-slate-400">Loading book...</span>
        </div>
      </div>
    );
  }

  if (error || !readerData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Book not found"}</p>
          <button
            onClick={() => handleExitAttempt(() => router.back())}
            className="text-teal-500 hover:text-teal-400"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 overflow-hidden relative selection:bg-teal-500/30 selection:text-teal-200">
      {/* Hidden Audio Elements */}
      <audio ref={narrationRef} crossOrigin="anonymous" />
      <audio ref={soundscapeRef} loop crossOrigin="anonymous" />

      {/* BACKGROUND / MAIN CONTENT LAYER */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-start h-full w-full z-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Main Image Stage */}
        <div className="relative w-full h-[65vh] md:h-[80vh] flex-shrink-0 bg-black group overflow-hidden">
          {pageData?.imageUrl ? (
            <Image
              src={pageData.imageUrl}
              alt={`Page ${currentPage} illustration`}
              fill
              className="object-cover opacity-90 transition-transform duration-[20s] ease-linear scale-100 group-hover:scale-105"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <span className="text-slate-600 text-lg">No illustration</span>
            </div>
          )}

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 via-slate-900/0 to-slate-900 pointer-events-none" />
        </div>

        {/* Desktop Text Content */}
        <div className="hidden md:flex flex-1 w-full relative z-30 -mt-32 px-4 pointer-events-none">
          <div className="max-w-2xl mx-auto h-full">
            <div className="bg-transparent p-0 max-h-none overflow-y-auto pointer-events-auto">
              {/* Text Content */}
              <div className="prose prose-invert prose-xl mx-auto font-serif leading-relaxed text-slate-300/90 pb-16">
                {pageData?.textContent ? (
                  <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-amber-500 first-letter:mr-3 first-letter:float-left whitespace-pre-wrap">
                    {pageData.textContent}
                  </p>
                ) : (
                  <p className="text-slate-500 italic">No text content</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAP TARGET OVERLAY - handles swipe and tap */}
      <div
        className="absolute inset-0 z-20 cursor-default"
        onClick={toggleUI}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Mobile Navigation Tap Zones (always visible) */}
      {currentPage > 1 && (
        <div className="md:hidden absolute inset-y-0 left-0 w-1/4 pointer-events-auto" style={{ zIndex: 25 }}>
          <button
            className="w-full h-full flex items-center justify-start pl-2 opacity-0 active:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              prevPage();
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-8 h-8 text-white/50" />
          </button>
        </div>
      )}
      {currentPage < totalPages && (
        <div className="md:hidden absolute inset-y-0 right-0 w-1/4 pointer-events-auto" style={{ zIndex: 25 }}>
          <button
            className="w-full h-full flex items-center justify-end pr-2 opacity-0 active:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              nextPage();
            }}
            aria-label="Next page"
          >
            <ChevronRight className="w-8 h-8 text-white/50" />
          </button>
        </div>
      )}

      {/* Navigation Hint Overlay - Edge Glow Style (first-time users) */}
      {showNavigationHint && isMobile && (
        <div
          className={`absolute inset-0 z-30 pointer-events-none ${
            hintDismissing ? 'animate-hint-fade-out' : ''
          }`}
        >
          {/* Left edge glow */}
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-teal-400/40 to-transparent animate-edge-glow" />
          {/* Right edge glow */}
          <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-teal-400/40 to-transparent animate-edge-glow" />

          {/* Center subtle instruction */}
          <div className="absolute inset-x-0 bottom-[55%] flex flex-col items-center">
            <span className="text-white/60 text-[10px] tracking-[0.2em] uppercase font-light bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
              Swipe or tap edges to turn
            </span>
          </div>
        </div>
      )}

      {/* Desktop Navigation Arrows (always visible) */}
      {currentPage > 1 && (
        <button
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/50 hover:text-white transition-all hover:scale-110 z-40"
          onClick={prevPage}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}
      {currentPage < totalPages && (
        <button
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/50 hover:text-white transition-all hover:scale-110 z-40"
          onClick={nextPage}
          aria-label="Next page"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}

      {/* Desktop BGM/Soundscape Toggle (desktop only) */}
      {soundscapeUrl && !isMobile && (
        <div className="absolute z-40 top-4 left-4">
          <button
            onClick={toggleSoundscape}
            className={`flex items-center justify-center gap-2 rounded-full backdrop-blur-md shadow-lg border transition-all px-4 py-2.5 ${
              isSoundscapePlaying
                ? "bg-teal-500/20 border-teal-500/50 text-teal-400"
                : "bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
            }`}
            aria-label={isSoundscapePlaying ? "Mute background music" : "Play background music"}
          >
            {isSoundscapePlaying ? (
              <div className="flex items-end gap-0.5 h-4">
                <div className="w-1 bg-teal-400 rounded-full animate-sound-wave-1" style={{ height: '60%' }} />
                <div className="w-1 bg-teal-400 rounded-full animate-sound-wave-2" style={{ height: '100%' }} />
                <div className="w-1 bg-teal-400 rounded-full animate-sound-wave-3" style={{ height: '80%' }} />
              </div>
            ) : (
              <Music className="w-5 h-5" />
            )}
            <span className="text-xs font-medium">
              {isSoundscapePlaying ? "BGM On" : "BGM Off"}
            </span>
          </button>
        </div>
      )}

      {/* Library Back Button (when UI is visible) */}
      {uiVisible && (
        <button
          onClick={() => handleExitAttempt(() => router.back())}
          className="absolute top-16 right-4 z-40 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md shadow-lg border bg-slate-900/80 border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all pointer-events-auto"
          aria-label="Exit to library"
        >
          <DoorOpen className="w-5 h-5" />
        </button>
      )}

      {/* UI CHROME LAYER */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-300 ${
          uiVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top Bar */}
        <header className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <button
            onClick={() => {
              console.log("[Click] Back button clicked");
              handleExitAttempt(() => router.back());
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="text-center">
            <h1 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">
              {readerData.book.author || "Unknown Author"}
            </h1>
            <h2 className="text-sm md:text-base font-serif text-slate-200">
              {readerData.book.title}
            </h2>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white transition-colors">
              <Bookmark className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Bottom Bar */}
        <footer className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-auto flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
         

          {/* Page Counter & Progress */}
          <div className="flex flex-col items-end gap-2 text-right md:mb-4">
            <div className="text-sm font-medium text-slate-400">
              Page <span className="text-white">{currentPage}</span> of{" "}
              {totalPages}
            </div>
            {/* Progress Bar */}
            <div className="w-32 md:w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${(currentPage / totalPages) * 100}%` }}
              />
            </div>
          </div>
        </footer>
      </div>

      {/* Persistent Mini Page Counter (Mobile) */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none md:hidden">
        <div className="bg-black/30 backdrop-blur px-3 py-1 rounded-full text-[10px] text-white/70 font-medium">
          {currentPage} / {totalPages}
        </div>
      </div>

      {/* Toast Notification */}
      <div
        className={`absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="bg-slate-800/90 backdrop-blur text-white text-sm px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 border border-white/10">
          <Info className="w-4 h-4 text-teal-400" />
          <span>{toast}</span>
        </div>
      </div>

      {/* Mobile Text Sheet - Only render on mobile */}
      {isMobile && (
        <Sheet
          ref={sheetRef}
          isOpen={textSheetOpen}
          onClose={() => setTextSheetOpen(false)}
          detent="content"
          snapPoints={[0, 0.5, 1]}
          initialSnap={2}
          disableDismiss={true}
          onSnap={(snapIndex) => {
            // If it snaps to 0 (closed position), immediately snap it back to position 1 (0.5 height)
            if (snapIndex === 0) {
              setTimeout(() => {
                sheetRef.current?.snapTo(1);
              }, 50);
            }
          }}
        >
          <Sheet.Container
            unstyled
            className="bg-slate-900/95 backdrop-blur-md shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-t-3xl"
            style={{
              backgroundColor: 'rgb(15 23 42 / 0.95)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem'
            }}
          >
            <Sheet.Header unstyled className="flex items-center justify-between px-6 pt-5 pb-2">
              {/* Minimal Drag Handle */}
              <div className="flex gap-1.5">
                <div className="w-5 h-1.5 bg-slate-700 rounded-full opacity-60" />
                <div className="w-5 h-1.5 bg-slate-700 rounded-full opacity-60" />
              </div>

              {/* Premium Soundscape Island (Glass Morphism Pill) */}
              {soundscapeUrl && (
                <button
                  onClick={toggleSoundscape}
                  className="flex items-center gap-3 py-1.5 pl-3 pr-1.5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full shadow-lg overflow-hidden transition-all hover:bg-white/10"
                >
                  {/* Activity Indicator */}
                  <div className="flex items-center gap-2">
                    <Waves className={`w-4 h-4 ${isSoundscapePlaying ? 'text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]' : 'text-slate-400'}`} />
                    {isSoundscapePlaying && (
                      <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-1" style={{ height: '6px' }} />
                        <div className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-2" style={{ height: '12px' }} />
                        <div className="w-0.5 bg-teal-400/80 rounded-full animate-sound-wave-3" style={{ height: '8px' }} />
                      </div>
                    )}
                  </div>

                  {/* Mode Toggle Pill */}
                  <div className="flex items-center bg-black/40 rounded-full p-0.5 gap-0.5 border border-white/5">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSoundscapeModeChange('intro-only');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                        preferences.soundscapeMode === 'intro-only'
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      Intro
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSoundscapeModeChange('continuous');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[9px] font-bold cursor-pointer transition-all ${
                        preferences.soundscapeMode === 'continuous'
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      Loop
                    </span>
                  </div>
                </button>
              )}
            </Sheet.Header>
            <Sheet.Content className="p-6">
              {/* Text Content */}
              <div className="prose prose-invert prose-lg mx-auto font-serif leading-relaxed text-slate-300/90 max-w-none">
                {pageData?.textContent ? (
                  <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-amber-500 first-letter:mr-3 first-letter:float-left whitespace-pre-wrap">
                    {pageData.textContent}
                  </p>
                ) : (
                  <p className="text-slate-500 italic">No text content</p>
                )}
              </div>
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop />
        </Sheet>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={handleFeedbackClose}
        onSubmit={handleFeedbackSubmit}
        onSkip={handleFeedbackSkip}
      />
    </div>
  );
}

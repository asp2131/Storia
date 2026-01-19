"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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
} from "lucide-react";

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

  // Audio state
  const [isNarrationPlaying, setIsNarrationPlaying] = useState(false);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState(true);
  const [narrationVolume, setNarrationVolume] = useState(0.85);
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.6);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [narrationDuration, setNarrationDuration] = useState(0);

  // Refs
  const narrationRef = useRef<HTMLAudioElement>(null);
  const soundscapeRef = useRef<HTMLAudioElement>(null);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);

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

    if (isSoundscapePlaying) {
      soundscapeRef.current.pause();
    } else {
      soundscapeRef.current.play();
    }
    setIsSoundscapePlaying(!isSoundscapePlaying);
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

  useEffect(() => {
    if (soundscapeRef.current && soundscapeUrl) {
      soundscapeRef.current.src = soundscapeUrl;
      if (isSoundscapePlaying) {
        soundscapeRef.current.play();
      }
    }
  }, [soundscapeUrl, isSoundscapePlaying]);

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
            onClick={() => router.back()}
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
      <audio ref={narrationRef} />
      <audio ref={soundscapeRef} loop />

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

        {/* Text Content Area */}
        <div className="flex-1 w-full relative z-10 -mt-20 md:-mt-32 px-4 md:px-0">
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-900/95 backdrop-blur-md md:bg-transparent md:backdrop-blur-none rounded-t-3xl p-6 md:p-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:shadow-none min-h-[40vh] md:min-h-0">
              {/* Mobile Handle */}
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6 md:hidden opacity-50" />

              {/* Text Content */}
              <div className="prose prose-invert prose-lg md:prose-xl mx-auto font-serif leading-relaxed text-slate-300/90">
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

      {/* TAP TARGET OVERLAY */}
      <div
        className="absolute inset-0 z-20 cursor-default"
        onClick={toggleUI}
      />

      {/* UI CHROME LAYER */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-300 ${
          uiVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top Bar */}
        <header className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <button
            onClick={() => router.back()}
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

        {/* Navigation Arrows (Desktop) */}
        {currentPage > 1 && (
          <button
            className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/50 hover:text-white transition-all pointer-events-auto hover:scale-110"
            onClick={prevPage}
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
        )}

        {currentPage < totalPages && (
          <button
            className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-16 h-16 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm text-white/50 hover:text-white transition-all pointer-events-auto hover:scale-110"
            onClick={nextPage}
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        )}

        {/* Bottom Bar */}
        <footer className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-auto flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
          {/* Audio Player */}
          <div className="w-full md:w-auto flex-1 md:flex-initial">
            {audioExpanded ? (
              /* Expanded Player Panel */
              <div className="w-full md:w-[420px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 ring-1 ring-inset ring-amber-500/20">
                      {narrationUrl ? (
                        <Mic className="w-5 h-5" />
                      ) : (
                        <Music className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                          {narrationUrl ? "Narration" : "Audio"}
                        </span>
                        {soundscapeUrl && isSoundscapePlaying && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-600" />
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                              Soundscape Active
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-white leading-tight mt-0.5">
                        Page {currentPage}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setAudioExpanded(false)}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Waveform Visualizer */}
                <div className="relative h-12 flex items-center justify-center gap-[3px] mb-4 opacity-80">
                  {[...Array(14)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all ${
                        isNarrationPlaying
                          ? "animate-pulse bg-amber-500"
                          : "bg-amber-500/30"
                      }`}
                      style={{
                        height: `${20 + Math.random() * 60}%`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}

                  {/* Time Overlay */}
                  <div className="absolute inset-0 flex items-center justify-between text-[10px] font-mono text-slate-400 pointer-events-none px-1">
                    <span>{formatTime(narrationProgress)}</span>
                    <span>{formatTime(narrationDuration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-4">
                  {/* Volume */}
                  <div className="flex items-center gap-2 group w-1/4">
                    <button className="text-slate-400 group-hover:text-white transition-colors">
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={narrationVolume * 100}
                      onChange={(e) =>
                        setNarrationVolume(Number(e.target.value) / 100)
                      }
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  {/* Playback Controls */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={prevPage}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                      onClick={toggleNarration}
                      disabled={!narrationUrl}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isNarrationPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={nextPage}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Soundscape Toggle */}
                  <div className="w-1/4 flex justify-end">
                    {soundscapeUrl && (
                      <button
                        onClick={toggleSoundscape}
                        className={`text-xs font-medium border rounded px-2 py-1 transition-colors ${
                          isSoundscapePlaying
                            ? "bg-teal-500/20 border-teal-500 text-teal-400"
                            : "border-slate-700 text-slate-400 hover:text-white"
                        }`}
                      >
                        <Music className="w-3 h-3 inline mr-1" />
                        BG
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Collapsed Badge */
              <button
                onClick={() => setAudioExpanded(true)}
                className="flex items-center gap-3 bg-slate-800/80 backdrop-blur rounded-full pl-3 pr-4 py-2 shadow-lg border border-white/5 hover:bg-slate-800 transition-colors"
              >
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-500">
                  <Mic className="w-4 h-4" />
                  {isNarrationPlaying && (
                    <span className="absolute flex h-2 w-2 top-0 right-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Audio
                  </span>
                  <span className="text-xs font-medium text-white">
                    {isNarrationPlaying ? "Playing" : "Tap to expand"}
                  </span>
                </div>
              </button>
            )}
          </div>

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
    </div>
  );
}

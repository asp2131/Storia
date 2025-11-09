"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import PageNavigation from "./PageNavigation";
import AudioPlayer from "./AudioPlayer";
import { useToast } from "./ui/ToastContainer";

interface Page {
  id: string;
  pageNumber: number;
  textContent: string;
  sceneId: string | null;
  scene: Scene | null;
}

interface Scene {
  id: string;
  startPage: number;
  endPage: number;
  pageSpreadIndex: number;
  setting: string | null;
  mood: string | null;
  descriptors: any;
  soundscapes: Soundscape[];
}

interface Soundscape {
  id: string;
  audioUrl: string;
  duration: number;
  generationPrompt: string | null;
}

interface Book {
  id: string;
  title: string;
  author: string | null;
  totalPages: number;
  pdfUrl: string;
  pages: Page[];
  scenes: Scene[];
}

interface BookReaderProps {
  book: Book;
  initialPage: number;
  userId: string;
}

export default function BookReader({ book, initialPage, userId }: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(
    Math.floor((initialPage - 1) / 2)
  );
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const flipBookRef = useRef<any>(null);
  const saveProgressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  // Audio preloading state
  const [preloadedAudio, setPreloadedAudio] = useState<Map<string, AudioBuffer>>(new Map());
  const [isPreloading, setIsPreloading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const MAX_CACHED_AUDIO = 10; // Maximum number of audio buffers to keep in memory

  // Audio error handler
  const handleAudioError = useCallback((error: Error) => {
    console.error("Audio playback error:", error);
    toast.error(`Audio error: ${error.message}`);
  }, [toast]);

  // Calculate page spread index (0-based, each spread = 2 pages)
  const getPageSpreadIndex = (pageNumber: number): number => {
    return Math.floor((pageNumber - 1) / 2);
  };

  // Save reading progress to database (debounced)
  const saveProgress = useCallback(async (page: number) => {
    try {
      setIsSavingProgress(true);
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookId: book.id,
          currentPage: page,
        }),
      });

      if (!response.ok) {
        console.error("Failed to save progress:", await response.text());
      }
    } catch (error) {
      console.error("Error saving progress:", error);
    } finally {
      setIsSavingProgress(false);
    }
  }, [book.id]);

  // Debounced progress save (2 seconds after page change)
  const debouncedSaveProgress = useCallback((page: number) => {
    // Clear existing timer
    if (saveProgressTimerRef.current) {
      clearTimeout(saveProgressTimerRef.current);
    }

    // Set new timer
    saveProgressTimerRef.current = setTimeout(() => {
      saveProgress(page);
    }, 2000);
  }, [saveProgress]);

  // Initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Preload a single audio file
  const preloadAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    try {
      // Check if already cached
      if (preloadedAudio.has(url)) {
        return preloadedAudio.get(url)!;
      }

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Cache the audio buffer
      setPreloadedAudio((prev) => {
        const newMap = new Map(prev);
        newMap.set(url, audioBuffer);
        return newMap;
      });

      return audioBuffer;
    } catch (error) {
      console.error("Error preloading audio:", url, error);
      return null;
    }
  }, [preloadedAudio, getAudioContext]);

  // Get scenes for the next N page spreads
  const getUpcomingSpreads = useCallback((fromSpreadIndex: number, count: number): Scene[] => {
    const upcomingScenes: Scene[] = [];
    const seenSceneIds = new Set<string>();

    for (let i = 0; i < count; i++) {
      const spreadIndex = fromSpreadIndex + i;
      const scene = book.scenes.find((s) => s.pageSpreadIndex === spreadIndex);
      
      if (scene && !seenSceneIds.has(scene.id)) {
        upcomingScenes.push(scene);
        seenSceneIds.add(scene.id);
      }
    }

    return upcomingScenes;
  }, [book.scenes]);

  // Preload soundscapes for upcoming spreads
  const preloadUpcomingSoundscapes = useCallback(async (fromSpreadIndex: number) => {
    setIsPreloading(true);
    
    try {
      // Get next 3 spreads (6 pages)
      const upcomingScenes = getUpcomingSpreads(fromSpreadIndex, 3);
      
      // Preload audio for each scene
      const preloadPromises = upcomingScenes.flatMap((scene) =>
        scene.soundscapes.map((soundscape) => preloadAudio(soundscape.audioUrl))
      );

      await Promise.all(preloadPromises);
      console.log(`Preloaded ${preloadPromises.length} soundscapes`);
    } catch (error) {
      console.error("Error preloading soundscapes:", error);
    } finally {
      setIsPreloading(false);
    }
  }, [getUpcomingSpreads, preloadAudio]);

  // Evict old audio buffers to manage memory
  const evictOldAudio = useCallback(() => {
    if (preloadedAudio.size > MAX_CACHED_AUDIO) {
      const entries = Array.from(preloadedAudio.entries());
      const toKeep = entries.slice(-MAX_CACHED_AUDIO);
      setPreloadedAudio(new Map(toKeep));
      console.log(`Evicted ${entries.length - toKeep.length} audio buffers from cache`);
    }
  }, [preloadedAudio]);

  // Detect scene change and save progress when page changes
  useEffect(() => {
    const spreadIndex = getPageSpreadIndex(currentPage);
    setCurrentSpreadIndex(spreadIndex);

    // Find scene for current spread
    const scene = book.scenes.find(
      (s) => s.pageSpreadIndex === spreadIndex
    );

    // Detect scene change
    if (scene && scene.id !== currentScene?.id) {
      console.log("Scene changed:", {
        from: currentScene?.id,
        to: scene.id,
        spreadIndex,
        setting: scene.setting,
        mood: scene.mood,
      });
      setCurrentScene(scene);
      // AudioPlayer will automatically crossfade when currentScene changes
    } else if (scene && scene.id === currentScene?.id) {
      // Same scene - AudioPlayer will continue current soundscape
      console.log("Same scene, continuing soundscape");
    }

    // Save reading progress (debounced)
    debouncedSaveProgress(currentPage);
  }, [currentPage, book.scenes, currentScene, debouncedSaveProgress]);

  // Preload on mount
  useEffect(() => {
    preloadUpcomingSoundscapes(currentSpreadIndex);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload on page navigation
  useEffect(() => {
    preloadUpcomingSoundscapes(currentSpreadIndex);
    evictOldAudio();
  }, [currentSpreadIndex, preloadUpcomingSoundscapes, evictOldAudio]);

  // Cleanup timer and audio context on unmount
  useEffect(() => {
    return () => {
      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePreviousPage = () => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipPrev();
    }
  };

  const handleNextPage = () => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipNext();
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= book.totalPages && flipBookRef.current) {
      // Convert to 0-based index for react-pageflip
      flipBookRef.current.pageFlip().flip(page - 1);
    }
  };

  const onFlip = useCallback((e: any) => {
    // Update current page when flip occurs (1-based)
    setCurrentPage(e.data + 1);
  }, []);

  const currentPageData = book.pages.find((p) => p.pageNumber === currentPage);
  const nextPageData = book.pages.find((p) => p.pageNumber === currentPage + 1);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/library"
              className="text-gray-400 hover:text-white transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold">{book.title}</h1>
              {book.author && (
                <p className="text-sm text-gray-400">by {book.author}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSavingProgress && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg
                  className="animate-spin h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </div>
            )}
            <div className="text-sm text-gray-400">
              Page {currentPage} of {book.totalPages}
            </div>
          </div>
        </div>
      </header>

      {/* Reader Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-center">
          <HTMLFlipBook
            ref={flipBookRef}
            width={400}
            height={600}
            size="stretch"
            minWidth={315}
            maxWidth={1000}
            minHeight={400}
            maxHeight={1533}
            showCover={true}
            flippingTime={1000}
            usePortrait={false}
            startPage={initialPage - 1}
            drawShadow={true}
            className="book-flip"
            onFlip={onFlip}
            style={{}}
            startZIndex={0}
            autoSize={true}
            maxShadowOpacity={0.5}
            showPageCorners={true}
            disableFlipByClick={false}
            clickEventForward={true}
            useMouseEvents={true}
            swipeDistance={30}
            mobileScrollSupport={true}
          >
            {book.pages.map((page) => (
              <div key={page.id} className="page">
                <div className="page-content bg-white text-gray-900 p-8 h-full overflow-auto">
                  <div className="prose prose-sm max-w-none">
                    <div className="text-xs text-gray-400 mb-4">Page {page.pageNumber}</div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {page.textContent}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </HTMLFlipBook>
        </div>

        {/* Navigation Controls */}
        <div className="mt-8">
          <PageNavigation
            currentPage={currentPage}
            totalPages={book.totalPages}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Audio Player */}
        <div className="mt-6">
          <AudioPlayer
            currentScene={currentScene}
            onAudioError={handleAudioError}
          />
        </div>
      </main>

      {/* Scene Info (for debugging) */}
      {currentScene && (
        <div className="fixed bottom-4 right-4 bg-gray-800 rounded-lg p-4 max-w-xs">
          <h3 className="text-sm font-semibold mb-2">Current Scene</h3>
          <p className="text-xs text-gray-400">
            Spread Index: {currentSpreadIndex}
          </p>
          <p className="text-xs text-gray-400">
            Setting: {currentScene.setting || "N/A"}
          </p>
          <p className="text-xs text-gray-400">
            Mood: {currentScene.mood || "N/A"}
          </p>
          <p className="text-xs text-gray-400">
            Pages: {currentScene.startPage}-{currentScene.endPage}
          </p>
          {currentScene.soundscapes.length > 0 && (
            <p className="text-xs text-green-400 mt-2">
              ✓ Soundscape available
            </p>
          )}
          <div className="mt-2 pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              Cached Audio: {preloadedAudio.size}/{MAX_CACHED_AUDIO}
            </p>
            {isPreloading && (
              <p className="text-xs text-blue-400 mt-1">
                ⏳ Preloading...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

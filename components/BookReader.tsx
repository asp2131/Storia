"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import PageNavigation from "./PageNavigation";

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
  const flipBookRef = useRef<any>(null);

  // Calculate page spread index (0-based, each spread = 2 pages)
  const getPageSpreadIndex = (pageNumber: number): number => {
    return Math.floor((pageNumber - 1) / 2);
  };

  // Detect scene change when page changes
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
      // TODO: Trigger audio crossfade here in future tasks
    }
  }, [currentPage, book.scenes, currentScene]);

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
          <div className="text-sm text-gray-400">
            Page {currentPage} of {book.totalPages}
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
        </div>
      )}
    </div>
  );
}

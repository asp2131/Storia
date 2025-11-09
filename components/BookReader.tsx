"use client";

import { useState } from "react";

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

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < book.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const currentPageData = book.pages.find((p) => p.pageNumber === currentPage);

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
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white text-gray-900 rounded-lg shadow-2xl p-12 min-h-[600px]">
          {currentPageData ? (
            <div className="prose prose-lg max-w-none">
              <div className="whitespace-pre-wrap">{currentPageData.textContent}</div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Page content not available</p>
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Previous
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Page {currentPage} of {book.totalPages}
            </span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage === book.totalPages}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Next
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </main>

      {/* Scene Info (for debugging) */}
      {currentPageData?.scene && (
        <div className="fixed bottom-4 right-4 bg-gray-800 rounded-lg p-4 max-w-xs">
          <h3 className="text-sm font-semibold mb-2">Current Scene</h3>
          <p className="text-xs text-gray-400">
            Setting: {currentPageData.scene.setting || "N/A"}
          </p>
          <p className="text-xs text-gray-400">
            Mood: {currentPageData.scene.mood || "N/A"}
          </p>
          {currentPageData.scene.soundscapes.length > 0 && (
            <p className="text-xs text-green-400 mt-2">
              ✓ Soundscape available
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";

interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageChange?: (page: number) => void;
}

export default function PageNavigation({
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  onPageChange,
}: PageNavigationProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          if (currentPage > 1) {
            onPreviousPage();
          }
          break;
        case "ArrowRight":
        case "ArrowDown":
        case " ": // Spacebar
          event.preventDefault();
          if (currentPage < totalPages) {
            onNextPage();
          }
          break;
        case "Home":
          event.preventDefault();
          if (onPageChange && currentPage !== 1) {
            onPageChange(1);
          }
          break;
        case "End":
          event.preventDefault();
          if (onPageChange && currentPage !== totalPages) {
            onPageChange(totalPages);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, onPreviousPage, onNextPage, onPageChange]);

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div className="flex items-center justify-between">
      {/* Previous Button */}
      <button
        onClick={onPreviousPage}
        disabled={isFirstPage}
        className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group"
        aria-label="Previous page"
      >
        <svg
          className="w-5 h-5 transition-transform group-hover:-translate-x-1"
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
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Page Counter */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Page</span>
          <span className="text-lg font-semibold text-white">
            {currentPage}
          </span>
          <span className="text-sm text-gray-400">of</span>
          <span className="text-lg font-semibold text-gray-300">
            {totalPages}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Use arrow keys to navigate
        </div>
      </div>

      {/* Next Button */}
      <button
        onClick={onNextPage}
        disabled={isLastPage}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group"
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <svg
          className="w-5 h-5 transition-transform group-hover:translate-x-1"
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
  );
}

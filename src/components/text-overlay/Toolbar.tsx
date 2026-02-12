"use client";

import React from "react";

export interface ToolbarProps {
  onAddElement: () => void;
  onSave: () => void;
  onComposite: () => void;
  isSaving: boolean;
  isCompositing: boolean;
  hasChanges: boolean;
  isStale: boolean; // overlay modified after last composite
  hasOverlay: boolean;
  hasBaseImage: boolean;
  compositedAt: string | null;
}

/**
 * Format an ISO timestamp into a human-readable relative time.
 */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function Toolbar({
  onAddElement,
  onSave,
  onComposite,
  isSaving,
  isCompositing,
  hasChanges,
  isStale,
  hasOverlay,
  hasBaseImage,
  compositedAt,
}: ToolbarProps) {
  const canSave = hasChanges && !isSaving;
  const canComposite = hasOverlay && hasBaseImage && !isCompositing;

  // Determine save button state
  const saveButtonDisabled = !canSave;
  const saveButtonClass = saveButtonDisabled
    ? "bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed"
    : "bg-gray-100 hover:bg-gray-200 text-gray-700";

  // Determine composite button state
  const compositeButtonDisabled = !canComposite;
  let compositeButtonClass: string;

  if (compositeButtonDisabled) {
    compositeButtonClass =
      "bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed";
  } else if (isStale) {
    compositeButtonClass =
      "bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300";
  } else {
    compositeButtonClass = "bg-gray-100 hover:bg-gray-200 text-gray-700";
  }

  // Determine status indicator
  let statusElement: React.ReactNode;

  if (isStale) {
    statusElement = (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-600 border border-red-200">
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Stale - recomposite needed
      </span>
    );
  } else if (hasChanges) {
    statusElement = (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-600 border border-amber-200">
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Unsaved changes
      </span>
    );
  } else if (compositedAt && !isStale) {
    statusElement = (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-600 border border-green-200">
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Composited {formatRelativeTime(compositedAt)}
      </span>
    );
  } else if (!hasChanges) {
    statusElement = (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-600 border border-green-200">
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Saved
      </span>
    );
  }

  return (
    <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
      {/* Left side: Add Text button */}
      <div className="flex items-center">
        <button
          onClick={onAddElement}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          type="button"
        >
          <svg
            className="w-5 h-5 mr-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Text
        </button>
      </div>

      {/* Right side: Status indicators and action buttons */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        {statusElement}

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={saveButtonDisabled}
          className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${saveButtonClass}`}
          type="button"
        >
          {isSaving ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
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
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              Save
            </>
          )}
        </button>

        {/* Composite button */}
        <button
          onClick={onComposite}
          disabled={compositeButtonDisabled}
          className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${compositeButtonClass}`}
          type="button"
        >
          {isCompositing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
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
              Compositing...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Composite
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default Toolbar;

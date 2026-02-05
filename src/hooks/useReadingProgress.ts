"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";

// Types
export type ReadingProgress = {
  currentPage: number;
  totalPages: number;
  lastReadAt: string;
  progressPercent: number;
};

type SaveProgressInput = {
  bookId: string;
  currentPage: number;
  totalPages: number;
};

type LocalStorageProgress = {
  currentPage: number;
  totalPages: number;
  lastReadAt: string;
};

// ============ LOCAL STORAGE HELPERS ============

const getLocalStorageKey = (bookId: string) => `reading_progress_${bookId}`;

export function loadProgressFromLocalStorage(
  bookId: string
): LocalStorageProgress | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getLocalStorageKey(bookId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as LocalStorageProgress;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgressToLocalStorage(
  bookId: string,
  progress: Omit<LocalStorageProgress, "lastReadAt">
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getLocalStorageKey(bookId);
    const data: LocalStorageProgress = {
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
      lastReadAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function clearProgressFromLocalStorage(bookId: string): void {
  if (typeof window === "undefined") return;

  try {
    const key = getLocalStorageKey(bookId);
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

// ============ QUERY HOOKS ============

/**
 * Fetch reading progress for a book
 */
export function useReadingProgress(bookId: string) {
  return useQuery({
    queryKey: ["reading-progress", bookId],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");

      const response = await fetch(
        `/api/reading-progress?bookId=${encodeURIComponent(bookId)}`
      );

      if (!response.ok) {
        throw new Error("Failed to load reading progress");
      }

      const data = await response.json();
      return data as ReadingProgress;
    },
    enabled: !!bookId,
  });
}

/**
 * Save reading progress mutation
 */
export function useSaveProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveProgressInput) => {
      const response = await fetch("/api/reading-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to save reading progress");
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the reading progress query for this book
      queryClient.invalidateQueries({
        queryKey: ["reading-progress", variables.bookId],
      });
    },
  });
}

// ============ AUTO-SAVE HOOK ============

type AutoSaveProgressOptions = {
  bookId: string;
  currentPage: number;
  totalPages: number;
  isAuthenticated?: boolean;
  enabled?: boolean;
};

/**
 * Auto-save reading progress with debouncing
 * Saves to API if authenticated, otherwise saves to localStorage
 */
export function useAutoSaveProgress({
  bookId,
  currentPage,
  totalPages,
  isAuthenticated,
  enabled = true,
}: AutoSaveProgressOptions): void {
  const saveProgressMutation = useSaveProgress();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<{ page: number; bookId: string } | null>(null);

  const saveProgress = useCallback(() => {
    // Skip if nothing has changed
    if (
      lastSavedRef.current?.page === currentPage &&
      lastSavedRef.current?.bookId === bookId
    ) {
      return;
    }

    if (isAuthenticated) {
      // Save to API
      saveProgressMutation.mutate({
        bookId,
        currentPage,
        totalPages,
      });
    } else {
      // Save to localStorage for anonymous users
      saveProgressToLocalStorage(bookId, { currentPage, totalPages });
    }

    lastSavedRef.current = { page: currentPage, bookId };
  }, [bookId, currentPage, totalPages, isAuthenticated, saveProgressMutation]);

  useEffect(() => {
    if (!enabled || !bookId || currentPage <= 0 || totalPages <= 0) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up debounced save (2 second delay)
    timeoutRef.current = setTimeout(() => {
      saveProgress();
    }, 2000);

    // Cleanup on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [bookId, currentPage, totalPages, enabled, saveProgress]);

  // Save immediately on unmount if there are pending changes
  useEffect(() => {
    return () => {
      if (
        enabled &&
        bookId &&
        currentPage > 0 &&
        totalPages > 0 &&
        (lastSavedRef.current?.page !== currentPage ||
          lastSavedRef.current?.bookId !== bookId)
      ) {
        // Attempt immediate save on unmount
        if (isAuthenticated) {
          // Use sendBeacon for reliable delivery on page unload
          const data = JSON.stringify({ bookId, currentPage, totalPages });
          navigator.sendBeacon?.(
            "/api/reading-progress",
            new Blob([data], { type: "application/json" })
          );
        } else {
          saveProgressToLocalStorage(bookId, { currentPage, totalPages });
        }
      }
    };
  }, [bookId, currentPage, totalPages, enabled, isAuthenticated]);
}

/**
 * Convenience hook that combines useSession with useAutoSaveProgress
 * Automatically determines authentication status from session
 */
export function useAutoSaveProgressWithAuth(
  options: Omit<AutoSaveProgressOptions, "isAuthenticated">
): void {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  useAutoSaveProgress({
    ...options,
    isAuthenticated,
  });
}

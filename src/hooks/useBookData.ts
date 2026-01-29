import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

export type AudioAssignment = {
  id: string;
  audioUrl: string;
  audioType: "narration" | "soundscape";
  scope: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  volume: number | null;
};

export type PageData = {
  id: string;
  pageNumber: number;
  textContent: string | null;
  imageUrl: string | null;
  narrationUrl: string | null;
  narrationTimestamps: WordTimestamp[] | null;
  assignments?: AudioAssignment[];
};

export type BookData = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
};

// ============ EDITOR HOOKS ============

/**
 * Fetch book metadata for editor
 */
export function useBookDetails(bookId: string | null) {
  return useQuery({
    queryKey: ["book-details", bookId],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");
      const response = await fetch(`/api/admin/books/${bookId}`);
      if (!response.ok) throw new Error("Failed to load book");
      const data = await response.json();
      return data.book as BookData & { totalPages: number };
    },
    enabled: !!bookId,
  });
}

/**
 * Fetch pages for editor
 */
export function useEditorPages(bookId: string | null) {
  return useQuery({
    queryKey: ["editor-pages", bookId],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");
      const response = await fetch(`/api/admin/books/${bookId}/pages`);
      if (!response.ok) throw new Error("Failed to load pages");
      const data = await response.json();
      return data.pages as PageData[];
    },
    enabled: !!bookId,
  });
}

/**
 * Fetch audio assignments for a specific page
 */
export function useAudioAssignments(bookId: string | null, pageNumber: number) {
  return useQuery({
    queryKey: ["audio-assignments", bookId, pageNumber],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");
      const response = await fetch(
        `/api/admin/audio-assignments?bookId=${bookId}&pageNumber=${pageNumber}`
      );
      if (!response.ok) throw new Error("Failed to load assignments");
      const data = await response.json();
      return data.assignments as AudioAssignment[];
    },
    enabled: !!bookId,
  });
}

/**
 * Generate narration for a page
 */
export function useGenerateNarration(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      text,
      pageNumber,
      voice,
    }: {
      text: string;
      pageNumber: number;
      voice?: string;
    }) => {
      if (!bookId) throw new Error("No book ID");

      const response = await fetch("/api/admin/generate-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, bookId, pageNumber, voice }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to generate narration");
      }

      return response.json() as Promise<{
        url: string;
        path: string;
        wordTimestamps: WordTimestamp[];
        alignmentQuality?: number;
        timestampsUrl?: string;
      }>;
    },
    onSuccess: (data, variables) => {
      // Update editor pages cache with new narration data
      queryClient.setQueryData(
        ["editor-pages", bookId],
        (oldPages: PageData[] | undefined) => {
          if (!oldPages) return oldPages;
          return oldPages.map((page) =>
            page.pageNumber === variables.pageNumber
              ? {
                  ...page,
                  narrationUrl: data.url,
                  narrationTimestamps: data.wordTimestamps,
                }
              : page
          );
        }
      );

      // Also invalidate assignments to refetch
      queryClient.invalidateQueries({
        queryKey: ["audio-assignments", bookId, variables.pageNumber],
      });
    },
  });
}

/**
 * Assign audio to a page
 */
export function useAssignAudio(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      audioUrl,
      audioType,
      scope,
      rangeStart,
      rangeEnd,
    }: {
      pageId: string;
      audioUrl: string;
      audioType: "narration" | "soundscape";
      scope: "single" | "range";
      rangeStart?: number | null;
      rangeEnd?: number | null;
    }) => {
      const response = await fetch("/api/admin/audio-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          audioUrl,
          audioType,
          scope,
          rangeStart,
          rangeEnd,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to assign audio");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all audio assignments for this book
      queryClient.invalidateQueries({
        queryKey: ["audio-assignments", bookId],
      });
    },
  });
}

/**
 * Delete an audio assignment
 */
export function useDeleteAudioAssignment(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      pageId,
      audioType,
    }: {
      assignmentId?: string;
      pageId?: string;
      audioType?: "narration" | "soundscape";
    }) => {
      const params = new URLSearchParams();
      if (assignmentId) {
        params.set("id", assignmentId);
      } else if (pageId && audioType) {
        params.set("pageId", pageId);
        params.set("audioType", audioType);
      } else {
        throw new Error("Must provide assignmentId or pageId+audioType");
      }

      const response = await fetch(`/api/admin/audio-assignments?${params}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to delete assignment");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate audio assignments to refetch
      queryClient.invalidateQueries({
        queryKey: ["audio-assignments", bookId],
      });
      // Also invalidate editor pages to update narration URL
      queryClient.invalidateQueries({
        queryKey: ["editor-pages", bookId],
      });
    },
  });
}

/**
 * Save pages (update text/images)
 */
export function useSavePages(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      pages: Array<{
        pageNumber: number;
        textContent?: string | null;
        imageUrl?: string | null;
      }>
    ) => {
      if (!bookId) throw new Error("No book ID");

      const response = await fetch(`/api/admin/books/${bookId}/pages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to save pages");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate pages to refetch with any server-side changes
      queryClient.invalidateQueries({
        queryKey: ["editor-pages", bookId],
      });
    },
  });
}

/**
 * Update book metadata
 */
export function useUpdateBook(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title?: string;
      author?: string;
      isPublished?: boolean;
      processingStatus?: string;
    }) => {
      if (!bookId) throw new Error("No book ID");

      const response = await fetch(`/api/admin/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to update book");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["book-details", bookId],
      });
    },
  });
}

// ============ READER HOOKS ============

/**
 * Fetch complete reader data (book + pages + assignments)
 */
export function useReaderData(bookId: string | null) {
  return useQuery({
    queryKey: ["reader-data", bookId],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");
      const response = await fetch(`/api/books/${bookId}/reader`);
      if (!response.ok) throw new Error("Failed to load book");
      const data = await response.json();
      return data as {
        book: BookData;
        pages: PageData[];
      };
    },
    enabled: !!bookId,
    staleTime: 60 * 1000, // Reader data can be stale longer
  });
}

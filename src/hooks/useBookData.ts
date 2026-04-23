import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WordPronunciationEntry } from "@/lib/pronunciation";
import type { TextOverlayConfig } from "@/types/text-overlay";

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

export type VoiceSettings = {
  speed: number;
  style: number;
  useSpeakerBoost: boolean;
};

export type OverlayNarrationTrack = {
  id: string;
  overlayElementId: string;
  voiceId: string;
  voiceName: string | null;
  audioUrl: string;
  sortOrder: number;
  wordTimestamps: WordTimestamp[] | null;
};

export type PronunciationCoverageStatus =
  | "empty"
  | "missing"
  | "partial"
  | "complete";

export type PronunciationReviewCoverageStatus =
  | "missing"
  | "full-word-only"
  | "covered";

export type PronunciationReviewStatus =
  | "missing"
  | "generated"
  | "failed"
  | "reviewed";

export type PronunciationCoverageRow = {
  pageId: string;
  pageNumber: number;
  total: number;
  covered: number;
  fullWordOnly?: number;
  missing: number;
  missingWords?: string[];
  status?: PronunciationCoverageStatus;
};

export type PronunciationReviewRow = {
  normalizedWord: string;
  displayWord: string;
  occurrences: number;
  pageIds: string[];
  pageNumbers: number[];
  coverageStatus: PronunciationReviewCoverageStatus;
  reviewStatus: PronunciationReviewStatus;
  humanReviewed: boolean;
  audio: {
    fullWord?: string;
    breakdown?: string;
  };
  source?: "override" | "lexicon" | "tts";
  confidence?: number;
  generatedAt?: string;
  status?: "generated" | "failed" | "reviewed";
};

export type PronunciationCoverageSummary = {
  uniqueBookTokens: number;
  coveredBookWide: number;
  missingBookWide: number;
  ratio: number;
  pagesTotal: number;
  pagesComplete: number;
  pagesPartial: number;
  pagesEmpty: number;
  pagesWithMissing: number;
  fullCoverage: boolean;
};

export type PronunciationCoverageSnapshot = {
  uniqueBookTokens: number;
  coveredBookWide: number;
  ratio: number;
  perPage: PronunciationCoverageRow[];
};

export type PronunciationCoverageReport = {
  bookId: string;
  coverage: PronunciationCoverageSnapshot;
  summary: PronunciationCoverageSummary;
};

export type PronunciationGenerationResult = {
  bookId: string;
  voice: { id: string; name: string };
  request: {
    force: boolean;
    maxWords: number | null;
  };
  stats: {
    generated: number;
    failed: number;
    withBreakdown: number;
    skippedExisting: number;
  };
  coverage: PronunciationCoverageSnapshot;
  summary: PronunciationCoverageSummary & {
    requestedTokens: number;
    remainingTokensAfterRun: number;
    limitedByMaxWords: boolean;
  };
  force: boolean;
};

export type PronunciationReviewResponse = {
  bookId: string;
  filters: {
    search: string | null;
    pageNumber: number | null;
    coverageStatus: PronunciationReviewCoverageStatus | null;
    reviewStatus: PronunciationReviewStatus | null;
    limit: number | null;
    offset: number;
  };
  review: {
    items: PronunciationReviewRow[];
    filteredTotal: number;
    summary: {
      totalWords: number;
      coveredWords: number;
      fullWordOnlyWords: number;
      missingWords: number;
      generatedWords: number;
      reviewedWords: number;
      failedWords: number;
    };
  };
};

export type PageData = {
  id: string;
  pageNumber: number;
  textContent: string | null;
  imageUrl: string | null;
  narrationUrl: string | null;
  narrationTimestamps: WordTimestamp[] | null;
  wordPronunciations: Record<string, WordPronunciationEntry> | null;
  compositedImageUrl: string | null;
  overlay: TextOverlayConfig | null;
  assignments?: AudioAssignment[];
  overlayNarrations?: OverlayNarrationTrack[];
};

export type BookData = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
  hasPronunciations?: boolean;
  pronunciationManifestUrl?: string | null;
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
export function usePronunciationCoverage(bookId: string | null) {
  return useQuery({
    queryKey: ["pronunciation-coverage", bookId],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");
      const response = await fetch(`/api/admin/books/${bookId}/pronunciations/generate`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load pronunciation coverage");
      }
      return response.json() as Promise<PronunciationCoverageReport>;
    },
    enabled: !!bookId,
  });
}

export function useGenerateBookPronunciations(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      voice,
      voiceSettings,
      force = false,
      maxWords,
    }: {
      voice?: string;
      voiceSettings?: VoiceSettings;
      force?: boolean;
      maxWords?: number;
    }) => {
      if (!bookId) throw new Error("No book ID");

      const response = await fetch(`/api/admin/books/${bookId}/pronunciations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, voiceSettings, force, maxWords }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to generate pronunciations");
      }

      return response.json() as Promise<PronunciationGenerationResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pronunciation-coverage", bookId] });
      queryClient.invalidateQueries({ queryKey: ["pronunciation-review", bookId] });
      queryClient.invalidateQueries({ queryKey: ["editor-pages", bookId] });
      queryClient.invalidateQueries({ queryKey: ["reader-data", bookId] });
    },
  });
}

export function usePronunciationReview(
  bookId: string | null,
  filters?: {
    search?: string;
    pageNumber?: number;
    coverageStatus?: PronunciationReviewCoverageStatus;
    reviewStatus?: PronunciationReviewStatus;
    limit?: number;
    offset?: number;
  }
) {
  return useQuery({
    queryKey: ["pronunciation-review", bookId, filters ?? {}],
    queryFn: async () => {
      if (!bookId) throw new Error("No book ID");

      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (typeof filters?.pageNumber === "number") {
        params.set("pageNumber", String(filters.pageNumber));
      }
      if (filters?.coverageStatus) {
        params.set("coverageStatus", filters.coverageStatus);
      }
      if (filters?.reviewStatus) {
        params.set("reviewStatus", filters.reviewStatus);
      }
      if (typeof filters?.limit === "number") {
        params.set("limit", String(filters.limit));
      }
      if (typeof filters?.offset === "number") {
        params.set("offset", String(filters.offset));
      }

      const query = params.toString();
      const response = await fetch(
        `/api/admin/books/${bookId}/pronunciations${query ? `?${query}` : ""}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to load pronunciation review data");
      }
      return response.json() as Promise<PronunciationReviewResponse>;
    },
    enabled: !!bookId,
  });
}

export function useGenerateNarration(bookId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      text,
      pageNumber,
      voice,
      voiceSettings,
    }: {
      text: string;
      pageNumber: number;
      voice?: string;
      voiceSettings?: VoiceSettings;
    }) => {
      if (!bookId) throw new Error("No book ID");

      const response = await fetch("/api/admin/generate-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, bookId, pageNumber, voice, voiceSettings }),
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
        wordPronunciations?: Record<string, WordPronunciationEntry>;
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
    onMutate: async ({ pageId, audioType }) => {
      await queryClient.cancelQueries({ queryKey: ["audio-assignments", bookId] });
      const previous = queryClient.getQueryData<Array<{ pageId: string; audioType: string }>>(["audio-assignments", bookId]);
      if (previous && pageId && audioType) {
        queryClient.setQueryData(
          ["audio-assignments", bookId],
          previous.filter((a) => !(a.pageId === pageId && a.audioType === audioType))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["audio-assignments", bookId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["audio-assignments", bookId],
      });
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
        id?: string;
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

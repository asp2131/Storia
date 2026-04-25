import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  manifestToWordPronunciationMap,
  type PublishedPronunciationPlaybackMode,
  type ReaderPronunciationManifest,
  type WordPronunciationMap,
} from "@/lib/pronunciation";

export type PronunciationManifestResult =
  | {
      status: "present";
      entries: WordPronunciationMap;
      bookId: string;
      locale?: string;
      defaultPlaybackMode?: PublishedPronunciationPlaybackMode;
    }
  | { status: "absent" }
  | { status: "error"; cause?: unknown }
  | { status: "loading" };

export function usePronunciationManifest(opts: {
  bookId: string | null | undefined;
  hasPronunciations: boolean | undefined;
  pronunciationManifestUrl: string | null | undefined;
}): PronunciationManifestResult {
  const { bookId, hasPronunciations, pronunciationManifestUrl } = opts;

  const enabled =
    !!bookId &&
    hasPronunciations === true &&
    typeof pronunciationManifestUrl === "string" &&
    pronunciationManifestUrl.length > 0;

  const query = useQuery<ReaderPronunciationManifest, Error>({
    queryKey: ["pronunciation-manifest", bookId],
    queryFn: async () => {
      const response = await fetch(pronunciationManifestUrl as string);
      if (!response.ok) {
        throw new Error(
          `Pronunciation manifest fetch failed: ${response.status} ${response.statusText}`
        );
      }
      return response.json() as Promise<ReaderPronunciationManifest>;
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Memoize the derived map so its reference is stable across renders.
  // Otherwise the reader's reset effect re-fires every render and kills
  // any in-flight pronunciation playback.
  const entries = useMemo(
    () => (query.data ? manifestToWordPronunciationMap(query.data) : null),
    [query.data]
  );

  if (!enabled) {
    return { status: "absent" };
  }

  if (query.isLoading || query.isPending) {
    return { status: "loading" };
  }

  if (query.isError || !query.data || !entries) {
    return { status: "error", cause: query.error };
  }

  return {
    status: "present",
    bookId: query.data.bookId,
    locale: "locale" in query.data ? query.data.locale : undefined,
    defaultPlaybackMode:
      "defaultPlaybackMode" in query.data
        ? query.data.defaultPlaybackMode
        : undefined,
    entries,
  };
}

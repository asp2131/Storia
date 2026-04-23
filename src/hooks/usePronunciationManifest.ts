import { useQuery } from "@tanstack/react-query";
import type { Manifest, ManifestEntry } from "@/app/api/books/[id]/pronunciations/route";

export type PronunciationManifestResult =
  | { status: "present"; entries: Record<string, ManifestEntry>; bookId: string }
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

  const query = useQuery<Manifest, Error>({
    queryKey: ["pronunciation-manifest", bookId],
    queryFn: async () => {
      const response = await fetch(pronunciationManifestUrl as string);
      if (!response.ok) {
        throw new Error(
          `Pronunciation manifest fetch failed: ${response.status} ${response.statusText}`
        );
      }
      return response.json() as Promise<Manifest>;
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!enabled) {
    return { status: "absent" };
  }

  if (query.isLoading || query.isPending) {
    return { status: "loading" };
  }

  if (query.isError || !query.data) {
    return { status: "error", cause: query.error };
  }

  return {
    status: "present",
    bookId: query.data.bookId,
    entries: query.data.entries,
  };
}

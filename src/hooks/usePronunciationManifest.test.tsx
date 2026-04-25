import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePronunciationManifest } from "@/hooks/usePronunciationManifest";
import type {
  BookPronunciationManifest,
  LegacyBookPronunciationManifest,
} from "@/lib/pronunciation";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

const BOOK_ID = "42";
const MANIFEST_URL = `/api/books/${BOOK_ID}/pronunciations`;

const SAMPLE_MANIFEST: BookPronunciationManifest = {
  bookId: BOOK_ID,
  version: 1,
  locale: "en-US",
  defaultPlaybackMode: "breakdown_then_word",
  entries: {
    adventure: {
      id: `${BOOK_ID}:adventure`,
      normalizedWord: "adventure",
      displayWord: "Adventure",
      source: "tts",
      confidence: 0.9,
      humanReviewed: false,
      status: "generated",
      updatedAt: "2026-04-23T00:00:00Z",
      audio: {
        fullWord: { url: "/full.mp3" },
        breakdown: { url: "/break.mp3" },
      },
    },
    cat: {
      id: `${BOOK_ID}:cat`,
      normalizedWord: "cat",
      humanReviewed: false,
      updatedAt: "2026-04-23T00:00:00Z",
      audio: {
        fullWord: { url: "/cat-full.mp3" },
      },
    },
  },
};

describe("usePronunciationManifest", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: QueryClient;

  beforeEach(() => {
    client = freshClient();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    client.clear();
  });

  it("returns absent when pronunciation data is unavailable", () => {
    const { result } = renderHook(
      () =>
        usePronunciationManifest({
          bookId: BOOK_ID,
          hasPronunciations: false,
          pronunciationManifestUrl: null,
        }),
      { wrapper: makeWrapper(client) }
    );

    expect(result.current.status).toBe("absent");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns present with manifest entries after a successful fetch", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_MANIFEST,
    });

    const { result } = renderHook(
      () =>
        usePronunciationManifest({
          bookId: BOOK_ID,
          hasPronunciations: true,
          pronunciationManifestUrl: MANIFEST_URL,
        }),
      { wrapper: makeWrapper(client) }
    );

    await waitFor(() => {
      expect(result.current.status).toBe("present");
    });

    expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL);
    if (result.current.status === "present") {
      expect(result.current.bookId).toBe(BOOK_ID);
      expect(result.current.locale).toBe("en-US");
      expect(result.current.defaultPlaybackMode).toBe("breakdown_then_word");
      expect(result.current.entries).toEqual({
        adventure: {
          fullWord: "/full.mp3",
          breakdown: "/break.mp3",
          source: "tts",
          confidence: 0.9,
          status: "generated",
          generatedAt: "2026-04-23T00:00:00Z",
        },
        cat: {
          fullWord: "/cat-full.mp3",
          generatedAt: "2026-04-23T00:00:00Z",
        },
      });
    }
  });

  it("normalizes legacy manifest entries into the reader storage shape", async () => {
    const legacyManifest: LegacyBookPronunciationManifest = {
      bookId: BOOK_ID,
      version: 1,
      entries: {
        adventure: {
          word: "adventure",
          fullWord: "/legacy-full.mp3",
          breakdown: "/legacy-break.mp3",
        },
        cat: {
          word: "cat",
          fullWord: "/legacy-cat.mp3",
        },
      },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => legacyManifest,
    });

    const { result } = renderHook(
      () =>
        usePronunciationManifest({
          bookId: BOOK_ID,
          hasPronunciations: true,
          pronunciationManifestUrl: MANIFEST_URL,
        }),
      { wrapper: makeWrapper(client) }
    );

    await waitFor(() => {
      expect(result.current.status).toBe("present");
    });

    if (result.current.status === "present") {
      expect(result.current.entries).toEqual({
        adventure: {
          fullWord: "/legacy-full.mp3",
          breakdown: "/legacy-break.mp3",
        },
        cat: {
          fullWord: "/legacy-cat.mp3",
        },
      });
      expect(result.current.defaultPlaybackMode).toBeUndefined();
      expect(result.current.locale).toBeUndefined();
    }
  });

  it("returns error when manifest fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(
      () =>
        usePronunciationManifest({
          bookId: BOOK_ID,
          hasPronunciations: true,
          pronunciationManifestUrl: MANIFEST_URL,
        }),
      { wrapper: makeWrapper(client) }
    );

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    if (result.current.status === "error") {
      expect(result.current.cause).toBeInstanceOf(Error);
    }
  });

  it("returns error when manifest fetch responds with a non-ok status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(
      () =>
        usePronunciationManifest({
          bookId: BOOK_ID,
          hasPronunciations: true,
          pronunciationManifestUrl: MANIFEST_URL,
        }),
      { wrapper: makeWrapper(client) }
    );

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    if (result.current.status === "error") {
      expect(result.current.cause).toBeInstanceOf(Error);
      expect((result.current.cause as Error).message).toContain(
        "Pronunciation manifest fetch failed: 500 Internal Server Error"
      );
    }
  });
});

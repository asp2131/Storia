import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePronunciationManifest } from "@/hooks/usePronunciationManifest";
import type { Manifest } from "@/app/api/books/[id]/pronunciations/route";

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

const SAMPLE_MANIFEST: Manifest = {
  bookId: BOOK_ID,
  version: 1,
  entries: {
    adventure: { word: "adventure", fullWord: "/full.mp3", breakdown: "/break.mp3" },
    cat: { word: "cat", fullWord: "/cat-full.mp3" },
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
      expect(result.current.entries).toEqual(SAMPLE_MANIFEST.entries);
    }
  });

  it("returns error when manifest fetch fails", async () => {
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
});

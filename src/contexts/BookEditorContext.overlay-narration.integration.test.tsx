import { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookEditorProvider, useNarrationContext } from "@/contexts/BookEditorContext";
import {
  destroyOverlayEditorStore,
  getOverlayEditorStore,
} from "@/stores/overlayEditorRegistry";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const assignAudioMutateAsync = vi.fn().mockResolvedValue({});
const generateNarrationMutateAsync = vi.fn().mockResolvedValue({});

const pageWithMixedVoices = {
  id: "saved-1",
  pageNumber: 1,
  textContent: "Hello world",
  imageUrl: "https://example.com/1.png",
  narrationUrl: null,
  narrationTimestamps: null,
  wordPronunciations: null,
  compositedImageUrl: null,
  overlay: {
    version: 1,
    elements: [
      {
        id: "el-1",
        text: "Hello moon",
        x: 10,
        y: 10,
        width: 30,
        fontFamily: "Inter",
        fontSize: 5,
        fontWeight: 400,
        color: "#000000",
        textAlign: "left",
        rotation: 0,
        voiceId: "voice-1",
        voiceName: "Voice 1",
      },
      {
        id: "el-2",
        text: "Bright stars",
        x: 10,
        y: 20,
        width: 30,
        fontFamily: "Inter",
        fontSize: 5,
        fontWeight: 400,
        color: "#000000",
        textAlign: "left",
        rotation: 0,
      },
    ],
  },
  assignments: [],
};

let mockEditorPages = [pageWithMixedVoices];

vi.mock("@/hooks/useBookData", () => {
  const bookDetailsResult = {
    data: { id: "book-1", title: "Test Book", author: "Author", totalPages: 1 },
    isLoading: false,
  };
  const audioAssignmentsResult = { data: [] };

  return {
    useBookDetails: () => bookDetailsResult,
    useEditorPages: () => ({ data: mockEditorPages, isLoading: false }),
    useAudioAssignments: () => audioAssignmentsResult,
    useGenerateNarration: () => ({
      isPending: false,
      mutateAsync: generateNarrationMutateAsync,
    }),
    useAssignAudio: () => ({
      isPending: false,
      mutateAsync: assignAudioMutateAsync,
    }),
    useDeleteAudioAssignment: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useSavePages: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useUpdateBook: () => ({ isPending: false, mutateAsync: vi.fn() }),
  };
});

vi.mock("@/hooks/useSoundLibrary", () => {
  const soundLibraryResult = { data: { categories: {} }, isLoading: false };
  const uploadMutationResult = {
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ url: "" }),
  };

  return {
    useSoundLibrary: () => soundLibraryResult,
    useUploadAudio: () => uploadMutationResult,
  };
});

type NarrationCtx = ReturnType<typeof useNarrationContext>;

function CaptureNarrationContext({ onUpdate }: { onUpdate: (ctx: NarrationCtx) => void }) {
  const ctx = useNarrationContext();

  useEffect(() => {
    onUpdate(ctx);
  }, [ctx, onUpdate]);

  return null;
}

describe("BookEditor overlay narration integration", () => {
  beforeEach(() => {
    assignAudioMutateAsync.mockClear();
    generateNarrationMutateAsync.mockClear();
    mockEditorPages = [pageWithMixedVoices];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url === "/api/elevenlabs/voices") {
          return {
            ok: true,
            json: async () => ({ voices: [{ id: "voice-1", name: "Voice 1" }] }),
          } as Response;
        }

        if (url === "/api/admin/generate-overlay-narration") {
          const body = JSON.parse(String(init?.body || "{}"));

          const base = {
            ok: true,
            json: async () => ({
              pageId: "saved-1",
              tracks: [
                {
                  audioUrl: "https://example.com/track.mp3",
                  wordTimestamps: [{ word: "hello", start: 0, end: 0.2 }],
                },
              ],
              stitchedUrl: body.updatePageNarration === false
                ? null
                : "https://example.com/stitched.mp3",
              combinedTimestamps: [{ word: "hello", start: 0, end: 0.2 }],
            }),
          } as Response;

          return base;
        }

        throw new Error(`Unhandled fetch URL in test: ${url}`);
      }) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    destroyOverlayEditorStore("saved-1");
  });

  it("sends all non-empty overlay elements (including unvoiced) for page narration generation", async () => {
    const narrationRef = { current: null as NarrationCtx | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CaptureNarrationContext onUpdate={(ctx) => { narrationRef.current = ctx; }} />
      </BookEditorProvider>
    );

    await waitFor(() => expect(narrationRef.current?.activeView.data?.number).toBe(1));

    await act(async () => {
      await narrationRef.current!.generateNarration();
    });

    const generateCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter((args) => args[0] === "/api/admin/generate-overlay-narration");

    expect(generateCalls).toHaveLength(1);

    const payload = JSON.parse(String(generateCalls[0][1]?.body || "{}"));
    expect(payload.updatePageNarration).toBe(true);
    expect(payload.items).toHaveLength(2);
    expect(payload.items.map((i: { overlayElementId: string }) => i.overlayElementId)).toEqual([
      "el-1",
      "el-2",
    ]);

    expect(assignAudioMutateAsync).toHaveBeenCalledTimes(1);
    expect(assignAudioMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        audioType: "narration",
        audioUrl: "https://example.com/stitched.mp3",
      })
    );
  });

  it("does not overwrite page narration when generating selected text on pages with multiple overlay blocks", async () => {
    const narrationRef = { current: null as NarrationCtx | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CaptureNarrationContext onUpdate={(ctx) => { narrationRef.current = ctx; }} />
      </BookEditorProvider>
    );

    await waitFor(() => expect(narrationRef.current?.activeView.overlayPageId).toBe("saved-1"));

    act(() => {
      const store = getOverlayEditorStore("saved-1");
      store.getState().init(pageWithMixedVoices.overlay.elements as never);
      store.getState().selectElement("el-1");
    });

    await waitFor(() => expect(narrationRef.current?.selectedOverlayElement?.id).toBe("el-1"));

    await act(async () => {
      await narrationRef.current!.generateSelectedTextNarration();
    });

    const generateCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter((args) => args[0] === "/api/admin/generate-overlay-narration");

    expect(generateCalls).toHaveLength(1);

    const payload = JSON.parse(String(generateCalls[0][1]?.body || "{}"));
    expect(payload.updatePageNarration).toBe(false);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].overlayElementId).toBe("el-1");

    expect(assignAudioMutateAsync).not.toHaveBeenCalled();
  });
});

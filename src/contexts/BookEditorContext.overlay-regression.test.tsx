import { useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookEditorProvider,
  useBookMetaContext,
  useOverlayEditorContext,
  usePageManagerContext,
} from "@/contexts/BookEditorContext";
import {
  destroyOverlayEditorStore,
  getOverlayEditorStore,
} from "@/stores/overlayEditorRegistry";
import type { TextElement } from "@/types/text-overlay";

const { mockMutateAsync } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useBookData", () => {
  const basePage = {
    id: "saved-1",
    pageNumber: 1,
    textContent: "",
    imageUrl: "https://example.com/1.png",
    narrationUrl: null,
    narrationTimestamps: null,
    wordPronunciations: null,
    compositedImageUrl: null,
    overlay: null,
    assignments: [],
  };

  const bookDetailsResult = {
    data: { id: "book-1", title: "Test Book", author: "Author", totalPages: 1 },
    isLoading: false,
  };
  const editorPagesResult = { data: [basePage], isLoading: false };
  const audioAssignmentsResult = { data: [] };

  const mutationResult = { isPending: false, mutateAsync: mockMutateAsync };

  return {
    useBookDetails: () => bookDetailsResult,
    useEditorPages: () => editorPagesResult,
    useAudioAssignments: () => audioAssignmentsResult,
    useGenerateNarration: () => mutationResult,
    useAssignAudio: () => mutationResult,
    useDeleteAudioAssignment: () => mutationResult,
    useSavePages: () => mutationResult,
    useSaveOverlayTextEntries: () => mutationResult,
    useUpdateBook: () => mutationResult,
    useApplyBookTextStyle: () => mutationResult,
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

type PageManager = ReturnType<typeof usePageManagerContext>;
type BookMeta = ReturnType<typeof useBookMetaContext>;
type OverlayEditor = ReturnType<typeof useOverlayEditorContext>;

type ProbeProps = {
  onUpdate: (ctx: PageManager) => void;
  onBookMetaUpdate?: (ctx: BookMeta) => void;
  onOverlayEditorUpdate?: (ctx: OverlayEditor) => void;
};

function CapturePageManager({
  onUpdate,
  onBookMetaUpdate,
  onOverlayEditorUpdate,
}: ProbeProps) {
  const ctx = usePageManagerContext();
  const bookMeta = useBookMetaContext();
  const overlayEditor = useOverlayEditorContext();

  useEffect(() => {
    onUpdate(ctx);
  }, [ctx, onUpdate]);

  useEffect(() => {
    onBookMetaUpdate?.(bookMeta);
  }, [bookMeta, onBookMetaUpdate]);

  useEffect(() => {
    onOverlayEditorUpdate?.(overlayEditor);
  }, [onOverlayEditorUpdate, overlayEditor]);

  return null;
}

function makeElement(id: string): TextElement {
  return {
    id,
    text: id,
    x: 10,
    y: 10,
    width: 30,
    fontFamily: "Inter",
    fontSize: 5,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left" as const,
    rotation: 0,
  };
}

describe("BookEditorContext overlay key regressions", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset().mockResolvedValue({});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ voices: [] }),
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ["saved-1", "page-1", "page-2", "page-3", "page-4"]) {
      destroyOverlayEditorStore(key);
    }
  });

  it("preserves moved active page overlay store after reorder", async () => {
    const pageManagerRef = { current: null as PageManager | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CapturePageManager onUpdate={(ctx) => { pageManagerRef.current = ctx; }} />
      </BookEditorProvider>
    );

    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(1));

    act(() => {
      pageManagerRef.current!.handleAddPage();
      pageManagerRef.current!.handleAddPage();
    });

    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(3));

    act(() => {
      pageManagerRef.current!.setActivePage(2);
    });

    await waitFor(() => expect(pageManagerRef.current?.activePage).toBe(2));

    act(() => {
      getOverlayEditorStore("page-2").getState().init([makeElement("moved-page")]);
      getOverlayEditorStore("page-3").getState().init([makeElement("other-page")]);
    });

    act(() => {
      pageManagerRef.current!.handleDragEndPages({
        source: { index: 1, droppableId: "pages" },
        destination: { index: 2, droppableId: "pages" },
      } as never);
    });

    await waitFor(() => expect(pageManagerRef.current?.activePage).toBe(3));

    const movedStoreElements = getOverlayEditorStore("page-3").getState().elements;
    expect(movedStoreElements.map((el) => el.id)).toEqual(["moved-page"]);
  });

  it("does not rehydrate stale server data after a successful local save", async () => {
    const pageManagerRef = { current: null as PageManager | null };
    const bookMetaRef = { current: null as BookMeta | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CapturePageManager
          onUpdate={(ctx) => { pageManagerRef.current = ctx; }}
          onBookMetaUpdate={(ctx) => { bookMetaRef.current = ctx; }}
        />
      </BookEditorProvider>
    );

    await waitFor(() => expect(bookMetaRef.current?.localTitle).toBe("Test Book"));

    act(() => bookMetaRef.current!.setLocalTitle("Locally edited title"));
    await waitFor(() => expect(bookMetaRef.current?.hasLocalChanges).toBe(true));
    await act(async () => bookMetaRef.current!.handleSave());

    await waitFor(() => expect(bookMetaRef.current?.hasLocalChanges).toBe(false));
    expect(bookMetaRef.current?.localTitle).toBe("Locally edited title");
    expect(pageManagerRef.current?.localPages).toHaveLength(1);
  });

  it("persists the last font, size, and voice as defaults for new pages", async () => {
    const pageManagerRef = { current: null as PageManager | null };
    const bookMetaRef = { current: null as BookMeta | null };
    const overlayEditorRef = { current: null as OverlayEditor | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CapturePageManager
          onUpdate={(ctx) => { pageManagerRef.current = ctx; }}
          onBookMetaUpdate={(ctx) => { bookMetaRef.current = ctx; }}
          onOverlayEditorUpdate={(ctx) => { overlayEditorRef.current = ctx; }}
        />
      </BookEditorProvider>
    );

    await waitFor(() => expect(overlayEditorRef.current).not.toBeNull());

    act(() => {
      overlayEditorRef.current!.rememberOverlayTextSettings({
        fontFamily: "Lora",
        fontSize: 7.2,
        voiceId: "voice-2",
        voiceName: "Sprite",
      });
    });

    await waitFor(() =>
      expect(bookMetaRef.current?.bookTextStyle).toMatchObject({
        fontFamily: "Lora",
        fontSize: 7.2,
        voiceId: "voice-2",
        voiceName: "Sprite",
      })
    );
    await act(async () => bookMetaRef.current!.handleSave());

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultTextStyle: expect.objectContaining({
          fontFamily: "Lora",
          fontSize: 7.2,
          voiceId: "voice-2",
          voiceName: "Sprite",
        }),
      })
    );
  });

  it("queues the latest overlay before navigating away", async () => {
    const pageManagerRef = { current: null as PageManager | null };
    const bookMetaRef = { current: null as BookMeta | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CapturePageManager
          onUpdate={(ctx) => { pageManagerRef.current = ctx; }}
          onBookMetaUpdate={(ctx) => { bookMetaRef.current = ctx; }}
        />
      </BookEditorProvider>
    );

    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(1));
    act(() => pageManagerRef.current!.handleAddPage());
    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(2));
    await act(async () => bookMetaRef.current!.handleSave());
    await waitFor(() => expect(bookMetaRef.current?.hasLocalChanges).toBe(false));

    act(() => {
      const store = getOverlayEditorStore("saved-1");
      store.getState().init([makeElement("latest")]);
      store.getState().updateElement("latest", { text: "latest edit" });
      pageManagerRef.current!.setActivePage(2);
    });

    await waitFor(() => expect(bookMetaRef.current?.hasLocalChanges).toBe(true));
    await act(async () => bookMetaRef.current!.handleSave());
    await waitFor(() => expect(bookMetaRef.current?.hasLocalChanges).toBe(false));

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/books/book-1/pages/1/overlay",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("remaps unsaved overlay stores when deleting and renumbering pages", async () => {
    const pageManagerRef = { current: null as PageManager | null };

    render(
      <BookEditorProvider bookId="book-1">
        <CapturePageManager onUpdate={(ctx) => { pageManagerRef.current = ctx; }} />
      </BookEditorProvider>
    );

    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(1));

    act(() => {
      pageManagerRef.current!.handleAddPage();
      pageManagerRef.current!.handleAddPage();
    });

    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(3));

    act(() => {
      getOverlayEditorStore("saved-1").getState().init([makeElement("deleted-page")]);
      getOverlayEditorStore("page-2").getState().init([makeElement("old-2")]);
      getOverlayEditorStore("page-3").getState().init([makeElement("old-3")]);
    });

    act(() => {
      pageManagerRef.current!.handleDeletePage(1);
    });

    await waitFor(() => expect(pageManagerRef.current?.localPages.length).toBe(2));

    expect(getOverlayEditorStore("saved-1").getState().elements).toEqual([]);
    expect(getOverlayEditorStore("page-1").getState().elements.map((el) => el.id)).toEqual([
      "old-2",
    ]);
    expect(getOverlayEditorStore("page-2").getState().elements.map((el) => el.id)).toEqual([
      "old-3",
    ]);
  });
});

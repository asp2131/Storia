import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEditorSave, type UseEditorSaveOptions } from "@/hooks/useEditorSave";
import type { OverlayDraft, OverlaySaveResult, BookDraft } from "@/lib/editor/saveCoordinator";
import { emptyOverlayConfig } from "@/types/text-overlay";

// ─── Fake Scheduler ───────────────────────────────────────────────────────────

type ScheduledTask = { id: number; dueAt: number; callback: () => void };

function createFakeScheduler() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map<number, ScheduledTask>();

  return {
    scheduler: {
      setTimeout(callback: () => void, ms: number) {
        const id = nextId++;
        tasks.set(id, { id, dueAt: now + ms, callback });
        return id;
      },
      clearTimeout(handle: unknown) {
        tasks.delete(handle as number);
      },
    },
    advance(ms: number) {
      now += ms;
      const ready = [...tasks.values()]
        .filter((t) => t.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt);
      for (const t of ready) {
        tasks.delete(t.id);
        t.callback();
      }
    },
  };
}

// ─── Factories ────────────────────────────────────────────────────────────────

function createOptions(overrides?: Partial<UseEditorSaveOptions>): UseEditorSaveOptions {
  return {
    getBookDraft: () => ({ title: "Draft", author: "Author", pages: [] }),
    saveBook: vi.fn(async () => undefined),
    saveOverlay: vi.fn(async (draft: OverlayDraft): Promise<OverlaySaveResult> => ({
      pageKey: draft.pageKey,
      pageNumber: draft.pageNumber,
      overlay: draft.overlay,
      textContent: null,
    })),
    applyOverlayResult: vi.fn(),
    debounceMs: 100,
    ...overrides,
  };
}

function renderUseEditorSave(overrides?: Partial<UseEditorSaveOptions>) {
  const { scheduler, advance } = createFakeScheduler();
  const options = createOptions({ scheduler, ...overrides });
  const result = renderHook(() => useEditorSave(options));
  return { ...result, advance, options };
}

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

// ─── Boundary Tests ───────────────────────────────────────────────────────────

describe("useEditorSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("book dirty → debounce → autosave", async () => {
    const { result, advance } = renderUseEditorSave();

    act(() => result.current.markDirty("book"));
    expect(result.current.status.phase).toBe("pending");
    expect(result.current.status.dirty).toBe(true);

    act(() => advance(99));
    await settlePromises();
    expect(result.current.status.phase).toBe("pending");

    act(() => advance(1));
    await settlePromises();
    await waitFor(() => expect(result.current.status.phase).toBe("saved"));

    expect(result.current.status.dirty).toBe(false);
    expect(result.current.status.error).toBeNull();
  });

  it("overlay dirty + book dirty → commit orders overlay before book", async () => {
    const order: string[] = [];
    let resolveOverlay!: (result: OverlaySaveResult) => void;
    const overlayGate = new Promise<OverlaySaveResult>((resolve) => {
      resolveOverlay = resolve;
    });

    let currentDraft: BookDraft = {
      title: "Draft",
      author: "Author",
      pages: [{ pageNumber: 1, textContent: "stale text", imageUrl: null }],
    };

    const { result, options } = renderUseEditorSave({
      getBookDraft: () => currentDraft,
      saveOverlay: vi.fn(async (draft: OverlayDraft) => {
        order.push("overlay");
        expect(draft.pageKey).toBe("page-1");
        return overlayGate;
      }),
      applyOverlayResult: vi.fn((res: OverlaySaveResult) => {
        order.push("apply-overlay");
        currentDraft = {
          ...currentDraft,
          pages: currentDraft.pages.map((page) =>
            page.pageNumber === res.pageNumber
              ? { ...page, textContent: res.textContent ?? "" }
              : page
          ),
        };
      }),
      saveBook: vi.fn(async (draft: BookDraft) => {
        order.push("book");
        expect(draft.pages[0].textContent).toBe("overlay-derived text");
      }),
    });

    act(() => {
      result.current.markDirty({
        overlay: { pageKey: "page-1", pageNumber: 1, overlay: emptyOverlayConfig() },
      });
      result.current.markDirty("book");
    });

    let commitPromise: Promise<void>;
    act(() => {
      commitPromise = result.current.commit("manual");
    });
    await settlePromises();

    expect(order).toEqual(["overlay"]);
    expect(options.saveBook).not.toHaveBeenCalled();

    resolveOverlay({
      pageKey: "page-1",
      pageNumber: 1,
      overlay: emptyOverlayConfig(),
      textContent: "overlay-derived text",
    });
    await act(async () => {
      await commitPromise;
    });

    expect(order).toEqual(["overlay", "apply-overlay", "book"]);
    await waitFor(() => expect(result.current.status.phase).toBe("saved"));
    expect(result.current.status.dirty).toBe(false);
  });

  it("save fails → status.error set, status.dirty stays true → retry succeeds", async () => {
    const failure = new Error("temporary failure");
    const saveBook = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);

    const { result } = renderUseEditorSave({ saveBook });

    act(() => result.current.markDirty("book"));

    await act(async () => {
      await expect(result.current.commit("manual")).rejects.toThrow("temporary failure");
    });

    await waitFor(() => expect(result.current.status.phase).toBe("error"));
    expect(result.current.status.dirty).toBe(true);
    expect(result.current.status.error).toBe(failure);

    await act(async () => {
      await result.current.commit("retry");
    });

    expect(saveBook).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.status.phase).toBe("saved"));
    expect(result.current.status.dirty).toBe(false);
    expect(result.current.status.error).toBeNull();
  });

  it("concurrent overlays → batched in one commit", async () => {
    const { result, options } = renderUseEditorSave();

    act(() => {
      result.current.markDirty({
        overlay: { pageKey: "page-1", pageNumber: 1, overlay: emptyOverlayConfig() },
      });
      result.current.markDirty({
        overlay: { pageKey: "page-2", pageNumber: 2, overlay: emptyOverlayConfig() },
      });
    });

    await act(async () => {
      await result.current.commit("manual");
    });

    expect(options.saveOverlay).toHaveBeenCalledTimes(2);
    expect(options.applyOverlayResult).toHaveBeenCalledTimes(2);
    expect(options.saveBook).not.toHaveBeenCalled();
  });

  it("mid-flight markDirty bumps revision → stale result discarded", async () => {
    let resolveSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const saveBook = vi.fn().mockReturnValue(saveGate);

    const { result, advance } = renderUseEditorSave({ saveBook, debounceMs: 50 });

    act(() => result.current.markDirty("book"));
    let commitPromise: Promise<void>;
    act(() => {
      commitPromise = result.current.commit("manual");
    });
    await settlePromises();

    expect(result.current.status.phase).toBe("saving");

    // Bumps revision while in-flight
    act(() => result.current.markDirty("book"));
    await settlePromises();

    expect(result.current.status.phase).toBe("saving");

    resolveSave();
    await act(async () => {
      await commitPromise;
    });
    await settlePromises();

    // Stale result discarded — still dirty, back to pending
    expect(result.current.status.phase).toBe("pending");
    expect(result.current.status.dirty).toBe(true);

    // Autosave fires for the second revision
    act(() => advance(50));
    await settlePromises();
    await waitFor(() => expect(result.current.status.phase).toBe("saved"));
    expect(result.current.status.dirty).toBe(false);
    expect(saveBook).toHaveBeenCalledTimes(2);
  });

  it("routes overlay phase changes through onOverlayPhaseChange", async () => {
    const phases: Array<{ pageKey: string; phase: string }> = [];

    const { result } = renderUseEditorSave({
      onOverlayPhaseChange: (pageKey, phase) => {
        phases.push({ pageKey, phase });
      },
    });

    act(() => {
      result.current.markDirty({
        overlay: { pageKey: "page-1", pageNumber: 1, overlay: emptyOverlayConfig() },
      });
    });

    await act(async () => {
      await result.current.commit("manual");
    });

    expect(phases.some((p) => p.pageKey === "page-1" && p.phase === "saving")).toBe(true);
    expect(phases.some((p) => p.pageKey === "page-1" && p.phase === "saved")).toBe(true);
  });
});

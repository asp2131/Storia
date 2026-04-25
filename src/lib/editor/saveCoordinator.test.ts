import { describe, expect, it, vi } from "vitest";
import { emptyOverlayConfig } from "@/types/text-overlay";
import {
  SaveCoordinator,
  type BookDraft,
  type OverlayDraft,
  type OverlaySaveResult,
} from "./saveCoordinator";

type ScheduledTask = {
  id: number;
  dueAt: number;
  callback: () => void;
};

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
    get pendingCount() {
      return tasks.size;
    },
    advance(ms: number) {
      now += ms;
      const ready = [...tasks.values()]
        .filter((task) => task.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt);
      for (const task of ready) {
        tasks.delete(task.id);
        task.callback();
      }
    },
  };
}

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("SaveCoordinator", () => {
  it("resets the shared debounce window on repeated dirty requests", async () => {
    const fake = createFakeScheduler();
    const saveBook = vi.fn(async () => undefined);
    const coordinator = new SaveCoordinator({
      debounceMs: 100,
      scheduler: fake.scheduler,
      getBookDraft: () => ({ title: "Draft", author: "Author", pages: [] }),
      saveBook,
      saveOverlay: vi.fn(),
      applyOverlayResult: vi.fn(),
    });

    coordinator.markBookDirty();
    fake.advance(99);
    expect(saveBook).not.toHaveBeenCalled();

    coordinator.markBookDirty();
    expect(fake.pendingCount).toBe(1);
    fake.advance(99);
    await settlePromises();
    expect(saveBook).not.toHaveBeenCalled();

    fake.advance(1);
    await settlePromises();
    expect(saveBook).toHaveBeenCalledTimes(1);
    expect(coordinator.getSnapshot("book")).toMatchObject({
      phase: "saved",
      dirty: false,
    });
  });

  it("keeps failed saves dirty and allows an explicit retry", async () => {
    const failure = new Error("temporary failure");
    const saveBook = vi.fn(async () => undefined);
    saveBook.mockRejectedValueOnce(failure);
    const coordinator = new SaveCoordinator({
      debounceMs: 100,
      getBookDraft: () => ({ title: "Draft", author: "Author", pages: [] }),
      saveBook,
      saveOverlay: vi.fn(),
      applyOverlayResult: vi.fn(),
    });

    coordinator.markBookDirty();
    await expect(coordinator.flush("manual")).rejects.toThrow("temporary failure");
    expect(coordinator.getSnapshot("book")).toMatchObject({
      phase: "error",
      dirty: true,
      error: failure,
    });

    await coordinator.flush("retry");
    expect(saveBook).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot("book")).toMatchObject({
      phase: "saved",
      dirty: false,
      error: null,
    });
  });

  it("saves dirty overlays before snapshotting a concurrent dirty book draft", async () => {
    let resolveOverlay!: (result: OverlaySaveResult) => void;
    const overlayGate = new Promise<OverlaySaveResult>((resolve) => {
      resolveOverlay = resolve;
    });
    const order: string[] = [];
    let currentDraft: BookDraft = {
      title: "Draft",
      author: "Author",
      pages: [{ pageNumber: 1, textContent: "stale text", imageUrl: null }],
    };

    const saveOverlay = vi.fn(async (draft: OverlayDraft) => {
      order.push("overlay");
      expect(draft.pageKey).toBe("page-1");
      return overlayGate;
    });
    const applyOverlayResult = vi.fn((result: OverlaySaveResult) => {
      order.push("apply-overlay");
      currentDraft = {
        ...currentDraft,
        pages: currentDraft.pages.map((page) =>
          page.pageNumber === result.pageNumber
            ? { ...page, textContent: result.textContent ?? "" }
            : page
        ),
      };
    });
    const saveBook = vi.fn(async (draft: BookDraft) => {
      order.push("book");
      expect(draft.pages[0].textContent).toBe("overlay-derived text");
    });

    const coordinator = new SaveCoordinator({
      debounceMs: 100,
      getBookDraft: () => currentDraft,
      saveBook,
      saveOverlay,
      applyOverlayResult,
    });

    coordinator.requestOverlaySave({
      pageKey: "page-1",
      pageNumber: 1,
      overlay: emptyOverlayConfig(),
    });
    coordinator.markBookDirty();

    const flushPromise = coordinator.flush("manual");
    await settlePromises();
    expect(order).toEqual(["overlay"]);
    expect(saveBook).not.toHaveBeenCalled();

    resolveOverlay({
      pageKey: "page-1",
      pageNumber: 1,
      overlay: emptyOverlayConfig(),
      textContent: "overlay-derived text",
    });
    await flushPromise;

    expect(order).toEqual(["overlay", "apply-overlay", "book"]);
    expect(coordinator.getOverlaySnapshot("page-1")).toMatchObject({
      phase: "saved",
      dirty: false,
    });
    expect(coordinator.getSnapshot("book")).toMatchObject({
      phase: "saved",
      dirty: false,
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { createOverlayEditorStore } from "./overlayEditorStore";
import { deriveTextContent } from "@/types/text-overlay";
import type { TextElement } from "@/types/text-overlay";

function el(id: string, text: string): TextElement {
  return {
    id,
    text,
    x: 0,
    y: 0,
    width: 30,
    fontFamily: "Inter",
    fontSize: 4,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left",
    rotation: 0,
  };
}

describe("overlayEditorStore.init", () => {
  it("does not clear the active edit when autosave reapplies identical elements", () => {
    const store = createOverlayEditorStore();
    const elements = [el("a", "editing")];
    store.getState().init(elements);
    store.getState().selectElement("a");
    store.getState().updateElement("a", { fontSize: 5 });

    store.getState().init([{ ...elements[0], fontSize: 5 }]);

    expect(store.getState().selectedElementId).toBe("a");
    expect(store.getState().hasChanges).toBe(true);
    expect(store.getState().autoSaveStatus).toBe("pending");
  });
});

describe("overlayEditorStore history", () => {
  it("undoes and redoes element edits", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "before")]);

    store.getState().updateElement("a", { text: "after" });
    expect(store.getState().past).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().elements[0].text).toBe("before");

    store.getState().redo();
    expect(store.getState().elements[0].text).toBe("after");
    expect(store.getState().autoSaveStatus).toBe("pending");
  });

  it("clears redo history after a new edit", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "one")]);
    store.getState().updateElement("a", { text: "two" });
    store.getState().undo();

    store.getState().updateElement("a", { text: "three" });
    store.getState().redo();

    expect(store.getState().elements[0].text).toBe("three");
    expect(store.getState().future).toEqual([]);
  });

  it("collapses a typing burst into one undo step", () => {
    vi.useFakeTimers();
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "")]);

    for (const text of ["H", "Hi", "Hi ", "Hi t", "Hi th", "Hi the", "Hi ther", "Hi there"]) {
      store.getState().updateElement("a", { text });
      vi.advanceTimersByTime(80);
    }

    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().elements[0].text).toBe("");
    vi.useRealTimers();
  });

  it("starts a new undo step after a typing pause or a different field", () => {
    vi.useFakeTimers();
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "")]);

    store.getState().updateElement("a", { text: "one" });
    vi.advanceTimersByTime(1000);
    store.getState().updateElement("a", { text: "two" });
    store.getState().updateElement("a", { color: "#ff0000" });

    expect(store.getState().past).toHaveLength(3);
    vi.useRealTimers();
  });

  it("ignores updates that change nothing", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "same")]);

    store.getState().updateElement("a", { text: "same" });

    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().hasChanges).toBe(false);
  });

  it("clears the dirty flag when undo returns to the saved state", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "saved")]);
    store.getState().markSaved();

    store.getState().updateElement("a", { text: "edited" });
    expect(store.getState().hasChanges).toBe(true);

    store.getState().undo();
    expect(store.getState().hasChanges).toBe(false);
    expect(store.getState().autoSaveStatus).toBe("idle");

    store.getState().redo();
    expect(store.getState().hasChanges).toBe(true);
  });

  it("groups a drag into one undo step", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "moving")]);

    store.getState().beginHistoryGroup();
    store.getState().updateElement("a", { x: 10 });
    store.getState().updateElement("a", { x: 20 });
    store.getState().endHistoryGroup();

    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().elements[0].x).toBe(0);
  });
});

describe("overlayEditorStore.moveElement", () => {
  it("reorders elements, which drives reading order (deriveTextContent + mobile read-along)", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "first"), el("b", "second"), el("c", "third")]);

    store.getState().moveElement("c", "up");
    expect(store.getState().elements.map((e) => e.id)).toEqual(["a", "c", "b"]);
    // Reading order is the array order — this is exactly what mobile iterates.
    expect(deriveTextContent(store.getState().buildConfig())).toBe("first\nthird\nsecond");
    expect(store.getState().autoSaveStatus).toBe("pending");
  });

  it("is a no-op at the ends", () => {
    const store = createOverlayEditorStore();
    store.getState().init([el("a", "first"), el("b", "second")]);

    store.getState().moveElement("a", "up");
    store.getState().moveElement("b", "down");
    expect(store.getState().elements.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

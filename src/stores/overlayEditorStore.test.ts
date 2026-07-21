import { describe, it, expect } from "vitest";
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

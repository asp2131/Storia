import { describe, expect, it } from "vitest";
import { historyShortcutFor } from "./DraggableTextOverlayEditor";

describe("historyShortcutFor", () => {
  const key = (over: Partial<KeyboardEvent> & { target?: EventTarget | null } = {}) => ({
    key: "z",
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    target: document.body,
    ...over,
  });

  it("maps the modifier combinations", () => {
    expect(historyShortcutFor(key())).toBe("undo");
    expect(historyShortcutFor(key({ shiftKey: true }))).toBe("redo");
    expect(historyShortcutFor(key({ key: "y" }))).toBe("redo");
    expect(historyShortcutFor(key({ key: "Z" }))).toBe("undo");
    expect(historyShortcutFor(key({ metaKey: false, ctrlKey: true }))).toBe("undo");
  });

  it("ignores plain keys and unrelated shortcuts", () => {
    expect(historyShortcutFor(key({ metaKey: false }))).toBeNull();
    expect(historyShortcutFor(key({ key: "s" }))).toBeNull();
  });

  it("leaves other text fields to their own native undo", () => {
    const input = document.createElement("input");
    expect(historyShortcutFor(key({ target: input }))).toBeNull();

    const overlayText = document.createElement("textarea");
    overlayText.setAttribute("data-overlay-text-input", "");
    expect(historyShortcutFor(key({ target: overlayText }))).toBe("undo");
  });
});

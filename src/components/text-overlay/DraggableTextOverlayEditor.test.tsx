import { describe, expect, it } from "vitest";
import { hasWordWiderThanBox, historyShortcutFor, isTypingTarget, snapToCenter } from "./DraggableTextOverlayEditor";

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

describe("snapToCenter", () => {
  it("snaps a box centre onto the page centre inside the threshold", () => {
    // 30% wide box at x=34 has centre 49 -> snaps to x=35 (centre 50).
    expect(snapToCenter(34, 10, 30, 10, 1.5, 1.5)).toEqual({ x: 35, y: 10, guides: { x: true, y: false } });
    expect(snapToCenter(10, 44.5, 30, 10, 1, 1)).toEqual({ x: 10, y: 45, guides: { x: false, y: true } });
  });

  it("leaves boxes alone outside the threshold or when snapping is off", () => {
    expect(snapToCenter(20, 20, 30, 10, 1, 1).guides).toEqual({ x: false, y: false });
    expect(snapToCenter(35, 45, 30, 10, -1, -1)).toEqual({ x: 35, y: 45, guides: { x: false, y: false } });
  });
});

describe("isTypingTarget", () => {
  it("treats form fields and editable content as typing", () => {
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("hasWordWiderThanBox", () => {
  // jsdom has no layout: fake a 100px box whose longest word is `wordPx` wide
  // and only overflows while word breaking is off.
  const box = (wordPx: number) => {
    const el = document.createElement("span");
    Object.defineProperty(el, "clientWidth", { value: 100 });
    Object.defineProperty(el, "scrollWidth", {
      get: () => (el.style.overflowWrap === "normal" ? Math.max(100, wordPx) : 100),
    });
    return el;
  };

  it("flags a word wider than the box and restores word breaking", () => {
    const el = box(140);
    expect(hasWordWiderThanBox(el)).toBe(true);
    expect(el.style.overflowWrap).toBe("");
  });

  it("passes words that fit, allowing a sub-pixel rounding slack", () => {
    expect(hasWordWiderThanBox(box(80))).toBe(false);
    expect(hasWordWiderThanBox(box(101))).toBe(false);
  });
});

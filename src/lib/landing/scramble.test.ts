import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrambleIn } from "./scramble";

function makeParagraph(text: string): HTMLParagraphElement {
  const el = document.createElement("p");
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

describe("scrambleIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("splits the element into chars and hides them", () => {
    const el = makeParagraph("Hello");
    const cleanup = scrambleIn(el);

    const chars = el.querySelectorAll<HTMLElement>(".char");
    expect(chars.length).toBe(5);
    chars.forEach((c) => expect(c.style.opacity).toBe("0"));

    cleanup();
  });

  it("reveals chars on their stagger", () => {
    const el = makeParagraph("AB");
    const cleanup = scrambleIn(el, { stagger: 20, duration: 0.2, charDelay: 10 });

    const first = el.querySelectorAll<HTMLElement>(".char")[0];
    expect(first.style.opacity).toBe("0");
    vi.advanceTimersByTime(21);
    expect(first.style.opacity).toBe("1");

    cleanup();
  });

  it("settles every char back on the original text", () => {
    const el = makeParagraph("Story time");
    scrambleIn(el, { stagger: 10, duration: 0.2, charDelay: 10 });

    vi.advanceTimersByTime(10_000);
    expect(el.textContent).toBe("Story time");
  });

  it("cleanup reverts the element to its original HTML", () => {
    const el = makeParagraph("Story time");
    const original = el.innerHTML;

    const cleanup = scrambleIn(el);
    vi.advanceTimersByTime(50);
    cleanup();

    expect(el.innerHTML).toBe(original);
  });

  it("cleanup stops pending timers so nothing scrambles afterwards", () => {
    const el = makeParagraph("AB");
    const cleanup = scrambleIn(el, { stagger: 20, duration: 0.2, charDelay: 10 });
    cleanup();

    const first = el.querySelectorAll<HTMLElement>(".char")[0];
    expect(first).toBeUndefined(); // split reverted
    expect(el.textContent).toBe("AB");
  });

  it("handles an empty element without throwing", () => {
    const el = makeParagraph("");

    expect(() => {
      const cleanup = scrambleIn(el);
      vi.advanceTimersByTime(1_000);
      cleanup();
    }).not.toThrow();

    expect(el.textContent).toBe("");
  });

  it("tolerates cleanup being called twice", () => {
    const el = makeParagraph("AB");
    const original = el.innerHTML;
    const cleanup = scrambleIn(el, { stagger: 20, duration: 0.2, charDelay: 10 });

    cleanup();
    expect(() => cleanup()).not.toThrow();

    expect(el.innerHTML).toBe(original);
    expect(el.textContent).toBe("AB");
  });
});

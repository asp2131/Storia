import SplitType from "split-type";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789·–";

export interface ScrambleOptions {
  /** Seconds a single char cycles through glyphs before settling. Default 0.35. */
  duration?: number;
  /** Milliseconds between glyph swaps for one char. Default 45. */
  charDelay?: number;
  /** Milliseconds between each char's reveal start. Default 24. */
  stagger?: number;
}

/**
 * scrambleIn — split `element` into chars, hide them, then reveal each char
 * left-to-right through a burst of random glyphs before settling on the
 * original character. Returns a cleanup that clears all timers and reverts
 * the split (restoring the element's original HTML).
 */
export function scrambleIn(
  element: HTMLElement,
  options: ScrambleOptions = {}
): () => void {
  const { duration = 0.35, charDelay = 45, stagger = 24 } = options;

  const split = new SplitType(element, { types: "words,chars" });
  const chars = split.chars ?? [];

  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();

  chars.forEach((char, index) => {
    const original = char.textContent ?? "";
    char.style.opacity = "0";

    const startTimer = setTimeout(() => {
      char.style.opacity = "1";
      if (original.trim() === "") return;

      const maxIterations = 3 + Math.floor(Math.random() * 4);
      let iterations = 0;

      const interval = setInterval(() => {
        iterations += 1;
        if (iterations >= maxIterations) {
          clearInterval(interval);
          intervals.delete(interval);
          char.textContent = original;
          return;
        }
        char.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }, charDelay);
      intervals.add(interval);

      // hard settle — whichever of iterations/duration finishes first
      const settleTimer = setTimeout(() => {
        clearInterval(interval);
        intervals.delete(interval);
        char.textContent = original;
      }, duration * 1000);
      timeouts.add(settleTimer);
    }, index * stagger);
    timeouts.add(startTimer);
  });

  return () => {
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
    split.revert();
  };
}

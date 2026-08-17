import { describe, expect, it } from "vitest";
import { fallbackTiming } from "./fallbackTiming";

describe("fallbackTiming", () => {
  it("covers the full duration with contiguous spans", () => {
    const result = fallbackTiming(["one", "two", "three"], 6);

    expect(result).toHaveLength(3);
    expect(result[0].start).toBe(0);
    expect(result[2].end).toBe(6);
    expect(result[0].end).toBe(result[1].start);
    expect(result[1].end).toBe(result[2].start);
  });

  it("is monotonically non-decreasing", () => {
    const result = fallbackTiming("a bb ccc dddd".split(" "), 10);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].start);
      expect(result[i].end).toBeGreaterThanOrEqual(result[i].start);
    }
  });

  it("gives longer words more time", () => {
    const [short, long] = fallbackTiming(["a", "extraordinary"], 10);

    expect(long.end - long.start).toBeGreaterThan(short.end - short.start);
  });

  it("adds pause weight to clause-ending punctuation", () => {
    const withComma = fallbackTiming(["word,", "word"], 10);
    const without = fallbackTiming(["word", "word"], 10);

    expect(withComma[0].end - withComma[0].start).toBeGreaterThan(
      without[0].end - without[0].start
    );
  });

  it("keeps timings at zero for a zero or invalid duration", () => {
    for (const duration of [0, -5, Number.NaN]) {
      const result = fallbackTiming(["a", "b"], duration);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.start === 0 && t.end === 0)).toBe(true);
    }
  });

  it("returns nothing for no tokens", () => {
    expect(fallbackTiming([], 10)).toEqual([]);
  });

  it("preserves the token text", () => {
    expect(fallbackTiming(["Once", "upon"], 2).map((t) => t.word)).toEqual(["Once", "upon"]);
  });
});

import { describe, it, expect } from "vitest";
import { computeActiveWordIndexMobileCompat } from "./word-sync";

describe("computeActiveWordIndexMobileCompat", () => {
  const timestamps = [
    { word: "Hello", start: 0.0, end: 0.5 },
    { word: "world", start: 0.6, end: 1.0 },
    { word: "this", start: 1.5, end: 2.0 },
    { word: "is", start: 2.1, end: 2.3 },
    { word: "a", start: 2.4, end: 2.5 },
    { word: "test", start: 2.6, end: 3.0 },
  ];

  it("returns -1 for empty timestamps", () => {
    expect(computeActiveWordIndexMobileCompat([], 1.0)).toBe(-1);
  });

  it("returns -1 for null-like timestamps", () => {
    expect(computeActiveWordIndexMobileCompat(null as unknown as [], 1.0)).toBe(-1);
    expect(computeActiveWordIndexMobileCompat(undefined as unknown as [], 1.0)).toBe(-1);
  });

  it("returns correct index when currentTime is within a word window", () => {
    expect(computeActiveWordIndexMobileCompat(timestamps, 0.3)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(timestamps, 0.8)).toBe(1);
    expect(computeActiveWordIndexMobileCompat(timestamps, 1.7)).toBe(2);
    expect(computeActiveWordIndexMobileCompat(timestamps, 2.8)).toBe(5);
  });

  it("returns previous word index when currentTime is in a gap between words", () => {
    expect(computeActiveWordIndexMobileCompat(timestamps, 0.55)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(timestamps, 1.2)).toBe(1);
    expect(computeActiveWordIndexMobileCompat(timestamps, 2.05)).toBe(2);
  });

  it("returns last word index when currentTime is past the last word start (no next word)", () => {
    expect(computeActiveWordIndexMobileCompat(timestamps, 3.5)).toBe(5);
  });

  it("returns correct index when currentTime exactly equals word.end", () => {
    expect(computeActiveWordIndexMobileCompat(timestamps, 0.5)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(timestamps, 1.0)).toBe(1);
    expect(computeActiveWordIndexMobileCompat(timestamps, 3.0)).toBe(5);
  });

  it("returns correct index when currentTime exactly equals word.start", () => {
    expect(computeActiveWordIndexMobileCompat(timestamps, 0.0)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(timestamps, 0.6)).toBe(1);
    expect(computeActiveWordIndexMobileCompat(timestamps, 1.5)).toBe(2);
    expect(computeActiveWordIndexMobileCompat(timestamps, 2.6)).toBe(5);
  });

  it("handles single-word timestamp array", () => {
    const single = [{ word: "only", start: 1.0, end: 2.0 }];
    expect(computeActiveWordIndexMobileCompat(single, 0.5)).toBe(-1);
    expect(computeActiveWordIndexMobileCompat(single, 1.0)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(single, 1.5)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(single, 2.0)).toBe(0);
    expect(computeActiveWordIndexMobileCompat(single, 2.5)).toBe(0);
  });

  it("returns -1 when currentTime is before all words", () => {
    const late = [{ word: "late", start: 5.0, end: 6.0 }];
    expect(computeActiveWordIndexMobileCompat(late, 3.0)).toBe(-1);
  });
});

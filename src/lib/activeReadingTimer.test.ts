import { describe, expect, it } from "vitest";
import { createActiveReadingTimer } from "./activeReadingTimer";

describe("createActiveReadingTimer", () => {
  it("counts visible time, caps idle pages, and never counts twice", () => {
    let t = 0;
    const timer = createActiveReadingTimer(5 * 60_000, () => t);

    t = 30_000;
    timer.pageTurned(); // 30s on page 1
    t += 60 * 60_000;
    timer.pageTurned(); // left open an hour on page 2: capped at 5m
    t += 10_000;
    timer.pause(); // 10s on page 3, then tab hidden
    t += 2 * 60 * 60_000; // hidden two hours: not counted
    timer.pageTurned(); // a turn while hidden adds nothing
    timer.resume();
    t += 20_000;

    const expected = 30_000 + 5 * 60_000 + 10_000 + 20_000;
    expect(timer.totalMs()).toBe(expected);
    expect(timer.totalMs()).toBe(expected);
  });
});

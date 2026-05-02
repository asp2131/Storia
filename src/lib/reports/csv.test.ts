import { describe, expect, it } from "vitest";
import { toCsv, toCsvRow } from "./csv";

describe("toCsvRow", () => {
  it("joins simple values with commas", () => {
    expect(toCsvRow(["a", 1, true])).toBe("a,1,true");
  });

  it("emits empty string for null/undefined cells", () => {
    expect(toCsvRow(["a", null, undefined, "b"])).toBe("a,,,b");
  });

  it("quotes and escapes cells containing comma, quote, or newline", () => {
    expect(toCsvRow([`hello, world`])).toBe(`"hello, world"`);
    expect(toCsvRow([`she said "hi"`])).toBe(`"she said ""hi"""`);
    expect(toCsvRow([`line1\nline2`])).toBe(`"line1\nline2"`);
  });
});

describe("toCsv", () => {
  it("renders header + rows", () => {
    type Row = { name: string; minutes: number };
    const rows: Row[] = [
      { name: "Ava", minutes: 12 },
      { name: "Leo", minutes: 0 },
    ];
    const csv = toCsv(rows, [
      { header: "name", get: (r) => r.name },
      { header: "minutes", get: (r) => r.minutes },
    ]);
    expect(csv).toBe(["name,minutes", "Ava,12", "Leo,0"].join("\n"));
  });

  it("handles zero rows by emitting header only", () => {
    expect(
      toCsv<{ x: number }>([], [{ header: "x", get: (r) => r.x }])
    ).toBe("x");
  });
});

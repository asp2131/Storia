import { describe, expect, it } from "vitest";
import { sortFilesByName } from "./BookEditorContext";

const file = (name: string) => new File([""], name, { type: "image/png" });

describe("sortFilesByName", () => {
  it("orders page numbers naturally, case-insensitively", () => {
    const names = sortFilesByName(
      ["page10.png", "Page2.png", "page1.png", "cover.png"].map(file)
    ).map((f) => f.name);
    expect(names).toEqual(["cover.png", "page1.png", "Page2.png", "page10.png"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  assemblePageNarrationText,
  extractPageNarrationTokens,
  parseReplicateOcrOutput,
} from "./overlayText";

describe("parseReplicateOcrOutput", () => {
  it("extracts the common quoted response shape", () => {
    expect(
      parseReplicateOcrOutput('The text on the image reads: "Go Slow"')
    ).toEqual(["Go Slow"]);
  });

  it("normalizes curly quotes and splits quoted multiline text", () => {
    expect(parseReplicateOcrOutput('It says: "OPEN\nTODAY"')).toEqual([
      "OPEN",
      "TODAY",
    ]);
  });

  it("returns an empty list for no-text responses", () => {
    expect(parseReplicateOcrOutput("There is no readable text in this image.")).toEqual([]);
  });

  it("strips preambles when the model omits quotes", () => {
    expect(parseReplicateOcrOutput("The text in the image says: Story Time")).toEqual([
      "Story Time",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseReplicateOcrOutput("")).toEqual([]);
    expect(parseReplicateOcrOutput(null)).toEqual([]);
    expect(parseReplicateOcrOutput(undefined)).toEqual([]);
  });

  it("extracts multiple quoted segments", () => {
    expect(
      parseReplicateOcrOutput('"First line" and "Second line"')
    ).toEqual(["First line", "Second line"]);
  });

  it("handles no-text patterns with various phrasing", () => {
    expect(parseReplicateOcrOutput("The image does not contain any text.")).toEqual([]);
    expect(parseReplicateOcrOutput("Unable to detect any text.")).toEqual([]);
    expect(parseReplicateOcrOutput("No visible text present.")).toEqual([]);
  });

  it("deduplicates repeated lines case-insensitively while preserving first casing", () => {
    expect(
      parseReplicateOcrOutput('"Hello\nhello\nHELLO"')
    ).toEqual(["Hello"]);
  });

  it("trims whitespace and normalizes inner spaces", () => {
    expect(
      parseReplicateOcrOutput('"  Spaced   out  text  "')
    ).toEqual(["Spaced out text"]);
  });
});

describe("assemblePageNarrationText", () => {
  it("merges page text with included overlay entries in sort order", () => {
    const text = assemblePageNarrationText("Once upon a time.", [
      { text: "Second sign", includeInNarration: true, sortOrder: 2 },
      { text: "Skipped", includeInNarration: false, sortOrder: 1 },
      { text: "First sign", includeInNarration: true, sortOrder: 0 },
    ]);

    expect(text).toBe("Once upon a time.\nFirst sign\nSecond sign");
  });

  it("returns only overlay text when page text is empty", () => {
    const text = assemblePageNarrationText("", [
      { text: "Sign only", includeInNarration: true, sortOrder: 0 },
    ]);
    expect(text).toBe("Sign only");
  });

  it("returns only page text when no overlay entries are included", () => {
    const text = assemblePageNarrationText("Page text here.", [
      { text: "Excluded", includeInNarration: false, sortOrder: 0 },
    ]);
    expect(text).toBe("Page text here.");
  });

  it("returns empty string when both page text and overlay entries are empty", () => {
    expect(assemblePageNarrationText("", [])).toBe("");
    expect(assemblePageNarrationText(null, [])).toBe("");
  });

  it("extracts pronunciation tokens from included overlay text", () => {
    expect(
      extractPageNarrationTokens("", [
        { text: "Café", includeInNarration: true, sortOrder: 0 },
        { text: "Hidden", includeInNarration: false, sortOrder: 1 },
      ])
    ).toContain("café");
  });

  it("deduplicates pronunciation tokens across page text and overlay entries", () => {
    const tokens = extractPageNarrationTokens("hello world", [
      { text: "Hello again", includeInNarration: true, sortOrder: 0 },
    ]);
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("again");
    // Should not duplicate "hello"
    expect(tokens.filter((t) => t === "hello")).toHaveLength(1);
  });
});

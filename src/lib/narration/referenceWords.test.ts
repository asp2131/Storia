import { describe, expect, it } from "vitest";
import { buildPageReferenceWords } from "./referenceWords";

/**
 * PARITY FIXTURE — mirrored by the Dart test in storia-mobile
 * (`test/features/narration_studio/reference_words_parity_test.dart`).
 * Both tokenizers must produce EXPECTED_TOKENS for this page. If you change one,
 * change the other; a divergence silently misaligns word highlighting.
 */
export const PARITY_PAGE = {
  text_overlay: {
    version: 1,
    elements: [
      { id: "a", text: "Once upon a time," },
      { id: "b", text: "a small fox   found\na lantern." },
    ],
  },
  text_content: "Once upon a time, a small fox found a lantern.",
};

export const EXPECTED_TOKENS = [
  "Once",
  "upon",
  "a",
  "time,",
  "a",
  "small",
  "fox",
  "found",
  "a",
  "lantern.",
];

describe("buildPageReferenceWords", () => {
  it("tokenizes overlay elements in stored order (parity fixture)", () => {
    const { tokens, text } = buildPageReferenceWords(PARITY_PAGE);

    expect(tokens).toEqual(EXPECTED_TOKENS);
    expect(text).toBe(EXPECTED_TOKENS.join(" "));
  });

  it("keeps punctuation attached and does not normalize tokens", () => {
    const { tokens } = buildPageReferenceWords({
      text_overlay: { elements: [{ text: "Wait— don't GO!" }] },
    });

    expect(tokens).toEqual(["Wait—", "don't", "GO!"]);
  });

  it("preserves duplicate words rather than deduping", () => {
    const { tokens } = buildPageReferenceWords({
      text_overlay: { elements: [{ text: "run run run" }] },
    });

    expect(tokens).toEqual(["run", "run", "run"]);
  });

  it("falls back to text_content when there is no overlay", () => {
    const { tokens } = buildPageReferenceWords({
      text_content: "  The  end.  ",
    });

    expect(tokens).toEqual(["The", "end."]);
  });

  it("reads legacy overlays that would fail strict version validation", () => {
    const { tokens } = buildPageReferenceWords({
      text_overlay: { version: 0, elements: [{ text: "old but readable" }] },
    });

    expect(tokens).toEqual(["old", "but", "readable"]);
  });

  it("skips empty elements without shifting order", () => {
    const { tokens } = buildPageReferenceWords({
      text_overlay: { elements: [{ text: "first" }, { text: "   " }, { text: "second" }] },
    });

    expect(tokens).toEqual(["first", "second"]);
  });

  it("returns no tokens for an image-only page", () => {
    expect(buildPageReferenceWords({ text_overlay: null, text_content: null }).tokens).toEqual([]);
    expect(buildPageReferenceWords({ text_overlay: { elements: [] } }).tokens).toEqual([]);
  });
});

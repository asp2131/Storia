import { describe, expect, it } from "vitest";
import {
  createStoredPronunciationEntry,
  extractUniquePronunciationTokens,
  normalizePronunciationToken,
  resolvePronunciationUrl,
  type WordPronunciationEntry,
  type WordPronunciationMap,
} from "@/lib/pronunciation";

describe("normalizePronunciationToken", () => {
  it("lowercases the token", () => {
    expect(normalizePronunciationToken("Hello")).toBe("hello");
    expect(normalizePronunciationToken("ADVENTURE")).toBe("adventure");
  });

  it("trims whitespace", () => {
    expect(normalizePronunciationToken("  hello  ")).toBe("hello");
  });

  it("strips leading and trailing punctuation", () => {
    expect(normalizePronunciationToken("hello,")).toBe("hello");
    expect(normalizePronunciationToken(".hello!")).toBe("hello");
    expect(normalizePronunciationToken('"quoted"')).toBe("quoted");
  });

  it("preserves internal punctuation like apostrophes and hyphens", () => {
    expect(normalizePronunciationToken("don't")).toBe("don't");
    expect(normalizePronunciationToken("well-known")).toBe("well-known");
  });

  it("preserves unicode letters and numbers", () => {
    expect(normalizePronunciationToken("Aeloria")).toBe("aeloria");
    expect(normalizePronunciationToken("café")).toBe("café");
    expect(normalizePronunciationToken("año")).toBe("año");
  });

  it("applies NFKC normalization", () => {
    // Composed vs decomposed form should collapse to the same key.
    const composed = "café";
    const decomposed = "café";
    expect(normalizePronunciationToken(composed)).toBe(
      normalizePronunciationToken(decomposed)
    );
  });

  it("returns empty string for punctuation-only or empty input", () => {
    expect(normalizePronunciationToken("")).toBe("");
    expect(normalizePronunciationToken("!!!")).toBe("");
    expect(normalizePronunciationToken("   ")).toBe("");
  });
});

describe("extractUniquePronunciationTokens", () => {
  it("splits on whitespace and normalizes each token", () => {
    expect(extractUniquePronunciationTokens("Hello world")).toEqual([
      "hello",
      "world",
    ]);
  });

  it("deduplicates by normalized key", () => {
    expect(
      extractUniquePronunciationTokens("Hello, hello! HELLO world")
    ).toEqual(["hello", "world"]);
  });

  it("skips tokens that normalize to empty", () => {
    expect(extractUniquePronunciationTokens("hello -- world")).toEqual([
      "hello",
      "world",
    ]);
  });

  it("returns empty array for empty or punctuation-only text", () => {
    expect(extractUniquePronunciationTokens("")).toEqual([]);
    expect(extractUniquePronunciationTokens("--- !!!")).toEqual([]);
  });

  it("preserves first-seen order", () => {
    expect(
      extractUniquePronunciationTokens("zebra alpha zebra beta alpha")
    ).toEqual(["zebra", "alpha", "beta"]);
  });
});

describe("createStoredPronunciationEntry", () => {
  it("returns object with only fullWord when breakdown omitted", () => {
    const entry = createStoredPronunciationEntry("/full.mp3");
    expect(entry).toEqual({ fullWord: "/full.mp3" });
    expect("breakdown" in entry).toBe(false);
  });

  it("returns object with both URLs when breakdown provided", () => {
    const entry = createStoredPronunciationEntry("/full.mp3", "/break.mp3");
    expect(entry).toEqual({ fullWord: "/full.mp3", breakdown: "/break.mp3" });
  });

  it("omits breakdown when passed empty string (falsy)", () => {
    const entry = createStoredPronunciationEntry("/full.mp3", "");
    expect(entry).toEqual({ fullWord: "/full.mp3" });
    expect("breakdown" in entry).toBe(false);
  });

  it("attaches metadata fields when provided", () => {
    const entry = createStoredPronunciationEntry("/full.mp3", "/b.mp3", {
      source: "tts",
      confidence: 0.9,
      status: "generated",
      generatedAt: "2026-04-23T00:00:00Z",
    });
    expect(entry).toEqual({
      fullWord: "/full.mp3",
      breakdown: "/b.mp3",
      source: "tts",
      confidence: 0.9,
      status: "generated",
      generatedAt: "2026-04-23T00:00:00Z",
    });
  });

  it("omits metadata keys when not provided (backward compat)", () => {
    const entry = createStoredPronunciationEntry("/full.mp3");
    expect("source" in entry).toBe(false);
    expect("confidence" in entry).toBe(false);
    expect("status" in entry).toBe(false);
    expect("generatedAt" in entry).toBe(false);
  });
});

describe("resolvePronunciationUrl", () => {
  it("returns undefined for undefined entry", () => {
    expect(resolvePronunciationUrl(undefined, "whole-word")).toBeUndefined();
    expect(resolvePronunciationUrl(undefined, "breakdown")).toBeUndefined();
  });

  it("returns legacy string entry for either mode", () => {
    expect(resolvePronunciationUrl("/legacy.mp3", "whole-word")).toBe(
      "/legacy.mp3"
    );
    expect(resolvePronunciationUrl("/legacy.mp3", "breakdown")).toBe(
      "/legacy.mp3"
    );
  });

  it("prefers breakdown then fullWord in breakdown mode", () => {
    expect(
      resolvePronunciationUrl(
        { breakdown: "/b.mp3", fullWord: "/f.mp3" },
        "breakdown"
      )
    ).toBe("/b.mp3");
    expect(
      resolvePronunciationUrl({ fullWord: "/f.mp3" }, "breakdown")
    ).toBe("/f.mp3");
  });

  it("prefers fullWord then breakdown in whole-word mode", () => {
    expect(
      resolvePronunciationUrl(
        { breakdown: "/b.mp3", fullWord: "/f.mp3" },
        "whole-word"
      )
    ).toBe("/f.mp3");
    expect(
      resolvePronunciationUrl({ breakdown: "/b.mp3" }, "whole-word")
    ).toBe("/b.mp3");
  });

  it("returns undefined when entry has no URLs", () => {
    expect(resolvePronunciationUrl({}, "breakdown")).toBeUndefined();
    expect(resolvePronunciationUrl({}, "whole-word")).toBeUndefined();
  });
});

describe("backend write → reader read contract", () => {
  it("extracts keys that match normalized lookup keys from rendered text", () => {
    const pageText = "The Adventure begins! adventure.";
    const tokens = extractUniquePronunciationTokens(pageText);
    expect(tokens).toEqual(["the", "adventure", "begins"]);

    // Simulate backend writing an entry under each token.
    const stored: WordPronunciationMap = {};
    for (const token of tokens) {
      stored[token] = createStoredPronunciationEntry(
        `https://cdn.example.com/${token}-full.mp3`,
        `https://cdn.example.com/${token}-break.mp3`
      );
    }

    // Reader looks up a rendered word with trailing punctuation.
    const renderedWord = "Adventure!";
    const lookupKey = normalizePronunciationToken(renderedWord);
    const entry = stored[lookupKey];
    expect(entry).toBeDefined();

    expect(resolvePronunciationUrl(entry, "breakdown")).toBe(
      "https://cdn.example.com/adventure-break.mp3"
    );
    expect(resolvePronunciationUrl(entry, "whole-word")).toBe(
      "https://cdn.example.com/adventure-full.mp3"
    );
  });

  it("reader falls back to fullWord when backend only generated fullWord", () => {
    const entry: WordPronunciationEntry = createStoredPronunciationEntry(
      "/cat-full.mp3"
    );
    expect(resolvePronunciationUrl(entry, "breakdown")).toBe("/cat-full.mp3");
    expect(resolvePronunciationUrl(entry, "whole-word")).toBe("/cat-full.mp3");
  });

  it("every persisted entry is an object (not a legacy string)", () => {
    // Guard against the backend accidentally regressing to Record<string, string>.
    const tokens = extractUniquePronunciationTokens("cat dog fish");
    const stored: WordPronunciationMap = {};
    for (const token of tokens) {
      stored[token] = createStoredPronunciationEntry(`/${token}.mp3`);
    }

    for (const entry of Object.values(stored)) {
      expect(typeof entry).toBe("object");
      expect(entry).toHaveProperty("fullWord");
    }
  });
});

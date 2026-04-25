import { describe, expect, it } from "vitest";
import {
  createStoredPronunciationEntry,
  extractUniquePronunciationTokens,
  manifestEntryToWordPronunciationEntry,
  manifestToWordPronunciationMap,
  normalizePronunciationToken,
  resolvePronunciationUrl,
  resolvePublishedPronunciationUrl,
  type BookPronunciationManifest,
  type LegacyBookPronunciationManifest,
  type PublishedWordPronunciation,
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

describe("resolvePublishedPronunciationUrl", () => {
  it("prefers nested breakdown then fullWord audio in breakdown mode", () => {
    const entry: PublishedWordPronunciation = {
      id: "42:adventure",
      normalizedWord: "adventure",
      humanReviewed: false,
      updatedAt: "2026-04-23T00:00:00Z",
      audio: {
        breakdown: { url: "/break.mp3" },
        fullWord: { url: "/full.mp3" },
      },
    };

    expect(resolvePublishedPronunciationUrl(entry, "breakdown")).toBe("/break.mp3");
    expect(resolvePublishedPronunciationUrl(entry, "whole-word")).toBe("/full.mp3");
  });

  it("falls back across nested audio variants when one is missing", () => {
    const entry: PublishedWordPronunciation = {
      id: "42:cat",
      normalizedWord: "cat",
      humanReviewed: false,
      updatedAt: "2026-04-23T00:00:00Z",
      audio: {
        fullWord: { url: "/cat.mp3" },
      },
    };

    expect(resolvePublishedPronunciationUrl(entry, "breakdown")).toBe("/cat.mp3");
    expect(resolvePublishedPronunciationUrl(entry, "whole-word")).toBe("/cat.mp3");
  });
});

describe("manifestEntryToWordPronunciationEntry", () => {
  it("converts the published manifest shape into the reader storage shape", () => {
    const entry: PublishedWordPronunciation = {
      id: "42:adventure",
      normalizedWord: "adventure",
      source: "tts",
      confidence: 0.88,
      status: "generated",
      humanReviewed: false,
      updatedAt: "2026-04-23T00:00:00Z",
      audio: {
        breakdown: { url: "/break.mp3" },
        fullWord: { url: "/full.mp3" },
      },
    };

    expect(manifestEntryToWordPronunciationEntry(entry)).toEqual({
      breakdown: "/break.mp3",
      fullWord: "/full.mp3",
      source: "tts",
      confidence: 0.88,
      status: "generated",
      generatedAt: "2026-04-23T00:00:00Z",
    });
  });

  it("omits absent optional fields while preserving backward compatibility", () => {
    const entry: PublishedWordPronunciation = {
      id: "42:cat",
      normalizedWord: "cat",
      humanReviewed: false,
      updatedAt: "2026-04-23T00:00:00Z",
      audio: {
        fullWord: { url: "/cat.mp3" },
      },
    };

    expect(manifestEntryToWordPronunciationEntry(entry)).toEqual({
      fullWord: "/cat.mp3",
      generatedAt: "2026-04-23T00:00:00Z",
    });
  });

  it("accepts legacy manifest entries without metadata loss", () => {
    expect(
      manifestEntryToWordPronunciationEntry({
        word: "cat",
        fullWord: "/cat.mp3",
        breakdown: "/cat-break.mp3",
      })
    ).toEqual({
      fullWord: "/cat.mp3",
      breakdown: "/cat-break.mp3",
    });
  });
});

describe("manifestToWordPronunciationMap", () => {
  it("normalizes every published manifest entry into the reader storage shape", () => {
    const manifest: BookPronunciationManifest = {
      bookId: "42",
      version: 1,
      locale: "en-US",
      defaultPlaybackMode: "breakdown_then_word",
      entries: {
        cat: {
          id: "42:cat",
          normalizedWord: "cat",
          humanReviewed: false,
          updatedAt: "2026-04-23T00:00:00Z",
          audio: {
            fullWord: { url: "/cat.mp3" },
          },
        },
        adventure: {
          id: "42:adventure",
          normalizedWord: "adventure",
          source: "tts",
          confidence: 0.87,
          status: "generated",
          humanReviewed: false,
          updatedAt: "2026-04-23T00:00:00Z",
          audio: {
            fullWord: { url: "/full.mp3" },
            breakdown: { url: "/break.mp3" },
          },
        },
      },
    };

    expect(manifestToWordPronunciationMap(manifest)).toEqual({
      cat: {
        fullWord: "/cat.mp3",
        generatedAt: "2026-04-23T00:00:00Z",
      },
      adventure: {
        fullWord: "/full.mp3",
        breakdown: "/break.mp3",
        source: "tts",
        confidence: 0.87,
        status: "generated",
        generatedAt: "2026-04-23T00:00:00Z",
      },
    });
  });

  it("normalizes every legacy manifest entry into the reader storage shape", () => {
    const manifest: LegacyBookPronunciationManifest = {
      bookId: "42",
      version: 1,
      entries: {
        cat: {
          word: "cat",
          fullWord: "/cat.mp3",
        },
        adventure: {
          word: "adventure",
          fullWord: "/full.mp3",
          breakdown: "/break.mp3",
        },
      },
    };

    expect(manifestToWordPronunciationMap(manifest)).toEqual({
      cat: {
        fullWord: "/cat.mp3",
      },
      adventure: {
        fullWord: "/full.mp3",
        breakdown: "/break.mp3",
      },
    });
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

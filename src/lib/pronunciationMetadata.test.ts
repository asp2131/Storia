import { describe, expect, it } from "vitest";
import {
  attachTimingsToSegments,
  BREAKDOWN_SEGMENT_SEPARATOR,
  buildBreakdownSegments,
  buildBreakdownSpeechTextFromSegments,
  phoneticDisplay,
  splitIntoBreakdownChunks,
  syllabify,
  wrapWithPhoneme,
} from "./pronunciationMetadata";

describe("buildBreakdownSegments", () => {
  it("returns one segment for short words", () => {
    expect(buildBreakdownSegments("cat")).toEqual([
      { index: 0, chunk: "cat", spoken: "cat" },
    ]);
  });

  it("returns multiple segments for multi-syllable words", () => {
    const segs = buildBreakdownSegments("wonderful");
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0].index).toBe(0);
    expect(segs[segs.length - 1].index).toBe(segs.length - 1);
  });

  it("rewrites tion suffix to shun in spoken form", () => {
    const segs = buildBreakdownSegments("caption");
    expect(segs.map((s) => s.chunk)).toEqual(["cap", "tion"]);
    expect(segs.map((s) => s.spoken)).toEqual(["cap", "shun"]);
  });

  it("returns empty for empty input", () => {
    expect(buildBreakdownSegments("")).toEqual([]);
  });
});

describe("splitIntoBreakdownChunks", () => {
  it("handles single-char input", () => {
    expect(splitIntoBreakdownChunks("a")).toEqual(["a"]);
  });

  it("returns single chunk for words hypher cannot syllabify", () => {
    // Real syllabification is preferred over a forced split.
    expect(splitIntoBreakdownChunks("rhythm")).toEqual(["rhythm"]);
  });

  it("splits short common words now that hypher leftmin/rightmin are tuned", () => {
    // Default hypher refuses "hel-lo" (right syllable too short). With our
    // tuned mins it splits cleanly so kids hear hel-lo, not he-llo.
    expect(splitIntoBreakdownChunks("hello")).toEqual(["hel", "lo"]);
  });
});

describe("wrapWithPhoneme", () => {
  it("returns the bare word when phonetic is null", () => {
    expect(wrapWithPhoneme("hello", null)).toBe("hello");
    expect(wrapWithPhoneme("hello", undefined)).toBe("hello");
    expect(wrapWithPhoneme("hello", "")).toBe("hello");
  });

  it("strips slashes and emits an SSML phoneme tag", () => {
    expect(wrapWithPhoneme("hello", "/həˈloʊ/")).toBe(
      '<phoneme alphabet="ipa" ph="həˈloʊ">hello</phoneme>'
    );
  });

  it("escapes special chars in the visible word", () => {
    expect(wrapWithPhoneme("a&b", "/eɪ/")).toContain(">a&amp;b<");
  });
});

describe("buildBreakdownSpeechTextFromSegments", () => {
  it("returns null for single-segment input (no breakdown needed)", () => {
    expect(
      buildBreakdownSpeechTextFromSegments(buildBreakdownSegments("cat"))
    ).toBeNull();
  });

  it("joins multiple segments with the SSML break separator", () => {
    const text = buildBreakdownSpeechTextFromSegments(
      buildBreakdownSegments("caption")
    );
    expect(text).toBe(`cap${BREAKDOWN_SEGMENT_SEPARATOR}shun`);
  });
});

describe("syllabify", () => {
  it("hyphenates multi-syllable words", () => {
    expect(syllabify("wonderful")).toEqual(["won", "der", "ful"]);
  });

  it("returns the word itself for short input", () => {
    expect(syllabify("cat")).toEqual(["cat"]);
  });

  it("normalizes input case + edge punctuation", () => {
    expect(syllabify("Wonderful!")).toEqual(["won", "der", "ful"]);
  });

  it("returns empty for empty input", () => {
    expect(syllabify("")).toEqual([]);
  });
});

describe("phoneticDisplay", () => {
  it("returns IPA wrapped in slashes for dictionary words", () => {
    const ipa = phoneticDisplay("wonderful");
    expect(ipa).toMatch(/^\/.+\/$/);
    // primary stress marker should appear somewhere
    expect(ipa).toContain("ˈ");
  });

  it("returns null for words not in CMU dict", () => {
    expect(phoneticDisplay("zzzfakeword")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(phoneticDisplay("")).toBeNull();
  });
});

describe("attachTimingsToSegments", () => {
  const segments = buildBreakdownSegments("wonderful");
  const breakdownText = buildBreakdownSpeechTextFromSegments(segments)!;

  it("matches strategy 1 when alignment length equals input text length", () => {
    const characters = breakdownText.split("");
    const starts = characters.map((_, i) => i * 0.05);
    const ends = characters.map((_, i) => i * 0.05 + 0.04);

    const result = attachTimingsToSegments(
      segments,
      {
        characters,
        character_start_times_seconds: starts,
        character_end_times_seconds: ends,
      },
      breakdownText
    );

    expect(result).toHaveLength(segments.length);
    for (const seg of result) {
      expect(typeof seg.startMs).toBe("number");
      expect(typeof seg.endMs).toBe("number");
      expect(seg.endMs!).toBeGreaterThanOrEqual(seg.startMs!);
    }
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startMs!).toBeGreaterThan(result[i - 1].endMs!);
    }
  });

  it("falls back to substring search when alignment is normalized (SSML stripped)", () => {
    const normalized = "won der ful";
    const characters = normalized.split("");
    const starts = characters.map((_, i) => i * 0.1);
    const ends = characters.map((_, i) => i * 0.1 + 0.08);

    const result = attachTimingsToSegments(
      segments,
      {
        characters,
        character_start_times_seconds: starts,
        character_end_times_seconds: ends,
      },
      breakdownText
    );

    expect(result).toHaveLength(segments.length);
    expect(typeof result[0].startMs).toBe("number");
    expect(typeof result[1].startMs).toBe("number");
    expect(typeof result[2].startMs).toBe("number");
  });

  it("returns segments unchanged when alignment is missing", () => {
    expect(attachTimingsToSegments(segments, undefined, breakdownText)).toEqual(
      segments
    );
    expect(attachTimingsToSegments(segments, null, breakdownText)).toEqual(
      segments
    );
  });

  it("returns segments unchanged when alignment characters array is empty", () => {
    const result = attachTimingsToSegments(
      segments,
      { characters: [] },
      breakdownText
    );
    expect(result).toEqual(segments);
  });
});

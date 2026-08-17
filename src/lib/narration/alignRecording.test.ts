import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockForceAlign } = vi.hoisted(() => ({ mockForceAlign: vi.fn() }));

vi.mock("@/lib/elevenlabs", () => ({ forceAlign: mockForceAlign }));

import {
  alignRecording,
  assertTimestampsValid,
  projectOntoTokens,
} from "./alignRecording";

const TOKENS = ["Once", "upon", "a", "time"];
const AUDIO = Buffer.from("fake-audio");

function args(overrides: Partial<Parameters<typeof alignRecording>[0]> = {}) {
  return {
    audio: AUDIO,
    contentType: "audio/mp4",
    tokens: TOKENS,
    durationSeconds: 4,
    ...overrides,
  };
}

describe("alignRecording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("marks a matching word count as aligned and keeps reference token text", async () => {
    mockForceAlign.mockResolvedValue({
      loss: 0.12,
      words: [
        { word: "once", start: 0, end: 0.5 },
        { word: "upon", start: 0.5, end: 1 },
        { word: "a", start: 1, end: 1.2 },
        { word: "time", start: 1.2, end: 2 },
      ],
    });

    const result = await alignRecording(args());

    expect(result.status).toBe("aligned");
    expect(result.loss).toBe(0.12);
    // Aligner lowercased "once" and dropped punctuation; the page text wins.
    expect(result.timestamps.map((t) => t.word)).toEqual(TOKENS);
    expect(result.timestamps[0].end).toBe(0.5);
  });

  it("sends the reference text as whitespace-joined tokens", async () => {
    mockForceAlign.mockResolvedValue({ words: [] });

    await alignRecording(args());

    expect(mockForceAlign).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Once upon a time" })
    );
  });

  it("projects when the aligner returns fewer words", async () => {
    mockForceAlign.mockResolvedValue({
      words: [
        { word: "once upon", start: 0, end: 1 },
        { word: "a time", start: 1, end: 2 },
      ],
    });

    const result = await alignRecording(args());

    expect(result.status).toBe("projected");
    expect(result.timestamps).toHaveLength(TOKENS.length);
    expect(result.timestamps.map((t) => t.word)).toEqual(TOKENS);
    // No zero-length spans, which would never highlight.
    expect(result.timestamps.every((t) => t.end > t.start)).toBe(true);
  });

  it("projects when the aligner returns more words", async () => {
    mockForceAlign.mockResolvedValue({
      words: Array.from({ length: 9 }, (_, i) => ({
        word: `w${i}`,
        start: i * 0.4,
        end: (i + 1) * 0.4,
      })),
    });

    const result = await alignRecording(args());

    expect(result.status).toBe("projected");
    expect(result.timestamps).toHaveLength(TOKENS.length);
  });

  it("falls back to proportional timing when the aligner returns nothing", async () => {
    mockForceAlign.mockResolvedValue({ words: [] });

    const result = await alignRecording(args());

    expect(result.status).toBe("fallback");
    expect(result.timestamps).toHaveLength(TOKENS.length);
    expect(result.timestamps[result.timestamps.length - 1].end).toBe(4);
  });

  it("falls back when the aligner throws", async () => {
    mockForceAlign.mockRejectedValue(new Error("ElevenLabs forced alignment failed (429)"));

    const result = await alignRecording(args());

    expect(result.status).toBe("fallback");
    expect(result.timestamps).toHaveLength(TOKENS.length);
  });

  it("returns an empty result for a page with no words", async () => {
    const result = await alignRecording(args({ tokens: [] }));

    expect(result.timestamps).toEqual([]);
    expect(mockForceAlign).not.toHaveBeenCalled();
  });

  it("always emits one timing per reference word", async () => {
    mockForceAlign.mockResolvedValue({
      words: [{ word: "everything", start: 0, end: 3 }],
    });

    const result = await alignRecording(args());

    expect(result.timestamps).toHaveLength(TOKENS.length);
  });
});

describe("projectOntoTokens", () => {
  it("stays monotonic when many tokens collapse onto one aligned word", () => {
    const projected = projectOntoTokens(
      [{ word: "blob", start: 0, end: 2 }],
      ["a", "b", "c", "d"],
      2
    );

    expect(projected).toHaveLength(4);
    for (let i = 1; i < projected.length; i++) {
      expect(projected[i].start).toBeGreaterThan(projected[i - 1].start);
    }
    expect(projected[3].end).toBe(2);
  });

  it("falls back when there is nothing to project from", () => {
    const projected = projectOntoTokens([], ["a", "b"], 2);

    expect(projected).toHaveLength(2);
    expect(projected[1].end).toBe(2);
  });
});

describe("assertTimestampsValid", () => {
  it("rejects a count mismatch", () => {
    expect(() =>
      assertTimestampsValid([{ word: "a", start: 0, end: 1 }], ["a", "b"])
    ).toThrow(/count mismatch/);
  });

  it("rejects inverted spans", () => {
    expect(() => assertTimestampsValid([{ word: "a", start: 2, end: 1 }], ["a"])).toThrow(
      /Inverted/
    );
  });

  it("rejects non-monotonic starts", () => {
    expect(() =>
      assertTimestampsValid(
        [
          { word: "a", start: 1, end: 2 },
          { word: "b", start: 0, end: 3 },
        ],
        ["a", "b"]
      )
    ).toThrow(/monotonic/);
  });

  it("accepts a well-formed array", () => {
    expect(() =>
      assertTimestampsValid(
        [
          { word: "a", start: 0, end: 1 },
          { word: "b", start: 1, end: 2 },
        ],
        ["a", "b"]
      )
    ).not.toThrow();
  });
});

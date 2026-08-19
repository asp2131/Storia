import { afterEach, describe, expect, it, vi } from "vitest";
import { forceAlign } from "./elevenlabs";

/**
 * Regression: /v1/forced-alignment interleaves whitespace-only entries between
 * real words. Passing them through makes the word count disagree with the
 * page's reference tokens, which silently downgrades `aligned` to `projected`
 * and drifts the reader's word highlighting.
 */
describe("forceAlign", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drops the whitespace spacer entries between words", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          loss: 0.15,
          words: [
            { text: "I'm", start: 0.74, end: 0.959 },
            { text: " ", start: 0.959, end: 1.0 },
            { text: "going", start: 1.0, end: 1.24 },
            { text: " ", start: 1.24, end: 1.259 },
            { text: "to", start: 1.259, end: 1.339 },
          ],
        }),
      })
    );

    const result = await forceAlign({
      audio: Buffer.from("fake"),
      contentType: "audio/mp4",
      text: "I'm going to",
    });

    expect(result.words.map((w) => w.word)).toEqual(["I'm", "going", "to"]);
    expect(result.loss).toBe(0.15);
  });
});

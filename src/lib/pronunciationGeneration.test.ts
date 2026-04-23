import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  collectMissingTokens,
  entryCoverageStatus,
  splitIntoBreakdownChunks,
  generatePronunciationEntries,
} from "./pronunciationGeneration";

vi.mock("@/lib/elevenlabs", () => ({
  synthesizeSpeech: vi.fn(async ({ text }: { text: string }) => ({
    audioBuffer: Buffer.from(`audio:${text}`),
    contentType: "audio/mpeg",
  })),
}));

function fakeSupabase() {
  const uploads: Array<{ path: string; contentType: string }> = [];
  return {
    storage: {
      from(_bucket: string) {
        return {
          upload: vi.fn(async (path: string, _buf: Buffer, opts: { contentType: string }) => {
            uploads.push({ path, contentType: opts.contentType });
            return { error: null };
          }),
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://cdn.example/${path}` },
          }),
        };
      },
    },
    uploads,
  } as unknown as {
    storage: {
      from: (b: string) => {
        upload: ReturnType<typeof vi.fn>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
    uploads: Array<{ path: string; contentType: string }>;
  };
}

describe("splitIntoBreakdownChunks", () => {
  it("returns single chunk for short words", () => {
    expect(splitIntoBreakdownChunks("cat")).toEqual(["cat"]);
    expect(splitIntoBreakdownChunks("a")).toEqual(["a"]);
  });

  it("splits multisyllable words into multiple chunks", () => {
    const chunks = splitIntoBreakdownChunks("butterfly");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.join("")).toMatch(/butterfly|butterfl/);
  });
});

describe("collectMissingTokens", () => {
  it("returns normalized tokens with no audio", () => {
    const tokens = collectMissingTokens([
      {
        textContent: "Hello World",
        entries: { hello: "https://x/hello.mp3" },
      },
    ]);
    expect(tokens.sort()).toEqual(["world"]);
  });

  it("force=true returns all tokens", () => {
    const tokens = collectMissingTokens(
      [
        {
          textContent: "Hello World",
          entries: { hello: "https://x/hello.mp3" },
        },
      ],
      { force: true }
    );
    expect(tokens.sort()).toEqual(["hello", "world"]);
  });

  it("dedupes across pages", () => {
    const tokens = collectMissingTokens([
      { textContent: "hello world", entries: {} },
      { textContent: "hello there", entries: {} },
    ]);
    expect(tokens.sort()).toEqual(["hello", "there", "world"]);
  });
});

describe("entryCoverageStatus", () => {
  it("missing when undefined", () => {
    expect(entryCoverageStatus(undefined)).toBe("missing");
  });
  it("full-word-only for strings", () => {
    expect(entryCoverageStatus("https://x")).toBe("full-word-only");
  });
  it("covered when both present", () => {
    expect(
      entryCoverageStatus({
        fullWord: "https://x/full.mp3",
        breakdown: "https://x/br.mp3",
      })
    ).toBe("covered");
  });
  it("full-word-only when only fullWord", () => {
    expect(entryCoverageStatus({ fullWord: "https://x" })).toBe("full-word-only");
  });
  it("missing when entry present but empty", () => {
    expect(entryCoverageStatus({})).toBe("missing");
  });
});

describe("generatePronunciationEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips words with existing audio unless force", async () => {
    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["hello", "world"],
      existingEntries: { hello: "https://existing/hello.mp3" },
    });

    expect(result.stats.skipped).toBe(1);
    expect(result.stats.generated).toBe(1);
    expect(result.pronunciationMap.hello).toBe("https://existing/hello.mp3");
    expect(result.pronunciationMap.world).toBeDefined();
  });

  it("regenerates all when force=true", async () => {
    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["hello"],
      existingEntries: { hello: "https://existing/hello.mp3" },
      force: true,
    });

    expect(result.stats.skipped).toBe(0);
    expect(result.stats.generated).toBe(1);
    const entry = result.pronunciationMap.hello;
    expect(typeof entry).toBe("object");
    if (typeof entry === "object") {
      expect(entry.source).toBe("tts");
      expect(entry.status).toBe("generated");
      expect(entry.fullWord).toContain("cdn.example");
    }
  });

  it("records metadata on generated entries", async () => {
    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["butterfly"],
    });

    const entry = result.pronunciationMap.butterfly;
    expect(typeof entry).toBe("object");
    if (typeof entry === "object") {
      expect(entry.source).toBe("tts");
      expect(entry.confidence).toBe(1);
      expect(entry.status).toBe("generated");
      expect(typeof entry.generatedAt).toBe("string");
    }
  });

  it("records failure stats when synthesize throws", async () => {
    const { synthesizeSpeech } = await import("@/lib/elevenlabs");
    (synthesizeSpeech as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom")
    );

    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["oops"],
    });

    expect(result.stats.failed).toBe(1);
    expect(result.stats.generated).toBe(0);
    expect(result.stats.failures[0]?.error).toBe("boom");
    expect(result.pronunciationMap.oops).toBeUndefined();
  });
});

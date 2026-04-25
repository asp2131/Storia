import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockSynthesizeSpeech } = vi.hoisted(() => ({
  mockPrisma: {
    book_pronunciations: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
  mockSynthesizeSpeech: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/elevenlabs", () => ({
  synthesizeSpeech: mockSynthesizeSpeech,
}));

import {
  collectMissingTokens,
  entryCoverageStatus,
  splitIntoBreakdownChunks,
  generatePronunciationEntries,
  type BookPronunciationRow,
} from "./pronunciationGeneration";

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

function makeRow(
  overrides: Partial<BookPronunciationRow> & { normalized_word: string }
): BookPronunciationRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const { normalized_word, ...rest } = overrides;
  return {
    id: 1n,
    book_id: 42n,
    normalized_word,
    display_word: null,
    phonetic_display: null,
    syllables: null,
    breakdown_segments: null,
    full_word_url: null,
    breakdown_url: null,
    source: "tts",
    status: "generated",
    confidence: null,
    human_reviewed: false,
    generated_at: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
    ...rest,
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
  it("returns normalized tokens with no table audio", () => {
    const tokens = collectMissingTokens(
      [["hello", "world"]],
      [makeRow({ normalized_word: "hello", full_word_url: "https://x/hello.mp3" })]
    );
    expect(tokens.sort()).toEqual(["world"]);
  });

  it("force=true returns all unreviewed tokens", () => {
    const tokens = collectMissingTokens(
      [["hello", "world"]],
      [makeRow({ normalized_word: "hello", full_word_url: "https://x/hello.mp3" })],
      { force: true }
    );
    expect(tokens.sort()).toEqual(["hello", "world"]);
  });

  it("dedupes across pages", () => {
    const tokens = collectMissingTokens(
      [
        ["hello", "world"],
        ["hello", "there"],
      ],
      []
    );
    expect(tokens.sort()).toEqual(["hello", "there", "world"]);
  });
});

describe("entryCoverageStatus", () => {
  it("missing when undefined", () => {
    expect(entryCoverageStatus(undefined)).toBe("missing");
  });
  it("full-word-only when only full_word_url is present", () => {
    expect(
      entryCoverageStatus({
        full_word_url: "https://x/full.mp3",
        breakdown_url: null,
      })
    ).toBe("full-word-only");
  });
  it("covered when both table URLs are present", () => {
    expect(
      entryCoverageStatus({
        full_word_url: "https://x/full.mp3",
        breakdown_url: "https://x/br.mp3",
      })
    ).toBe("covered");
  });
  it("full-word-only when only breakdown_url is present", () => {
    expect(
      entryCoverageStatus({
        full_word_url: null,
        breakdown_url: "https://x/breakdown.mp3",
      })
    ).toBe("full-word-only");
  });
  it("missing when entry present but empty", () => {
    expect(entryCoverageStatus({ full_word_url: null, breakdown_url: null })).toBe(
      "missing"
    );
  });
});

describe("generatePronunciationEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([]);
    mockPrisma.book_pronunciations.upsert.mockResolvedValue({});
    mockSynthesizeSpeech.mockImplementation(async ({ text }: { text: string }) => ({
      audioBuffer: Buffer.from(`audio:${text}`),
      contentType: "audio/mpeg",
    }));
  });

  it("skips words with existing table audio unless force", async () => {
    const existing = makeRow({
      normalized_word: "hello",
      full_word_url: "https://existing/hello.mp3",
      generated_at: new Date("2026-01-01T00:00:00.000Z"),
    });
    const generated = makeRow({
      normalized_word: "world",
      full_word_url: "https://cdn.example/books/42/pronunciations/full-word/world.mp3",
      generated_at: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockPrisma.book_pronunciations.findMany
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([existing, generated]);

    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["hello", "world"],
    });

    expect(result.stats.skipped).toBe(1);
    expect(result.stats.generated).toBe(1);
    expect(mockSynthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ text: "world" })
    );
    expect(mockSynthesizeSpeech).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: "hello" })
    );
    expect(mockPrisma.book_pronunciations.upsert).toHaveBeenCalledTimes(1);
    expect(result.rows).toEqual([existing, generated]);
    expect(result.pronunciationMap.hello).toMatchObject({
      fullWord: "https://existing/hello.mp3",
      source: "tts",
      status: "generated",
    });
    expect(result.pronunciationMap.world).toMatchObject({
      fullWord: "https://cdn.example/books/42/pronunciations/full-word/world.mp3",
    });
  });

  it("regenerates all when force=true", async () => {
    const existing = makeRow({
      normalized_word: "hello",
      full_word_url: "https://existing/hello.mp3",
    });
    const regenerated = makeRow({
      normalized_word: "hello",
      full_word_url: "https://cdn.example/books/42/pronunciations/full-word/hello.mp3",
      generated_at: new Date("2026-01-02T00:00:00.000Z"),
    });
    mockPrisma.book_pronunciations.findMany
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([regenerated]);

    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["hello"],
      force: true,
    });

    expect(result.stats.skipped).toBe(0);
    expect(result.stats.generated).toBe(1);
    expect(mockPrisma.book_pronunciations.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          book_id_normalized_word: {
            book_id: 42n,
            normalized_word: "hello",
          },
        },
        update: expect.objectContaining({
          source: "tts",
          status: "generated",
          confidence: 1,
          full_word_url: expect.stringContaining("cdn.example"),
        }),
      })
    );
    expect(result.pronunciationMap.hello).toMatchObject({
      source: "tts",
      status: "generated",
      fullWord: "https://cdn.example/books/42/pronunciations/full-word/hello.mp3",
    });
  });

  it("records metadata on generated table rows", async () => {
    const generatedAt = new Date("2026-01-02T00:00:00.000Z");
    const butterfly = makeRow({
      normalized_word: "butterfly",
      full_word_url: "https://cdn.example/books/42/pronunciations/full-word/butterfly.mp3",
      breakdown_url: "https://cdn.example/books/42/pronunciations/breakdown/butterfly.mp3",
      source: "tts",
      status: "generated",
      confidence: 1,
      generated_at: generatedAt,
    });
    mockPrisma.book_pronunciations.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([butterfly]);

    const supabase = fakeSupabase();
    const result = await generatePronunciationEntries({
      supabase: supabase as never,
      bucket: "test",
      bookId: "42",
      voiceId: "v1",
      voiceSettings: { speed: 1, style: 0, useSpeakerBoost: false },
      words: ["butterfly"],
    });

    expect(result.pronunciationMap.butterfly).toMatchObject({
      source: "tts",
      confidence: 1,
      status: "generated",
      generatedAt: generatedAt.toISOString(),
      fullWord: "https://cdn.example/books/42/pronunciations/full-word/butterfly.mp3",
      breakdown: "https://cdn.example/books/42/pronunciations/breakdown/butterfly.mp3",
    });
    expect(mockPrisma.book_pronunciations.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          normalized_word: "butterfly",
          source: "tts",
          status: "generated",
          confidence: 1,
          generated_at: expect.any(Date),
        }),
      })
    );
  });

  it("records failure stats when synthesize throws", async () => {
    mockSynthesizeSpeech.mockRejectedValueOnce(new Error("boom"));
    const failed = makeRow({
      normalized_word: "oops",
      status: "failed",
      source: "tts",
    });
    mockPrisma.book_pronunciations.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([failed]);

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
    expect(mockPrisma.book_pronunciations.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          normalized_word: "oops",
          source: "tts",
          status: "failed",
        }),
      })
    );
  });
});

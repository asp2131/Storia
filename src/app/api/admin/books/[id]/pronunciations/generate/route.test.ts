import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.SUPABASE_URL = "https://supabase.example";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.ELEVENLABS_API_KEY = "elevenlabs-key";

const {
  mockPrisma,
  mockCreateClient,
  mockResolveElevenLabsVoice,
  mockNormalizeVoiceSettings,
  mockGeneratePronunciationEntries,
} = vi.hoisted(() => ({
  mockPrisma: {
    pages: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    book_pronunciations: {
      findMany: vi.fn(),
    },
  },
  mockCreateClient: vi.fn(() => ({ storage: {} })),
  mockResolveElevenLabsVoice: vi.fn(async () => ({
    voiceId: "voice-1",
    voiceName: "Narrator",
  })),
  mockNormalizeVoiceSettings: vi.fn(() => ({
    speed: 1,
    style: 0,
    useSpeakerBoost: false,
  })),
  mockGeneratePronunciationEntries: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/elevenlabs", () => ({
  resolveElevenLabsVoice: mockResolveElevenLabsVoice,
  normalizeVoiceSettings: mockNormalizeVoiceSettings,
}));

vi.mock("@/lib/pronunciationGeneration", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pronunciationGeneration")>(
    "@/lib/pronunciationGeneration"
  );

  return {
    ...actual,
    generatePronunciationEntries: mockGeneratePronunciationEntries,
  };
});

import {
  GET,
  POST,
} from "@/app/api/admin/books/[id]/pronunciations/generate/route";

function makeRow(
  normalizedWord: string,
  urls: { full?: string | null; breakdown?: string | null } = {},
  overrides: Record<string, unknown> = {}
) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: 1n,
    book_id: 42n,
    normalized_word: normalizedWord,
    display_word: null,
    phonetic_display: null,
    syllables: null,
    breakdown_segments: null,
    full_word_url: urls.full ?? null,
    breakdown_url: urls.breakdown ?? null,
    source: "tts",
    status: "generated",
    confidence: null,
    human_reviewed: false,
    generated_at: now,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function stats(overrides: Record<string, unknown> = {}) {
  return {
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    withBreakdown: 0,
    failures: [],
    skippedReviewed: 0,
    ...overrides,
  };
}

describe("/api/admin/books/[id]/pronunciations/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({ storage: {} });
    mockResolveElevenLabsVoice.mockResolvedValue({
      voiceId: "voice-1",
      voiceName: "Narrator",
    });
    mockNormalizeVoiceSettings.mockReturnValue({
      speed: 1,
      style: 0,
      useSpeakerBoost: false,
    });
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([]);
    mockGeneratePronunciationEntries.mockResolvedValue({
      rows: [],
      pronunciationMap: {},
      stats: stats(),
    });
  });

  it("POST accepts string maxWords and returns editor-friendly summary fields", async () => {
    const hello = makeRow("hello", { full: "/hello.mp3" });
    const world = makeRow("world", { full: "/world-full.mp3" });

    mockPrisma.pages.findMany.mockResolvedValue([
      {
        id: 101n,
        page_number: 1,
        text_content: "Hello world",
      },
      {
        id: 102n,
        page_number: 2,
        text_content: "Again world",
      },
    ]);
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([hello]);
    mockGeneratePronunciationEntries.mockResolvedValue({
      rows: [hello, world],
      pronunciationMap: {},
      stats: stats({
        total: 1,
        generated: 1,
      }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/books/42/pronunciations/generate", {
        method: "POST",
        body: JSON.stringify({ maxWords: "1", force: "false" }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.book_pronunciations.findMany).toHaveBeenCalledWith({
      where: { book_id: 42n },
    });
    expect(mockGeneratePronunciationEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "42",
        force: false,
        words: ["world"],
      })
    );
    expect(mockPrisma.pages.update).not.toHaveBeenCalled();
    expect(body.request).toEqual({ force: false, maxWords: 1 });
    expect(body.summary).toMatchObject({
      uniqueBookTokens: 3,
      coveredBookWide: 2,
      missingBookWide: 1,
      requestedTokens: 1,
      remainingTokensAfterRun: 1,
      limitedByMaxWords: true,
      pagesTotal: 2,
      pagesWithMissing: 1,
      fullCoverage: false,
    });
    expect(body.coverage.perPage).toEqual([
      {
        pageId: "101",
        pageNumber: 1,
        total: 2,
        covered: 0,
        fullWordOnly: 2,
        missing: 0,
        missingWords: [],
        status: "partial",
      },
      {
        pageId: "102",
        pageNumber: 2,
        total: 2,
        covered: 0,
        fullWordOnly: 1,
        missing: 1,
        missingWords: ["again"],
        status: "partial",
      },
    ]);
  });

  it("POST rejects invalid maxWords values with 400", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/books/42/pronunciations/generate", {
        method: "POST",
        body: JSON.stringify({ maxWords: "abc" }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "maxWords must be a positive integer.",
      code: "invalid_max_words",
    });
  });

  it("GET returns summary counts and page statuses for coverage UI", async () => {
    mockPrisma.pages.findMany.mockResolvedValue([
      {
        id: 201n,
        page_number: 1,
        text_content: "Hello world",
      },
      {
        id: 202n,
        page_number: 2,
        text_content: "Again",
      },
    ]);
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([
      makeRow("hello", {
        full: "/hello-full.mp3",
        breakdown: "/hello-break.mp3",
      }),
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/books/42/pronunciations/generate"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.book_pronunciations.findMany).toHaveBeenCalledWith({
      where: { book_id: 42n },
      orderBy: { normalized_word: "asc" },
    });
    expect(body.summary).toEqual({
      uniqueBookTokens: 3,
      coveredBookWide: 1,
      missingBookWide: 2,
      ratio: 0.3333,
      pagesTotal: 2,
      pagesComplete: 0,
      pagesPartial: 1,
      pagesEmpty: 0,
      pagesWithMissing: 2,
      fullCoverage: false,
    });
    expect(body.coverage.perPage).toEqual([
      {
        pageId: "201",
        pageNumber: 1,
        total: 2,
        covered: 1,
        fullWordOnly: 0,
        missing: 1,
        missingWords: ["world"],
        status: "partial",
      },
      {
        pageId: "202",
        pageNumber: 2,
        total: 1,
        covered: 0,
        fullWordOnly: 0,
        missing: 1,
        missingWords: ["again"],
        status: "missing",
      },
    ]);
  });

  it("POST accepts stringified force=true and reports full coverage after regeneration", async () => {
    const oldHello = makeRow("hello", { full: "/old-hello.mp3" });
    const oldWorld = makeRow("world", { full: "/old-world.mp3" });
    const newHello = makeRow("hello", {
      full: "/hello-full.mp3",
      breakdown: "/hello-break.mp3",
    });
    const newWorld = makeRow("world", {
      full: "/world-full.mp3",
      breakdown: "/world-break.mp3",
    });

    mockPrisma.pages.findMany.mockResolvedValue([
      {
        id: 301n,
        page_number: 1,
        text_content: "Hello world",
      },
    ]);
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([oldHello, oldWorld]);
    mockGeneratePronunciationEntries.mockResolvedValue({
      rows: [newHello, newWorld],
      pronunciationMap: {},
      stats: stats({
        total: 2,
        generated: 2,
        withBreakdown: 2,
      }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/books/42/pronunciations/generate", {
        method: "POST",
        body: JSON.stringify({ force: "true" }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGeneratePronunciationEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        words: ["hello", "world"],
      })
    );
    expect(mockPrisma.pages.update).not.toHaveBeenCalled();
    expect(body.request).toEqual({ force: true, maxWords: null });
    expect(body.summary).toMatchObject({
      missingBookWide: 0,
      requestedTokens: 2,
      remainingTokensAfterRun: 0,
      limitedByMaxWords: false,
      fullCoverage: true,
      pagesComplete: 1,
    });
    expect(body.coverage.perPage).toEqual([
      {
        pageId: "301",
        pageNumber: 1,
        total: 2,
        covered: 2,
        fullWordOnly: 0,
        missing: 0,
        missingWords: [],
        status: "complete",
      },
    ]);
  });

  it("GET returns 400 for an invalid book id", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/books/not-a-number/pronunciations/generate"),
      {
        params: Promise.resolve({ id: "not-a-number" }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid book ID.",
      code: "invalid_book_id",
    });
  });

  it("GET returns 500 when coverage lookup fails", async () => {
    mockPrisma.pages.findMany.mockRejectedValue(new Error("db offline"));

    const response = await GET(
      new NextRequest("http://localhost/api/admin/books/42/pronunciations/generate"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "db offline" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    book_pronunciations: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/books/[id]/pronunciations/route";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    book_id: 42n,
    normalized_word: "adventure",
    display_word: "Adventure",
    phonetic_display: null,
    syllables: null,
    breakdown_segments: null,
    full_word_url: "/adventure-full.mp3",
    breakdown_url: "/adventure-break.mp3",
    source: "tts",
    status: "generated",
    confidence: 0.91,
    human_reviewed: false,
    generated_at: new Date("2026-04-23T00:00:00Z"),
    reviewed_at: null,
    created_at: new Date("2026-04-23T00:00:00Z"),
    updated_at: new Date("2026-04-23T00:00:00Z"),
    ...overrides,
  };
}

describe("/api/books/[id]/pronunciations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty manifest when the book has no pronunciation rows", async () => {
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
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
    expect(body).toEqual({
      bookId: "42",
      version: 1,
      locale: "en-US",
      defaultPlaybackMode: "breakdown_then_word",
      entries: {},
    });
  });

  it("serializes a row with both full-word and breakdown audio", async () => {
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([
      makeRow({
        syllables: ["ad", "ven", "ture"],
        breakdown_segments: [
          { index: 0, chunk: "ad", spoken: "ad", startMs: 0, endMs: 380 },
          { index: 1, chunk: "ven", spoken: "ven", startMs: 800, endMs: 1180 },
          { index: 2, chunk: "ture", spoken: "ture", startMs: 1600, endMs: 1980 },
        ],
        phonetic_display: "ad-ven-chur",
      }),
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.adventure).toEqual({
      id: "1",
      normalizedWord: "adventure",
      displayWord: "Adventure",
      phoneticDisplay: "ad-ven-chur",
      ipa: null,
      syllables: ["ad", "ven", "ture"],
      breakdownSegments: [
        { index: 0, chunk: "ad", spoken: "ad", startMs: 0, endMs: 380 },
        { index: 1, chunk: "ven", spoken: "ven", startMs: 800, endMs: 1180 },
        { index: 2, chunk: "ture", spoken: "ture", startMs: 1600, endMs: 1980 },
      ],
      source: "tts",
      confidence: 0.91,
      humanReviewed: false,
      status: "generated",
      audio: {
        fullWord: { url: "/adventure-full.mp3" },
        breakdown: { url: "/adventure-break.mp3" },
      },
      updatedAt: new Date("2026-04-23T00:00:00Z").toISOString(),
    });
  });

  it("promotes legacy bare-string segments to objects for forward compat", async () => {
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([
      makeRow({
        normalized_word: "legacy",
        display_word: "Legacy",
        breakdown_segments: ["leg", "a", "cy"],
      }),
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.legacy.breakdownSegments).toEqual([
      { index: 0, chunk: "leg", spoken: "leg" },
      { index: 1, chunk: "a", spoken: "a" },
      { index: 2, chunk: "cy", spoken: "cy" },
    ]);
  });

  it("omits the breakdown audio key when only full_word_url is present", async () => {
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([
      makeRow({
        id: 2n,
        normalized_word: "cat",
        display_word: null,
        full_word_url: "/cat.mp3",
        breakdown_url: null,
      }),
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.cat.displayWord).toBe("cat");
    expect(body.entries.cat.audio).toEqual({
      fullWord: { url: "/cat.mp3" },
    });
    expect(body.entries.cat.audio).not.toHaveProperty("breakdown");
  });

  it("reports human_reviewed rows via humanReviewed: true", async () => {
    mockPrisma.book_pronunciations.findMany.mockResolvedValue([
      makeRow({
        id: 3n,
        normalized_word: "reviewed",
        display_word: "Reviewed",
        human_reviewed: true,
        status: "reviewed",
      }),
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.reviewed.humanReviewed).toBe(true);
    expect(body.entries.reviewed.status).toBe("reviewed");
  });

  it("returns 400 for an invalid bookId param", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/books/not-a-number/pronunciations"),
      {
        params: Promise.resolve({ id: "not-a-number" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: { code: "invalid_book_id", message: "Invalid book ID." },
    });
    expect(mockPrisma.book_pronunciations.findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when manifest lookup fails", async () => {
    mockPrisma.book_pronunciations.findMany.mockRejectedValue(
      new Error("db offline")
    );

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "internal_error",
        message: "Failed to fetch pronunciations",
      },
    });
  });
});

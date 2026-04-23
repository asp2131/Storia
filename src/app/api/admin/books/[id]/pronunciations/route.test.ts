import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    pages: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/admin/books/[id]/pronunciations/route";

describe("/api/admin/books/[id]/pronunciations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns editor-friendly per-word review rows with normalized words, audio URLs, and metadata", async () => {
    mockPrisma.pages.findMany.mockResolvedValue([
      {
        id: 101n,
        page_number: 1,
        text_content: "Hello, world! HELLO",
        word_pronunciations: {
          hello: {
            fullWord: "/hello-full.mp3",
            breakdown: "/hello-break.mp3",
            source: "tts",
            status: "generated",
            generatedAt: "2026-04-23T10:00:00.000Z",
          },
        },
      },
      {
        id: 102n,
        page_number: 2,
        text_content: "World lantern",
        word_pronunciations: {
          world: {
            fullWord: "/world-full.mp3",
            source: "override",
            status: "reviewed",
            confidence: 0.92,
            generatedAt: "2026-04-23T11:00:00.000Z",
          },
          lantern: {
            source: "tts",
            status: "failed",
            generatedAt: "2026-04-23T12:00:00.000Z",
          },
        },
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({
      search: null,
      pageNumber: null,
      coverageStatus: null,
      reviewStatus: null,
      limit: null,
      offset: 0,
    });
    expect(body.review.summary).toEqual({
      totalWords: 3,
      coveredWords: 1,
      fullWordOnlyWords: 1,
      missingWords: 1,
      generatedWords: 1,
      reviewedWords: 1,
      failedWords: 1,
    });
    expect(body.review.items).toEqual([
      {
        normalizedWord: "lantern",
        displayWord: "lantern",
        occurrences: 1,
        pageIds: ["102"],
        pageNumbers: [2],
        coverageStatus: "missing",
        reviewStatus: "failed",
        humanReviewed: false,
        audio: {},
        source: "tts",
        generatedAt: "2026-04-23T12:00:00.000Z",
        status: "failed",
      },
      {
        normalizedWord: "hello",
        displayWord: "Hello",
        occurrences: 2,
        pageIds: ["101"],
        pageNumbers: [1],
        coverageStatus: "covered",
        reviewStatus: "generated",
        humanReviewed: false,
        audio: {
          fullWord: "/hello-full.mp3",
          breakdown: "/hello-break.mp3",
        },
        source: "tts",
        generatedAt: "2026-04-23T10:00:00.000Z",
        status: "generated",
      },
      {
        normalizedWord: "world",
        displayWord: "world",
        occurrences: 2,
        pageIds: ["101", "102"],
        pageNumbers: [1, 2],
        coverageStatus: "full-word-only",
        reviewStatus: "reviewed",
        humanReviewed: true,
        audio: {
          fullWord: "/world-full.mp3",
        },
        source: "override",
        confidence: 0.92,
        generatedAt: "2026-04-23T11:00:00.000Z",
        status: "reviewed",
      },
    ]);
  });

  it("supports search/filter/pagination without changing the generation endpoint contract", async () => {
    mockPrisma.pages.findMany.mockResolvedValue([
      {
        id: 101n,
        page_number: 1,
        text_content: "Hello world",
        word_pronunciations: {
          hello: {
            fullWord: "/hello-full.mp3",
            breakdown: "/hello-break.mp3",
            source: "tts",
            status: "generated",
          },
        },
      },
      {
        id: 102n,
        page_number: 2,
        text_content: "World lantern",
        word_pronunciations: {
          world: {
            fullWord: "/world-full.mp3",
            source: "override",
            status: "reviewed",
          },
          lantern: {
            source: "tts",
            status: "failed",
          },
        },
      },
    ]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/books/42/pronunciations?search=wo&reviewStatus=reviewed&pageNumber=2&limit=1&offset=0"
      ),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filters).toEqual({
      search: "wo",
      pageNumber: 2,
      coverageStatus: null,
      reviewStatus: "reviewed",
      limit: 1,
      offset: 0,
    });
    expect(body.review.filteredTotal).toBe(1);
    expect(body.review.items).toHaveLength(1);
    expect(body.review.items[0]?.normalizedWord).toBe("world");
  });

  it("returns 400 for invalid review filters", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/books/42/pronunciations?coverageStatus=partial&reviewStatus=done"
      ),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "coverageStatus must be one of: missing, full-word-only, covered.",
      code: "invalid_review_filters",
      details: [
        "coverageStatus must be one of: missing, full-word-only, covered.",
        "reviewStatus must be one of: missing, generated, failed, reviewed.",
      ],
    });
  });

  it("returns 400 for an invalid book id", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/books/not-a-number/pronunciations"),
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
});

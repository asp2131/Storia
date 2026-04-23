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

import { GET } from "@/app/api/books/[id]/pronunciations/route";

describe("/api/books/[id]/pronunciations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the expanded published manifest shape while preserving legacy entries", async () => {
    mockPrisma.pages.findMany.mockResolvedValue([
      {
        word_pronunciations: {
          " Adventure! ": {
            fullWord: "/adventure-full-v1.mp3",
          },
          cat: "/cat.mp3",
          "!!!": {
            fullWord: "/ignored.mp3",
          },
        },
      },
      {
        word_pronunciations: {
          adventure: {
            fullWord: "/adventure-full-v2.mp3",
            breakdown: "/adventure-break.mp3",
            source: "tts",
            confidence: 0.91,
            status: "generated",
            generatedAt: "2026-04-23T00:00:00Z",
          },
        },
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/books/42/pronunciations"),
      {
        params: Promise.resolve({ id: "42" }),
      }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.pages.findMany).toHaveBeenCalledWith({
      where: { book_id: 42n },
      select: { word_pronunciations: true },
    });
    expect(body).toEqual({
      bookId: "42",
      version: 1,
      locale: "en-US",
      defaultPlaybackMode: "breakdown_then_word",
      entries: {
        adventure: {
          id: "42:adventure",
          normalizedWord: "adventure",
          displayWord: "adventure",
          source: "tts",
          confidence: 0.91,
          humanReviewed: false,
          status: "generated",
          updatedAt: "2026-04-23T00:00:00Z",
          audio: {
            fullWord: { url: "/adventure-full-v2.mp3" },
            breakdown: { url: "/adventure-break.mp3" },
          },
        },
        cat: {
          id: "42:cat",
          normalizedWord: "cat",
          displayWord: "cat",
          humanReviewed: false,
          updatedAt: new Date(0).toISOString(),
          audio: {
            fullWord: { url: "/cat.mp3" },
          },
        },
      },
    });
  });

  it("marks reviewed and override-backed entries as human reviewed", async () => {
    mockPrisma.pages.findMany.mockResolvedValue([
      {
        word_pronunciations: {
          reviewed: {
            fullWord: "/reviewed.mp3",
            status: "reviewed",
            generatedAt: "2026-04-23T01:00:00Z",
          },
          override: {
            fullWord: "/override.mp3",
            source: "override",
            generatedAt: "2026-04-23T02:00:00Z",
          },
        },
      },
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
    expect(body.entries.override.humanReviewed).toBe(true);
    expect(body.entries.override.source).toBe("override");
  });

  it("returns 500 when manifest lookup fails", async () => {
    mockPrisma.pages.findMany.mockRejectedValue(new Error("db offline"));

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

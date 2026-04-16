import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateChildAccess, mockPrisma } = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockPrisma: {
    child_book_progress: {
      findFirst: vi.fn(),
    },
    books: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/continue-reading/route";

describe("/api/continue-reading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
  });

  it("returns a mobile-friendly continueReading payload with full progress fields", async () => {
    mockPrisma.child_book_progress.findFirst.mockResolvedValue({
      childProfileId: "child-1",
      bookId: 101n,
      currentPage: 7,
      totalPages: 24,
      lastReadAt: new Date("2026-04-06T11:15:00.000Z"),
      completedAt: null,
      completionCount: 0,
      lastSessionId: "rs_abc123",
    });
    mockPrisma.books.findUnique.mockResolvedValue({
      id: 101n,
      title: "The Little Prince",
      author: "Antoine de Saint-Exupéry",
      cover_url: "https://example.com/cover.jpg",
      total_pages: 24,
      pages: [{ id: 1n }],
    });

    const response = await GET(new NextRequest("http://localhost/api/continue-reading?childProfileId=child-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      continueReading: {
        book: {
          id: "101",
          title: "The Little Prince",
          author: "Antoine de Saint-Exupéry",
          coverUrl: "https://example.com/cover.jpg",
          totalPages: 24,
          hasNarration: true,
        },
        progress: {
          childProfileId: "child-1",
          bookId: "101",
          currentPage: 7,
          totalPages: 24,
          progressPercent: 29,
          lastReadAt: "2026-04-06T11:15:00.000Z",
          completedAt: null,
          completionCount: 0,
          lastSessionId: "rs_abc123",
          status: "in_progress",
        },
      },
    });
  });
});

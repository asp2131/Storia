import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockValidateChildAccess,
  mockGetAuthenticatedUser,
  mockPrisma,
} = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockGetAuthenticatedUser: vi.fn(),
  mockPrisma: {
    child_book_progress: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user_reading_progress: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/reading-progress/route";

describe("/api/reading-progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "user-1" } });
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
  });

  it("returns progressList for child-only GET requests", async () => {
    mockPrisma.child_book_progress.findMany.mockResolvedValue([
      {
        childProfileId: "child-1",
        bookId: 101n,
        currentPage: 7,
        totalPages: 24,
        lastReadAt: new Date("2026-04-06T11:15:00.000Z"),
        completedAt: null,
        completionCount: 0,
        lastSessionId: "rs_123",
      },
    ]);

    const request = new NextRequest("http://localhost/api/reading-progress?childProfileId=child-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");
    expect(body).toEqual({
      progressList: [
        {
          childProfileId: "child-1",
          bookId: "101",
          currentPage: 7,
          totalPages: 24,
          progressPercent: 29,
          lastReadAt: "2026-04-06T11:15:00.000Z",
          completedAt: null,
          completionCount: 0,
          lastSessionId: "rs_123",
          status: "in_progress",
        },
      ],
    });
  });

  it("rejects child progress saves when currentPage exceeds totalPages", async () => {
    const request = new NextRequest("http://localhost/api/reading-progress", {
      method: "POST",
      body: JSON.stringify({
        childProfileId: "child-1",
        bookId: "101",
        currentPage: 12,
        totalPages: 10,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "currentPage must be <= totalPages",
        details: { field: "currentPage" },
      },
    });
    expect(mockPrisma.child_book_progress.upsert).not.toHaveBeenCalled();
  });

  it("clears completedAt when a completed child book is reopened", async () => {
    mockPrisma.child_book_progress.findUnique.mockResolvedValue({
      childProfileId: "child-1",
      bookId: 101n,
      currentPage: 24,
      totalPages: 24,
      lastReadAt: new Date("2026-04-06T11:15:00.000Z"),
      completedAt: new Date("2026-04-06T11:15:00.000Z"),
      completionCount: 2,
      lastSessionId: "rs_old",
    });
    mockPrisma.child_book_progress.upsert.mockImplementation(async ({ update, create }) => ({
      childProfileId: create.childProfileId,
      bookId: create.bookId,
      currentPage: update.currentPage,
      totalPages: update.totalPages,
      lastReadAt: update.lastReadAt,
      completedAt: update.completedAt ?? null,
      completionCount: update.completionCount,
      lastSessionId: update.lastSessionId,
    }));

    const request = new NextRequest("http://localhost/api/reading-progress", {
      method: "POST",
      body: JSON.stringify({
        childProfileId: "child-1",
        bookId: "101",
        currentPage: 3,
        totalPages: 24,
        completed: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.progress.completedAt).toBeNull();
    expect(body.progress.status).toBe("in_progress");
    expect(body.progress.completionCount).toBe(2);
  });

  it("uses dual-stack auth for parent GET progress so mobile bearer users resolve", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "mobile-user-1" } });
    mockPrisma.user_reading_progress.findUnique.mockResolvedValue({
      userId: "mobile-user-1",
      bookId: 101n,
      currentPage: 8,
      totalPages: 20,
      lastReadAt: new Date("2026-04-28T13:00:00.000Z"),
    });

    const request = new NextRequest("http://localhost/api/reading-progress?bookId=101", {
      headers: { authorization: "Bearer mobile-token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user_reading_progress.findUnique).toHaveBeenCalledWith({
      where: {
        userId_bookId: {
          userId: "mobile-user-1",
          bookId: 101n,
        },
      },
    });
    expect(body).toEqual({
      currentPage: 8,
      totalPages: 20,
      lastReadAt: "2026-04-28T13:00:00.000Z",
      progressPercent: 40,
    });
  });

  it("uses dual-stack auth for parent POST progress so Better Auth cookie users resolve", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "web-user-1" } });
    mockPrisma.user_reading_progress.upsert.mockResolvedValue({
      userId: "web-user-1",
      bookId: 101n,
      currentPage: 5,
      totalPages: 10,
      lastReadAt: new Date("2026-04-28T13:05:00.000Z"),
    });

    const request = new NextRequest("http://localhost/api/reading-progress", {
      method: "POST",
      headers: { cookie: "better-auth.session_token=cookie-value" },
      body: JSON.stringify({
        bookId: "101",
        currentPage: 5,
        totalPages: 10,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user_reading_progress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_bookId: {
            userId: "web-user-1",
            bookId: 101n,
          },
        },
        create: expect.objectContaining({
          userId: "web-user-1",
          bookId: 101n,
          currentPage: 5,
          totalPages: 10,
        }),
      })
    );
    expect(body).toEqual({
      success: true,
      progress: {
        currentPage: 5,
        totalPages: 10,
        lastReadAt: "2026-04-28T13:05:00.000Z",
        progressPercent: 50,
      },
    });
  });
});

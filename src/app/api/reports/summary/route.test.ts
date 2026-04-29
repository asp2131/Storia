import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateChildAccess, mockPrisma } = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockPrisma: {
    reading_session: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    child_book_progress: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    books: {
      findMany: vi.fn(),
    },
    question_attempt: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/reports/summary/route";

function setupHappyPath() {
  mockValidateChildAccess.mockResolvedValue({
    user: { id: "user-1" },
    childProfile: { id: "child-1" },
  });

  // 3 aggregates: total, practice, narration
  mockPrisma.reading_session.aggregate
    .mockResolvedValueOnce({ _count: 4, _sum: { durationSeconds: 1800 } })
    .mockResolvedValueOnce({ _count: 2, _sum: { durationSeconds: 480 } })
    .mockResolvedValueOnce({ _count: 3, _sum: { durationSeconds: 1200 } });

  // 2 groupBys: source, then bookId (per-book)
  mockPrisma.reading_session.groupBy
    .mockResolvedValueOnce([
      { source: "mobile", _count: 3, _sum: { durationSeconds: 1500 } },
      { source: "web", _count: 1, _sum: { durationSeconds: 300 } },
    ])
    .mockResolvedValueOnce([
      {
        bookId: 101n,
        _count: 3,
        _sum: { durationSeconds: 1200 },
        _max: { startedAt: new Date("2026-04-25T12:00:00Z") },
      },
      {
        bookId: 202n,
        _count: 1,
        _sum: { durationSeconds: 600 },
        _max: { startedAt: new Date("2026-04-20T08:00:00Z") },
      },
    ]);

  mockPrisma.child_book_progress.findMany.mockResolvedValue([
    {
      bookId: 101n,
      currentPage: 8,
      totalPages: 12,
      completedAt: null,
      completionCount: 0,
      lastReadAt: new Date("2026-04-26T09:00:00Z"),
    },
  ]);

  mockPrisma.books.findMany.mockResolvedValue([
    { id: 101n, title: "Where the Wild Things Are" },
    { id: 202n, title: "Goodnight Moon" },
  ]);

  mockPrisma.child_book_progress.count.mockResolvedValue(1);
  mockPrisma.question_attempt.count
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(4);

  // 2 $queryRaw calls: sessionsByDay, attemptsByDay
  mockPrisma.$queryRaw
    .mockResolvedValueOnce([
      { bucket: new Date("2026-04-25T00:00:00Z"), sessions: 2n, duration_seconds: 900n },
    ])
    .mockResolvedValueOnce([
      { bucket: new Date("2026-04-25T00:00:00Z"), attempts: 3n },
    ]);
}

describe("/api/reports/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns extended summary including narration, source, perBook, dailySeries", async () => {
    setupHappyPath();

    const response = await GET(
      new NextRequest("http://localhost/api/reports/summary?childProfileId=child-1&range=30d")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");

    expect(body.summary.totalSessions).toBe(4);
    expect(body.summary.totalReadingMinutes).toBe(30);
    expect(body.summary.practiceSessions).toBe(2);
    expect(body.summary.practiceSessionRatePercent).toBe(50);
    expect(body.summary.narrationSessions).toBe(3);
    expect(body.summary.narrationMinutes).toBe(20);
    expect(body.summary.narrationSessionRatePercent).toBe(75);

    expect(body.summary.sourceBreakdown).toEqual([
      { source: "mobile", sessions: 3, minutes: 25 },
      { source: "web", sessions: 1, minutes: 5 },
    ]);

    expect(body.summary.perBook).toHaveLength(2);
    // Sorted by lastReadAt desc — book 101 (lastReadAt from progress 2026-04-26) first
    expect(body.summary.perBook[0]).toMatchObject({
      bookId: "101",
      title: "Where the Wild Things Are",
      sessions: 3,
      minutes: 20,
      currentPage: 8,
      totalPages: 12,
      completed: false,
      completionCount: 0,
    });
    expect(body.summary.perBook[1]).toMatchObject({
      bookId: "202",
      title: "Goodnight Moon",
      sessions: 1,
      minutes: 10,
      currentPage: null,
      totalPages: null,
      completed: false,
      completionCount: 0,
    });

    expect(Array.isArray(body.summary.dailySeries)).toBe(true);
    expect(body.summary.dailySeries.length).toBeGreaterThan(0);
    const everyRowShape = body.summary.dailySeries.every(
      (row: { date: string; sessions: number; minutes: number; comprehensionAttempts: number }) =>
        typeof row.date === "string" &&
        typeof row.sessions === "number" &&
        typeof row.minutes === "number" &&
        typeof row.comprehensionAttempts === "number"
    );
    expect(everyRowShape).toBe(true);
    const populated = body.summary.dailySeries.find(
      (row: { date: string }) => row.date === "2026-04-25"
    );
    expect(populated).toMatchObject({ sessions: 2, minutes: 15, comprehensionAttempts: 3 });

    expect(body.summary.booksStarted).toBe(2);
    expect(body.summary.booksCompleted).toBe(1);
    expect(body.summary.averageComprehensionScore).toBe(80);
  });

  it("returns CSV when format=csv with new fields", async () => {
    setupHappyPath();

    const response = await GET(
      new NextRequest(
        "http://localhost/api/reports/summary?childProfileId=child-1&range=7d&format=csv"
      )
    );

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("narrationSessions,narrationMinutes,narrationSessionRatePercent");
    expect(body.split("\n")[1]).toContain(",3,20,75");
  });

  it("rejects requests without a childProfileId", async () => {
    const response = await GET(new NextRequest("http://localhost/api/reports/summary?range=30d"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "childProfileId is required",
      },
    });
    expect(mockValidateChildAccess).not.toHaveBeenCalled();
  });

  it("propagates child access errors", async () => {
    mockValidateChildAccess.mockResolvedValue({
      error: new Response(JSON.stringify({ error: { code: "forbidden", message: "Forbidden" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/reports/summary?childProfileId=child-1&range=30d")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "forbidden",
        message: "Forbidden",
      },
    });
    expect(mockPrisma.reading_session.aggregate).not.toHaveBeenCalled();
  });

  it("rejects invalid range values", async () => {
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
    const response = await GET(
      new NextRequest("http://localhost/api/reports/summary?childProfileId=child-1&range=365d")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "range must be one of: 7d, 30d, 90d",
      },
    });
  });

  it("returns empty perBook when no sessions exist", async () => {
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
    mockPrisma.reading_session.aggregate
      .mockResolvedValueOnce({ _count: 0, _sum: { durationSeconds: 0 } })
      .mockResolvedValueOnce({ _count: 0, _sum: { durationSeconds: 0 } })
      .mockResolvedValueOnce({ _count: 0, _sum: { durationSeconds: 0 } });
    mockPrisma.reading_session.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.child_book_progress.count.mockResolvedValue(0);
    mockPrisma.question_attempt.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const response = await GET(
      new NextRequest("http://localhost/api/reports/summary?childProfileId=child-1&range=7d")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.perBook).toEqual([]);
    expect(body.summary.sourceBreakdown).toEqual([]);
    expect(body.summary.dailySeries.length).toBeGreaterThan(0);
    expect(mockPrisma.child_book_progress.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.books.findMany).not.toHaveBeenCalled();
  });
});

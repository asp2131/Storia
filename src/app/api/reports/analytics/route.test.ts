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

import { GET } from "@/app/api/reports/analytics/route";

describe("/api/reports/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
    mockPrisma.reading_session.aggregate
      .mockResolvedValueOnce({ _count: 4, _sum: { durationSeconds: 1800 } })
      .mockResolvedValueOnce({ _count: 2, _sum: { durationSeconds: 480 } });
    mockPrisma.reading_session.groupBy.mockResolvedValue([{ bookId: 101n }, { bookId: 202n }]);
    mockPrisma.child_book_progress.count.mockResolvedValue(1);
    mockPrisma.question_attempt.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          event_name: "reader_opened",
          count: 2n,
          last_occurred_at: new Date("2026-04-16T10:00:00.000Z"),
        },
        {
          event_name: "comprehension_answered",
          count: 1n,
          last_occurred_at: new Date("2026-04-16T10:05:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "evt_2",
          child_profile_id: "child-1",
          book_id: "101",
          session_id: "rs_1",
          event_name: "comprehension_answered",
          source: "mobile",
          properties: { isCorrect: true },
          occurred_at: new Date("2026-04-16T10:05:00.000Z"),
        },
        {
          id: "evt_1",
          child_profile_id: "child-1",
          book_id: "101",
          session_id: "rs_1",
          event_name: "reader_opened",
          source: "mobile",
          properties: { entryIntent: "standard" },
          occurred_at: new Date("2026-04-16T10:00:00.000Z"),
        },
      ]);
  });

  it("returns parent summary plus analytics event data", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reports/analytics?childProfileId=child-1&range=30d&limit=10")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(body.report.summary).toEqual({
      childProfileId: "child-1",
      range: "30d",
      booksStarted: 2,
      booksCompleted: 1,
      totalSessions: 4,
      totalReadingMinutes: 30,
      averageSessionMinutes: 8,
      comprehensionAttempts: 5,
      averageComprehensionScore: 80,
      practiceSessions: 2,
      practiceMinutes: 8,
      practiceSessionRatePercent: 50,
    });
    expect(body.report.analytics).toEqual({
      totalEvents: 3,
      uniqueEventNames: 2,
      eventsByName: [
        {
          eventName: "reader_opened",
          count: 2,
          lastOccurredAt: "2026-04-16T10:00:00.000Z",
        },
        {
          eventName: "comprehension_answered",
          count: 1,
          lastOccurredAt: "2026-04-16T10:05:00.000Z",
        },
      ],
      recentEvents: [
        {
          id: "evt_2",
          childProfileId: "child-1",
          bookId: "101",
          sessionId: "rs_1",
          eventName: "comprehension_answered",
          source: "mobile",
          properties: { isCorrect: true },
          occurredAt: "2026-04-16T10:05:00.000Z",
        },
        {
          id: "evt_1",
          childProfileId: "child-1",
          bookId: "101",
          sessionId: "rs_1",
          eventName: "reader_opened",
          source: "mobile",
          properties: { entryIntent: "standard" },
          occurredAt: "2026-04-16T10:00:00.000Z",
        },
      ],
    });
    expect(typeof body.report.generatedAt).toBe("string");
  });

  it("returns csv when format=csv", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/reports/analytics?childProfileId=child-1&range=7d&format=csv"
      )
    );

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      'analytics-report-child-1-7d.csv'
    );
    expect(body).toContain("section,metric,value");
    expect(body).toContain("analytics,totalEvents,3");
    expect(body).toContain("eventName,count,lastOccurredAt");
    expect(body).toContain("reader_opened,2,2026-04-16T10:00:00.000Z");
  });

  it("rejects missing childProfileId", async () => {
    const response = await GET(new NextRequest("http://localhost/api/reports/analytics?range=30d"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "childProfileId is required",
        details: { field: "childProfileId" },
      },
    });
  });

  it("rejects invalid range values", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reports/analytics?childProfileId=child-1&range=365d")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "range must be one of: 7d, 30d, 90d",
        details: { field: "range" },
      },
    });
  });

  it("rejects invalid limit values", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reports/analytics?childProfileId=child-1&limit=250")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "limit must be an integer between 1 and 100",
        details: { field: "limit" },
      },
    });
  });

  it("returns an empty analytics section when the events table is missing", async () => {
    mockPrisma.$queryRaw.mockReset();
    mockPrisma.$queryRaw
      .mockRejectedValueOnce(new Error('relation "mobile_analytics_events" does not exist'))
      .mockRejectedValueOnce(new Error('relation "mobile_analytics_events" does not exist'));

    const response = await GET(
      new NextRequest("http://localhost/api/reports/analytics?childProfileId=child-1&range=30d")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.report.analytics).toEqual({
      totalEvents: 0,
      uniqueEventNames: 0,
      eventsByName: [],
      recentEvents: [],
    });
  });

  it("propagates child access errors", async () => {
    mockValidateChildAccess.mockResolvedValue({
      error: new Response(JSON.stringify({ error: { code: "forbidden", message: "Forbidden" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/reports/analytics?childProfileId=child-1&range=30d")
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
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});

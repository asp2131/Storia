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
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/reports/summary/route";

describe("/api/reports/summary", () => {
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
    mockPrisma.question_attempt.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4);
  });

  it("returns summary json including practice metrics", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/reports/summary?childProfileId=child-1&range=30d")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");
    expect(body).toEqual({
      summary: {
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
      },
    });
  });

  it("returns CSV when format=csv", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/reports/summary?childProfileId=child-1&range=7d&format=csv"
      )
    );

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      'reading-summary-child-1-7d.csv'
    );
    expect(body).toContain(
      "childProfileId,range,booksStarted,booksCompleted,totalSessions,totalReadingMinutes,averageSessionMinutes,comprehensionAttempts,averageComprehensionScore,practiceSessions,practiceMinutes,practiceSessionRatePercent"
    );
    expect(body).toContain("child-1,7d,2,1,4,30,8,5,80,2,8,50");
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
});

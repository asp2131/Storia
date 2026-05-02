import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRequireAdmin, mockAgg } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAgg: {
    parseRange: vi.fn(),
    headline: vi.fn(),
    trend: vi.fn(),
    topBooks: vi.fn(),
    feedback: vi.fn(),
  },
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock("@/lib/reports/agg", () => ({
  reportAgg: mockAgg,
}));

import { GET as getHeadline } from "@/app/api/admin/reports/headline/route";
import { GET as getTrend } from "@/app/api/admin/reports/trend/route";
import { GET as getTopBooks } from "@/app/api/admin/reports/top-books/route";
import { GET as getFeedback } from "@/app/api/admin/reports/feedback/route";

function makeReq(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"));
}

beforeEach(() => {
  mockRequireAdmin.mockReset();
  mockAgg.parseRange.mockReset();
  mockAgg.headline.mockReset();
  mockAgg.trend.mockReset();
  mockAgg.topBooks.mockReset();
  mockAgg.feedback.mockReset();

  mockAgg.parseRange.mockImplementation((input: string | null | undefined) => ({
    range: (input === "7d" || input === "30d" || input === "90d" ? input : "30d") as "7d" | "30d" | "90d",
    since: new Date("2026-04-01T00:00:00Z"),
    until: new Date("2026-05-01T00:00:00Z"),
  }));
});

const handlers = [
  { name: "headline", fn: getHeadline, path: "/api/admin/reports/headline" },
  { name: "trend", fn: getTrend, path: "/api/admin/reports/trend" },
  { name: "top-books", fn: getTopBooks, path: "/api/admin/reports/top-books" },
  { name: "feedback", fn: getFeedback, path: "/api/admin/reports/feedback" },
] as const;

describe("admin reports routes — auth gate", () => {
  it.each(handlers)("%s returns whatever requireAdmin returns when not an admin", async ({ fn, path }) => {
    mockRequireAdmin.mockResolvedValueOnce(
      NextResponse.json({ error: "Admin access required." }, { status: 403 })
    );
    const res = await fn(makeReq(path));
    expect(res.status).toBe(403);
  });
});

describe("admin reports routes — happy paths", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({
      user: { id: "u1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
  });

  it("headline returns the agg payload as JSON under data", async () => {
    const payload = {
      range: "30d",
      generatedAt: "2026-05-01T00:00:00Z",
      kidsActive: 9,
      parentsActive: 6,
      totalSessions: 42,
      totalReadingMinutes: 514,
      averageSessionMinutes: 12,
      booksCompleted: 4,
      comprehensionAttempts: 30,
      averageComprehensionPercent: 82,
      narrationAdoptionPercent: 55,
      practiceAdoptionPercent: 38,
      intentRatio: { standard: 30, practice: 12 },
    };
    mockAgg.headline.mockResolvedValueOnce(payload);
    const res = await getHeadline(makeReq("/api/admin/reports/headline?range=30d"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(payload);
    expect(mockAgg.headline).toHaveBeenCalledWith("30d");
  });

  it("trend returns series under data", async () => {
    const payload = {
      range: "7d",
      series: [
        { date: "2026-04-25", sessions: 3, minutes: 30, comprehensionAttempts: 2 },
        { date: "2026-04-26", sessions: 5, minutes: 60, comprehensionAttempts: 4 },
      ],
    };
    mockAgg.trend.mockResolvedValueOnce(payload);
    const res = await getTrend(makeReq("/api/admin/reports/trend?range=7d"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.series).toHaveLength(2);
    expect(mockAgg.trend).toHaveBeenCalledWith("7d");
  });

  it("top-books defaults limit to 10 and clamps high values to 50", async () => {
    mockAgg.topBooks.mockResolvedValueOnce({ range: "30d", books: [] });
    await getTopBooks(makeReq("/api/admin/reports/top-books"));
    expect(mockAgg.topBooks).toHaveBeenCalledWith("30d", 10);

    mockAgg.topBooks.mockResolvedValueOnce({ range: "30d", books: [] });
    await getTopBooks(makeReq("/api/admin/reports/top-books?limit=999"));
    expect(mockAgg.topBooks).toHaveBeenLastCalledWith("30d", 50);
  });

  it("feedback returns items + summary", async () => {
    const payload = {
      range: "30d",
      items: [
        {
          id: "f1",
          rating: 5,
          feedback: "Great",
          createdAt: "2026-04-30T00:00:00Z",
          parentName: "Akin",
          parentEmail: "a@b.com",
        },
      ],
      summary: { count: 1, averageRating: 5 },
    };
    mockAgg.feedback.mockResolvedValueOnce(payload);
    const res = await getFeedback(makeReq("/api/admin/reports/feedback"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(payload);
    expect(mockAgg.feedback).toHaveBeenCalledWith("30d", 20);
  });
});

describe("admin reports routes — CSV format", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({
      user: { id: "u1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
  });

  it("trend ?format=csv returns text/csv with header + rows", async () => {
    mockAgg.trend.mockResolvedValueOnce({
      range: "7d",
      series: [
        { date: "2026-04-25", sessions: 3, minutes: 30, comprehensionAttempts: 2 },
      ],
    });
    const res = await getTrend(makeReq("/api/admin/reports/trend?range=7d&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\n")[0]).toBe("date,sessions,minutes,comprehensionAttempts");
    expect(body).toContain("2026-04-25,3,30,2");
  });

  it("feedback ?format=csv quotes commas in feedback text", async () => {
    mockAgg.feedback.mockResolvedValueOnce({
      range: "30d",
      items: [
        {
          id: "f1",
          rating: 5,
          feedback: "Great, really great",
          createdAt: "2026-04-30T00:00:00Z",
          parentName: "Akin",
          parentEmail: "a@b.com",
        },
      ],
      summary: { count: 1, averageRating: 5 },
    });
    const res = await getFeedback(makeReq("/api/admin/reports/feedback?format=csv"));
    const body = await res.text();
    expect(body).toContain(`"Great, really great"`);
  });
});

describe("admin reports routes — error handling", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({
      user: { id: "u1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
  });

  it("headline returns 500 when agg throws", async () => {
    mockAgg.headline.mockRejectedValueOnce(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getHeadline(makeReq("/api/admin/reports/headline"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    errSpy.mockRestore();
  });
});

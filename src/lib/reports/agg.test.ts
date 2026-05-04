import { describe, expect, it, vi, beforeEach } from "vitest";
import { createReportAgg, isReportRange, VALID_RANGES } from "./agg";

type Mock = ReturnType<typeof vi.fn>;

type MockPrisma = {
  books: { findMany: Mock };
  reader_feedback: {
    findMany: Mock;
    aggregate: Mock;
  };
  $queryRaw: Mock;
};

function makePrisma(): MockPrisma {
  return {
    books: { findMany: vi.fn() },
    reader_feedback: { findMany: vi.fn(), aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  };
}

describe("isReportRange / parseRange", () => {
  it("recognises every valid range", () => {
    for (const r of VALID_RANGES) {
      expect(isReportRange(r)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isReportRange("180d")).toBe(false);
    expect(isReportRange(null)).toBe(false);
    expect(isReportRange(undefined)).toBe(false);
    expect(isReportRange(7)).toBe(false);
  });

  it("parseRange defaults to 30d for invalid input", () => {
    const agg = createReportAgg({ prisma: makePrisma() as never });
    expect(agg.parseRange(null).range).toBe("30d");
    expect(agg.parseRange("bogus").range).toBe("30d");
    expect(agg.parseRange("7d").range).toBe("7d");
  });

  it("parseRange computes since = N days before until", () => {
    const agg = createReportAgg({ prisma: makePrisma() as never });
    const { since, until } = agg.parseRange("7d");
    const diff = until.getTime() - since.getTime();
    expect(Math.round(diff / 86400000)).toBe(7);
  });
});

describe("headline", () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it("derives platform-wide totals from mobile_analytics_events aggregate", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        kids_active: 4n,
        parents_active: 4n,
        total_sessions: 53n,
        total_duration_ms: 2_092_069n,
        books_completed: 7n,
        comprehension_attempts: 12n,
        comprehension_correct: 9n,
        narration_sessions: 19n,
        practice_sessions: 4n,
      },
    ]);

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.headline("30d");

    expect(out.range).toBe("30d");
    expect(out.kidsActive).toBe(4);
    expect(out.parentsActive).toBe(4);
    expect(out.totalSessions).toBe(53);
    expect(out.totalReadingMinutes).toBe(35); // round(2092069 / 60000)
    expect(out.averageSessionMinutes).toBe(1); // round(35 / 53)
    expect(out.booksCompleted).toBe(7);
    expect(out.comprehensionAttempts).toBe(12);
    expect(out.averageComprehensionPercent).toBe(75); // 9/12
    expect(out.narrationAdoptionPercent).toBe(36); // 19/53
    expect(out.practiceAdoptionPercent).toBe(8); // 4/53
    expect(out.intentRatio).toEqual({});
  });

  it("handles zero sessions without dividing by zero", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        kids_active: 0n,
        parents_active: 0n,
        total_sessions: 0n,
        total_duration_ms: 0n,
        books_completed: 0n,
        comprehension_attempts: 0n,
        comprehension_correct: 0n,
        narration_sessions: 0n,
        practice_sessions: 0n,
      },
    ]);

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.headline("7d");

    expect(out.averageSessionMinutes).toBe(0);
    expect(out.averageComprehensionPercent).toBe(0);
    expect(out.narrationAdoptionPercent).toBe(0);
    expect(out.practiceAdoptionPercent).toBe(0);
    expect(out.intentRatio).toEqual({});
  });

  it("defaults to zeros when query returns no rows", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.headline("7d");
    expect(out.kidsActive).toBe(0);
    expect(out.totalSessions).toBe(0);
    expect(out.totalReadingMinutes).toBe(0);
  });
});

describe("trend", () => {
  it("fills daily skeleton with zeros and merges raw rows", async () => {
    const prisma = makePrisma();
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);

    prisma.$queryRaw
      .mockResolvedValueOnce([
        { bucket: today, sessions: 4n, duration_seconds: 1200n },
      ])
      .mockResolvedValueOnce([{ bucket: yesterday, attempts: 6n }]);

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.trend("7d");

    expect(out.range).toBe("7d");
    expect(out.series.length).toBe(8);
    const todayKey = today.toISOString().slice(0, 10);
    const todayPoint = out.series.find((p) => p.date === todayKey);
    expect(todayPoint).toBeDefined();
    expect(todayPoint!.sessions).toBe(4);
    expect(todayPoint!.minutes).toBe(20);
    const yKey = yesterday.toISOString().slice(0, 10);
    const yPoint = out.series.find((p) => p.date === yKey);
    expect(yPoint!.comprehensionAttempts).toBe(6);
  });
});

describe("topBooks", () => {
  it("merges sessions, completions, comprehension into ranked rows", async () => {
    const prisma = makePrisma();
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          book_id: 101n,
          sessions: 8n,
          duration_seconds: 4800n,
          unique_readers: 4n,
          narration_sessions: 4n,
          practice_sessions: 2n,
        },
        {
          book_id: 202n,
          sessions: 3n,
          duration_seconds: 900n,
          unique_readers: 3n,
          narration_sessions: 0n,
          practice_sessions: 3n,
        },
      ])
      .mockResolvedValueOnce([{ book_id: 101n, completions: 2n }])
      .mockResolvedValueOnce([
        { book_id: 101n, attempts: 10n, correct: 8n },
        { book_id: 202n, attempts: 4n, correct: 1n },
      ]);
    prisma.books.findMany.mockResolvedValueOnce([
      { id: 101n, title: "Bunny Brother" },
      { id: 202n, title: "Kumu's Sky" },
    ]);

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.topBooks("30d", 10);

    expect(out.books).toHaveLength(2);
    const bunny = out.books[0];
    expect(bunny.bookId).toBe("101");
    expect(bunny.title).toBe("Bunny Brother");
    expect(bunny.uniqueReaders).toBe(4);
    expect(bunny.totalSessions).toBe(8);
    expect(bunny.totalMinutes).toBe(80);
    expect(bunny.completions).toBe(2);
    expect(bunny.completionRatePercent).toBe(50);
    expect(bunny.averageComprehensionPercent).toBe(80);
    expect(bunny.narrationSessionPercent).toBe(50);
    expect(bunny.practiceSessionPercent).toBe(25);

    const kumu = out.books[1];
    expect(kumu.completions).toBe(0);
    expect(kumu.completionRatePercent).toBe(0);
    expect(kumu.averageComprehensionPercent).toBe(25);
    expect(kumu.narrationSessionPercent).toBe(0);
    expect(kumu.practiceSessionPercent).toBe(100);
  });

  it("returns empty list and skips lookups when no sessions in range", async () => {
    const prisma = makePrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]);
    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.topBooks("7d", 10);
    expect(out.books).toEqual([]);
    expect(prisma.books.findMany).not.toHaveBeenCalled();
  });
});

describe("feedback", () => {
  it("maps rows + computes average rounded to one decimal", async () => {
    const prisma = makePrisma();
    const now = new Date("2026-04-30T10:00:00Z");
    prisma.reader_feedback.findMany.mockResolvedValueOnce([
      {
        id: "f1",
        rating: 5,
        feedback: "Loved it!",
        createdAt: now,
        user: { name: "Akin", email: "akin@example.com" },
      },
      {
        id: "f2",
        rating: 4,
        feedback: null,
        createdAt: new Date(now.getTime() - 3600_000),
        user: { name: null, email: "anon@example.com" },
      },
    ]);
    prisma.reader_feedback.aggregate.mockResolvedValueOnce({
      _count: 2,
      _avg: { rating: 4.5 },
    });

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.feedback("30d", 20);

    expect(out.items).toHaveLength(2);
    expect(out.items[0]).toMatchObject({
      id: "f1",
      rating: 5,
      feedback: "Loved it!",
      parentName: "Akin",
      parentEmail: "akin@example.com",
    });
    expect(out.items[1].parentName).toBeNull();
    expect(out.summary).toEqual({ count: 2, averageRating: 4.5 });
  });

  it("returns null averageRating when no feedback in range", async () => {
    const prisma = makePrisma();
    prisma.reader_feedback.findMany.mockResolvedValueOnce([]);
    prisma.reader_feedback.aggregate.mockResolvedValueOnce({
      _count: 0,
      _avg: { rating: null },
    });

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.feedback("90d", 50);
    expect(out.items).toEqual([]);
    expect(out.summary).toEqual({ count: 0, averageRating: null });
  });
});

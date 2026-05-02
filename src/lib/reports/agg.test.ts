import { describe, expect, it, vi, beforeEach } from "vitest";
import { createReportAgg, isReportRange, VALID_RANGES } from "./agg";

type Mock = ReturnType<typeof vi.fn>;

type MockPrisma = {
  reading_session: {
    aggregate: Mock;
    groupBy: Mock;
  };
  child_book_progress: {
    count: Mock;
    groupBy: Mock;
  };
  question_attempt: {
    count: Mock;
    groupBy: Mock;
  };
  books: { findMany: Mock };
  reader_feedback: {
    findMany: Mock;
    aggregate: Mock;
  };
  $queryRaw: Mock;
};

function makePrisma(): MockPrisma {
  return {
    reading_session: { aggregate: vi.fn(), groupBy: vi.fn() },
    child_book_progress: { count: vi.fn(), groupBy: vi.fn() },
    question_attempt: { count: vi.fn(), groupBy: vi.fn() },
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
    // 3 reading_session.aggregate calls in fixed order:
    // total, practice, narration
    prisma.reading_session.aggregate
      .mockResolvedValueOnce({ _count: 10, _sum: { durationSeconds: 6000 } })
      .mockResolvedValueOnce({ _count: 4, _sum: { durationSeconds: 0 } })
      .mockResolvedValueOnce({ _count: 6, _sum: { durationSeconds: 0 } });
    prisma.child_book_progress.count.mockResolvedValueOnce(2);
    prisma.question_attempt.count
      .mockResolvedValueOnce(20) // total attempts
      .mockResolvedValueOnce(15); // correct
    prisma.reading_session.groupBy.mockResolvedValueOnce([
      { entryIntent: "standard", _count: 7 },
      { entryIntent: "practice", _count: 3 },
    ]);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ kids_active: 5n }])
      .mockResolvedValueOnce([{ parents_active: 3n }]);
  });

  it("computes platform-wide totals and adoption percentages", async () => {
    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.headline("30d");

    expect(out.range).toBe("30d");
    expect(out.kidsActive).toBe(5);
    expect(out.parentsActive).toBe(3);
    expect(out.totalSessions).toBe(10);
    expect(out.totalReadingMinutes).toBe(100); // 6000s = 100m
    expect(out.averageSessionMinutes).toBe(10);
    expect(out.booksCompleted).toBe(2);
    expect(out.comprehensionAttempts).toBe(20);
    expect(out.averageComprehensionPercent).toBe(75); // 15/20
    expect(out.narrationAdoptionPercent).toBe(60); // 6/10
    expect(out.practiceAdoptionPercent).toBe(40); // 4/10
    expect(out.intentRatio).toEqual({ standard: 7, practice: 3 });
  });

  it("handles zero sessions without dividing by zero", async () => {
    prisma = makePrisma();
    prisma.reading_session.aggregate
      .mockResolvedValueOnce({ _count: 0, _sum: { durationSeconds: 0 } })
      .mockResolvedValueOnce({ _count: 0, _sum: { durationSeconds: 0 } })
      .mockResolvedValueOnce({ _count: 0, _sum: { durationSeconds: 0 } });
    prisma.child_book_progress.count.mockResolvedValueOnce(0);
    prisma.question_attempt.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.reading_session.groupBy.mockResolvedValueOnce([]);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ kids_active: 0n }])
      .mockResolvedValueOnce([{ parents_active: 0n }]);

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.headline("7d");

    expect(out.averageSessionMinutes).toBe(0);
    expect(out.averageComprehensionPercent).toBe(0);
    expect(out.narrationAdoptionPercent).toBe(0);
    expect(out.practiceAdoptionPercent).toBe(0);
    expect(out.intentRatio).toEqual({});
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
      .mockResolvedValueOnce([
        { bucket: yesterday, attempts: 6n },
      ]);

    const agg = createReportAgg({ prisma: prisma as never });
    const out = await agg.trend("7d");

    expect(out.range).toBe("7d");
    expect(out.series.length).toBe(8); // 7d window inclusive of today
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
    prisma.$queryRaw.mockResolvedValueOnce([
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
    ]);
    prisma.books.findMany.mockResolvedValueOnce([
      { id: 101n, title: "Bunny Brother" },
      { id: 202n, title: "Kumu's Sky" },
    ]);
    prisma.child_book_progress.groupBy.mockResolvedValueOnce([
      { bookId: 101n, _count: 2 },
    ]);
    prisma.question_attempt.groupBy
      .mockResolvedValueOnce([
        { bookId: 101n, _count: 10 },
        { bookId: 202n, _count: 4 },
      ])
      .mockResolvedValueOnce([
        { bookId: 101n, _count: 8 },
        { bookId: 202n, _count: 1 },
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
    expect(bunny.completionRatePercent).toBe(50); // 2/4
    expect(bunny.averageComprehensionPercent).toBe(80); // 8/10
    expect(bunny.narrationSessionPercent).toBe(50); // 4/8
    expect(bunny.practiceSessionPercent).toBe(25); // 2/8

    const kumu = out.books[1];
    expect(kumu.completions).toBe(0);
    expect(kumu.completionRatePercent).toBe(0);
    expect(kumu.averageComprehensionPercent).toBe(25); // 1/4
    expect(kumu.narrationSessionPercent).toBe(0);
    expect(kumu.practiceSessionPercent).toBe(100); // 3/3
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

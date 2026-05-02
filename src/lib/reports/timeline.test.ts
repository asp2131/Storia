import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadTimeline } from "./timeline";

type Mock = ReturnType<typeof vi.fn>;

type MockPrisma = {
  mobile_analytics_events: { findMany: Mock };
  reading_session: { findMany: Mock };
  question_attempt: { findMany: Mock };
  reader_feedback: { findMany: Mock };
  child_profile: { findMany: Mock };
  books: { findMany: Mock };
};

function makePrisma(): MockPrisma {
  return {
    mobile_analytics_events: { findMany: vi.fn().mockResolvedValue([]) },
    reading_session: { findMany: vi.fn().mockResolvedValue([]) },
    question_attempt: { findMany: vi.fn().mockResolvedValue([]) },
    reader_feedback: { findMany: vi.fn().mockResolvedValue([]) },
    child_profile: { findMany: vi.fn().mockResolvedValue([]) },
    books: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function isoMinusMin(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

describe("loadTimeline", () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it("returns empty events + pagination when no source has rows", async () => {
    const out = await loadTimeline({ range: "7d" }, { prisma: prisma as never });
    expect(out.events).toEqual([]);
    expect(out.pagination.returned).toBe(0);
    expect(out.pagination.truncated).toBe(false);
  });

  it("merges sources and sorts by occurredAt descending", async () => {
    prisma.mobile_analytics_events.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        user_id: "u1",
        child_profile_id: "c1",
        book_id: 101n,
        session_id: null,
        event_name: "reader_opened",
        source: "mobile",
        properties: {},
        occurred_at: isoMinusMin(30),
      },
    ]);
    prisma.reading_session.findMany.mockResolvedValueOnce([
      {
        id: "rs1",
        sessionId: "s1",
        userId: "u1",
        childProfileId: "c1",
        bookId: 101n,
        startedAt: isoMinusMin(20),
        endedAt: isoMinusMin(10),
        durationSeconds: 600,
        startPage: 1,
        endPage: 5,
        entryIntent: "standard",
        usedNarration: false,
        usedPracticeMode: false,
        completedBook: false,
        source: "mobile",
      },
    ]);
    prisma.question_attempt.findMany.mockResolvedValueOnce([
      {
        id: "qa1",
        userId: "u1",
        childProfileId: "c1",
        bookId: 101n,
        questionId: "q1",
        selectedAnswer: "A",
        isCorrect: true,
        answeredAt: isoMinusMin(5),
      },
    ]);
    prisma.reader_feedback.findMany.mockResolvedValueOnce([
      {
        id: "fb1",
        userId: "u1",
        rating: 5,
        feedback: null,
        createdAt: isoMinusMin(60),
      },
    ]);
    prisma.child_profile.findMany.mockResolvedValueOnce([
      { id: "c1", userId: "u1", displayName: "Ava" },
    ]);
    prisma.books.findMany.mockResolvedValueOnce([
      { id: 101n, title: "Bunny Brother" },
    ]);

    const out = await loadTimeline({ range: "30d" }, { prisma: prisma as never });

    // 1 mobile + 1 session (no completion) + 1 attempt + 1 feedback = 4
    expect(out.events).toHaveLength(4);
    // Newest first: question_attempt (5m ago) > reading_session_completed (10m) > mobile (30m) > feedback (60m)
    const codes = out.events.map((e) => e.code);
    expect(codes).toEqual([
      "QUESTION_ANSWERED",
      "READING_SESSION_COMPLETED",
      "READER_OPENED",
      "FEEDBACK_SUBMITTED",
    ]);
    // No raw event_name leaked into UI fields.
    for (const evt of out.events) {
      expect(evt.summaryLine).not.toMatch(/event_name|properties/);
    }
  });

  it("truncates to limit and reports truncated flag", async () => {
    const sessionRows = Array.from({ length: 80 }).map((_, i) => ({
      id: `rs-${i}`,
      sessionId: `s-${i}`,
      userId: "u1",
      childProfileId: "c1",
      bookId: 101n,
      startedAt: isoMinusMin(60 + i),
      endedAt: isoMinusMin(50 + i),
      durationSeconds: 600,
      startPage: 1,
      endPage: 5,
      entryIntent: "standard",
      usedNarration: false,
      usedPracticeMode: false,
      completedBook: false,
      source: "mobile",
    }));
    prisma.reading_session.findMany.mockResolvedValueOnce(sessionRows);
    prisma.child_profile.findMany.mockResolvedValueOnce([
      { id: "c1", userId: "u1", displayName: "Ava" },
    ]);
    prisma.books.findMany.mockResolvedValueOnce([
      { id: 101n, title: "Bunny Brother" },
    ]);

    const out = await loadTimeline(
      { range: "30d", limit: 10 },
      { prisma: prisma as never }
    );

    expect(out.events).toHaveLength(10);
    expect(out.pagination.truncated).toBe(true);
    expect(out.pagination.limit).toBe(10);
  });

  it("passes childId filter to each source query", async () => {
    await loadTimeline(
      { range: "7d", childId: "c-target" },
      { prisma: prisma as never }
    );
    expect(prisma.mobile_analytics_events.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ child_profile_id: "c-target" }),
      })
    );
    expect(prisma.reading_session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ childProfileId: "c-target" }),
      })
    );
    expect(prisma.question_attempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ childProfileId: "c-target" }),
      })
    );
    // reader_feedback skipped when childId set (no childProfileId column).
    expect(prisma.reader_feedback.findMany).not.toHaveBeenCalled();
  });

  it("category filter is applied post-translation", async () => {
    prisma.question_attempt.findMany.mockResolvedValueOnce([
      {
        id: "qa1",
        userId: "u1",
        childProfileId: "c1",
        bookId: 101n,
        questionId: "q1",
        selectedAnswer: "A",
        isCorrect: true,
        answeredAt: isoMinusMin(5),
      },
    ]);
    prisma.reader_feedback.findMany.mockResolvedValueOnce([
      {
        id: "fb1",
        userId: "u1",
        rating: 5,
        feedback: null,
        createdAt: isoMinusMin(60),
      },
    ]);
    prisma.child_profile.findMany.mockResolvedValueOnce([
      { id: "c1", userId: "u1", displayName: "Ava" },
    ]);
    prisma.books.findMany.mockResolvedValueOnce([
      { id: 101n, title: "Bunny Brother" },
    ]);

    const out = await loadTimeline(
      { range: "30d", category: "feedback" },
      { prisma: prisma as never }
    );
    expect(out.events).toHaveLength(1);
    expect(out.events[0].code).toBe("FEEDBACK_SUBMITTED");
  });
});

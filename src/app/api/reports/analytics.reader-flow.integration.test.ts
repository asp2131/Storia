import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type ReadingSessionRecord = {
  sessionId: string;
  userId: string;
  childProfileId: string;
  bookId: bigint;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  startPage: number;
  endPage: number;
  entryIntent: string;
  usedNarration: boolean;
  usedPracticeMode: boolean;
  completedBook: boolean;
  source: string;
  metadata: Record<string, unknown>;
};

type ChildBookProgressRecord = {
  childProfileId: string;
  bookId: bigint;
  currentPage: number;
  totalPages: number;
  lastReadAt: Date;
  completedAt: Date | null;
  completionCount: number;
  lastSessionId: string | null;
  updatedAt: Date;
};

type BookQuestionRecord = {
  id: string;
  bookId: bigint;
  correctAnswer: string;
};

type QuestionAttemptRecord = {
  userId: string;
  childProfileId: string;
  bookId: bigint;
  questionId: string;
  readingSessionId: string | null;
  selectedAnswer: string;
  isCorrect: boolean;
  answeredAt: Date;
};

type MobileAnalyticsEventRecord = {
  id: string;
  user_id: string;
  child_profile_id: string;
  book_id: bigint | null;
  session_id: string | null;
  event_name: string;
  source: string;
  properties: Record<string, unknown>;
  occurred_at: Date;
  created_at: Date;
};

const { mockValidateChildAccess, mockPrisma, state, resetState } = vi.hoisted(() => {
  const state = {
    readingSessions: [] as ReadingSessionRecord[],
    childBookProgress: [] as ChildBookProgressRecord[],
    bookQuestions: [] as BookQuestionRecord[],
    questionAttempts: [] as QuestionAttemptRecord[],
    mobileEvents: [] as MobileAnalyticsEventRecord[],
  };

  const resetState = () => {
    state.readingSessions = [];
    state.childBookProgress = [];
    state.bookQuestions = [
      { id: "q_reader_1", bookId: 101n, correctAnswer: "A" },
      { id: "q_reader_2", bookId: 101n, correctAnswer: "B" },
    ];
    state.questionAttempts = [];
    state.mobileEvents = [];
  };

  const mockValidateChildAccess = vi.fn(async (childProfileId: string) => {
    if (childProfileId === "child-1") {
      return { user: { id: "user-1" }, childProfile: { id: "child-1" } };
    }

    if (childProfileId === "child-2") {
      return { user: { id: "user-2" }, childProfile: { id: "child-2" } };
    }

    return {
      error: new Response(
        JSON.stringify({ error: { code: "forbidden", message: "Forbidden" } }),
        {
          status: 403,
          headers: { "content-type": "application/json" },
        }
      ),
    };
  });

  const mockPrisma = {
    reading_session: {
      upsert: vi.fn(async ({ where, update, create }) => {
        const existingIndex = state.readingSessions.findIndex(
          (session) => session.sessionId === where.sessionId
        );

        if (existingIndex >= 0) {
          const updated = {
            ...state.readingSessions[existingIndex],
            ...update,
          } as ReadingSessionRecord;
          state.readingSessions[existingIndex] = updated;
          return updated;
        }

        state.readingSessions.push(create as ReadingSessionRecord);
        return create;
      }),
      aggregate: vi.fn(async ({ where }) => {
        const filtered = state.readingSessions.filter((session) => {
          if (where.childProfileId && session.childProfileId !== where.childProfileId) return false;
          if (where.startedAt?.gte && session.startedAt < where.startedAt.gte) return false;
          if (
            where.usedPracticeMode !== undefined &&
            session.usedPracticeMode !== where.usedPracticeMode
          ) {
            return false;
          }
          return true;
        });

        return {
          _count: filtered.length,
          _sum: {
            durationSeconds: filtered.reduce((sum, session) => sum + session.durationSeconds, 0),
          },
        };
      }),
      groupBy: vi.fn(async ({ where }) => {
        const bookIds = new Set(
          state.readingSessions
            .filter((session) => {
              if (where.childProfileId && session.childProfileId !== where.childProfileId) {
                return false;
              }
              if (where.startedAt?.gte && session.startedAt < where.startedAt.gte) {
                return false;
              }
              return true;
            })
            .map((session) => session.bookId.toString())
        );

        return [...bookIds].map((bookId) => ({ bookId: BigInt(bookId) }));
      }),
    },
    child_book_progress: {
      findUnique: vi.fn(async ({ where }) => {
        const { childProfileId, bookId } = where.childProfileId_bookId;
        return (
          state.childBookProgress.find(
            (progress) => progress.childProfileId === childProfileId && progress.bookId === bookId
          ) ?? null
        );
      }),
      upsert: vi.fn(async ({ where, update, create }) => {
        const { childProfileId, bookId } = where.childProfileId_bookId;
        const existingIndex = state.childBookProgress.findIndex(
          (progress) => progress.childProfileId === childProfileId && progress.bookId === bookId
        );

        if (existingIndex >= 0) {
          const updated = {
            ...state.childBookProgress[existingIndex],
            ...update,
            updatedAt: new Date(),
          } as ChildBookProgressRecord;
          state.childBookProgress[existingIndex] = updated;
          return updated;
        }

        const created = {
          ...(create as ChildBookProgressRecord),
          updatedAt: new Date(),
        };
        state.childBookProgress.push(created);
        return created;
      }),
      count: vi.fn(async ({ where }) =>
        state.childBookProgress.filter((progress) => {
          if (where.childProfileId && progress.childProfileId !== where.childProfileId) return false;
          if (where.completedAt?.gte) {
            return progress.completedAt != null && progress.completedAt >= where.completedAt.gte;
          }
          return progress.completedAt != null;
        }).length
      ),
    },
    book_question: {
      findMany: vi.fn(async ({ where }) =>
        state.bookQuestions
          .filter(
            (question) =>
              question.bookId === where.bookId && where.id.in.includes(question.id)
          )
          .map((question) => ({ id: question.id, correctAnswer: question.correctAnswer }))
      ),
    },
    question_attempt: {
      createMany: vi.fn(async ({ data }) => {
        const answeredAt = new Date();
        state.questionAttempts.push(
          ...data.map((attempt: Omit<QuestionAttemptRecord, "answeredAt">) => ({
            ...attempt,
            answeredAt,
          }))
        );
        return { count: data.length };
      }),
      count: vi.fn(async ({ where }) =>
        state.questionAttempts.filter((attempt) => {
          if (where.childProfileId && attempt.childProfileId !== where.childProfileId) return false;
          if (where.answeredAt?.gte && attempt.answeredAt < where.answeredAt.gte) return false;
          if (where.isCorrect !== undefined && attempt.isCorrect !== where.isCorrect) return false;
          return true;
        }).length
      ),
    },
    mobile_analytics_events: {
      create: vi.fn(async ({ data }) => {
        state.mobileEvents.push({
          ...(data as Omit<MobileAnalyticsEventRecord, "created_at">),
          properties: (data.properties ?? {}) as Record<string, unknown>,
          created_at: new Date(),
        });
        return data;
      }),
    },
    $queryRaw: vi.fn(async (query) => {
      const sqlText = Array.isArray(query?.strings) ? query.strings.join(" ") : String(query);
      const childProfileId = query?.values?.[0] as string;
      const sinceDate = query?.values?.[1] as Date;
      const limit = query?.values?.[2] as number | undefined;

      const filteredEvents = state.mobileEvents
        .filter(
          (event) =>
            event.child_profile_id === childProfileId &&
            (!sinceDate || event.occurred_at >= sinceDate)
        )
        .sort((left, right) => {
          const occurredAtDiff = right.occurred_at.getTime() - left.occurred_at.getTime();
          if (occurredAtDiff !== 0) return occurredAtDiff;
          return right.created_at.getTime() - left.created_at.getTime();
        });

      if (sqlText.includes("GROUP BY event_name")) {
        const counts = new Map<string, { count: number; lastOccurredAt: Date }>();

        for (const event of filteredEvents) {
          const existing = counts.get(event.event_name);
          if (existing) {
            existing.count += 1;
            if (event.occurred_at > existing.lastOccurredAt) {
              existing.lastOccurredAt = event.occurred_at;
            }
          } else {
            counts.set(event.event_name, { count: 1, lastOccurredAt: event.occurred_at });
          }
        }

        return [...counts.entries()]
          .map(([eventName, summary]) => ({
            event_name: eventName,
            count: BigInt(summary.count),
            last_occurred_at: summary.lastOccurredAt,
          }))
          .sort((left, right) => {
            const countDiff = Number(right.count) - Number(left.count);
            if (countDiff !== 0) return countDiff;
            return left.event_name.localeCompare(right.event_name);
          });
      }

      return filteredEvents.slice(0, limit ?? filteredEvents.length).map((event) => ({
        id: event.id,
        child_profile_id: event.child_profile_id,
        book_id: event.book_id?.toString() ?? null,
        session_id: event.session_id,
        event_name: event.event_name,
        source: event.source,
        properties: event.properties,
        occurred_at: event.occurred_at,
      }));
    }),
  };

  resetState();

  return { mockValidateChildAccess, mockPrisma, state, resetState };
});

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST as postAnalyticsEvent } from "@/app/api/analytics/events/route";
import { POST as postComprehension } from "@/app/api/comprehension/route";
import { POST as postReadingProgress } from "@/app/api/reading-progress/route";
import { POST as postReadingSession } from "@/app/api/reading-sessions/route";
import { GET as getAnalyticsReport } from "@/app/api/reports/analytics/route";

describe("reader flow -> parent analytics report integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));
    resetState();
  });

  it("rolls reader session, progress, comprehension, and analytics events into the parent report", async () => {
    state.readingSessions.push({
      sessionId: "rs_other_child",
      userId: "user-2",
      childProfileId: "child-2",
      bookId: 202n,
      startedAt: new Date("2026-04-17T09:00:00.000Z"),
      endedAt: new Date("2026-04-17T09:10:00.000Z"),
      durationSeconds: 600,
      startPage: 1,
      endPage: 4,
      entryIntent: "standard",
      usedNarration: false,
      usedPracticeMode: false,
      completedBook: false,
      source: "mobile",
      metadata: {},
    });
    state.childBookProgress.push({
      childProfileId: "child-2",
      bookId: 202n,
      currentPage: 4,
      totalPages: 20,
      lastReadAt: new Date("2026-04-17T09:10:00.000Z"),
      completedAt: new Date("2026-04-17T09:10:00.000Z"),
      completionCount: 1,
      lastSessionId: "rs_other_child",
      updatedAt: new Date("2026-04-17T09:10:00.000Z"),
    });
    state.questionAttempts.push({
      userId: "user-2",
      childProfileId: "child-2",
      bookId: 202n,
      questionId: "q_other_child",
      readingSessionId: "rs_other_child",
      selectedAnswer: "A",
      isCorrect: true,
      answeredAt: new Date("2026-04-17T09:11:00.000Z"),
    });
    state.mobileEvents.push({
      id: "evt_other_child",
      user_id: "user-2",
      child_profile_id: "child-2",
      book_id: 202n,
      session_id: "rs_other_child",
      event_name: "reader_opened",
      source: "mobile",
      properties: { ignored: true },
      occurred_at: new Date("2026-04-17T09:00:05.000Z"),
      created_at: new Date("2026-04-17T09:00:05.000Z"),
    });

    const sessionResponse = await postReadingSession(
      new NextRequest("http://localhost/api/reading-sessions", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "rs_reader_flow",
          childProfileId: "child-1",
          bookId: "101",
          startedAt: "2026-04-17T10:00:00.000Z",
          endedAt: "2026-04-17T10:12:00.000Z",
          startPage: 1,
          endPage: 24,
          entryIntent: "standard",
          usedNarration: true,
          usedPracticeMode: true,
          completedBook: true,
          source: "mobile",
          metadata: { surface: "reader" },
        }),
      })
    );

    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toEqual({
      readingSession: {
        sessionId: "rs_reader_flow",
        childProfileId: "child-1",
        bookId: "101",
        startedAt: "2026-04-17T10:00:00.000Z",
        endedAt: "2026-04-17T10:12:00.000Z",
        durationSeconds: 720,
        startPage: 1,
        endPage: 24,
        entryIntent: "standard",
        usedNarration: true,
        usedPracticeMode: true,
        completedBook: true,
        source: "mobile",
      },
    });

    vi.setSystemTime(new Date("2026-04-17T10:12:30.000Z"));

    const progressResponse = await postReadingProgress(
      new NextRequest("http://localhost/api/reading-progress", {
        method: "POST",
        body: JSON.stringify({
          childProfileId: "child-1",
          bookId: "101",
          currentPage: 24,
          totalPages: 24,
          lastSessionId: "rs_reader_flow",
          completed: true,
        }),
      })
    );

    expect(progressResponse.status).toBe(200);
    expect(await progressResponse.json()).toEqual({
      progress: {
        childProfileId: "child-1",
        bookId: "101",
        currentPage: 24,
        totalPages: 24,
        progressPercent: 100,
        lastReadAt: "2026-04-17T10:12:30.000Z",
        completedAt: "2026-04-17T10:12:30.000Z",
        completionCount: 1,
        lastSessionId: "rs_reader_flow",
        status: "completed",
      },
    });

    vi.setSystemTime(new Date("2026-04-17T10:13:00.000Z"));

    const comprehensionResponse = await postComprehension(
      new NextRequest("http://localhost/api/comprehension", {
        method: "POST",
        body: JSON.stringify({
          childProfileId: "child-1",
          bookId: "101",
          readingSessionId: "rs_reader_flow",
          answers: [
            { questionId: "q_reader_1", selectedAnswer: "A" },
            { questionId: "q_reader_2", selectedAnswer: "C" },
          ],
        }),
      })
    );

    expect(comprehensionResponse.status).toBe(200);
    expect(await comprehensionResponse.json()).toEqual({
      result: {
        bookId: "101",
        childProfileId: "child-1",
        totalQuestions: 2,
        correctCount: 1,
        scorePercent: 50,
        submittedAt: "2026-04-17T10:13:00.000Z",
      },
      answerResults: [
        { questionId: "q_reader_1", selectedAnswer: "A", isCorrect: true },
        { questionId: "q_reader_2", selectedAnswer: "C", isCorrect: false },
      ],
    });

    const readerOpenedResponse = await postAnalyticsEvent(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          event: "reader_opened",
          childProfileId: "child-1",
          bookId: "101",
          sessionId: "rs_reader_flow",
          source: "mobile",
          properties: { entryIntent: "standard" },
          occurredAt: "2026-04-17T10:00:05.000Z",
        }),
      })
    );

    expect(readerOpenedResponse.status).toBe(201);
    expect(await readerOpenedResponse.json()).toEqual({ ok: true });

    const comprehensionEventResponse = await postAnalyticsEvent(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          event: "comprehension_answered",
          childProfileId: "child-1",
          bookId: "101",
          sessionId: "rs_reader_flow",
          source: "mobile",
          properties: { questionId: "q_reader_2", isCorrect: false },
          occurredAt: "2026-04-17T10:13:05.000Z",
        }),
      })
    );

    expect(comprehensionEventResponse.status).toBe(201);
    expect(await comprehensionEventResponse.json()).toEqual({ ok: true });

    vi.setSystemTime(new Date("2026-04-17T10:14:00.000Z"));

    const reportResponse = await getAnalyticsReport(
      new NextRequest(
        "http://localhost/api/reports/analytics?childProfileId=child-1&range=30d&limit=10"
      )
    );
    const reportBody = await reportResponse.json();

    expect(reportResponse.status).toBe(200);
    expect(reportBody).toEqual({
      report: {
        childProfileId: "child-1",
        range: "30d",
        generatedAt: "2026-04-17T10:14:00.000Z",
        summary: {
          childProfileId: "child-1",
          range: "30d",
          booksStarted: 1,
          booksCompleted: 1,
          totalSessions: 1,
          totalReadingMinutes: 12,
          averageSessionMinutes: 12,
          comprehensionAttempts: 2,
          averageComprehensionScore: 50,
          practiceSessions: 1,
          practiceMinutes: 12,
          practiceSessionRatePercent: 100,
        },
        analytics: {
          totalEvents: 2,
          uniqueEventNames: 2,
          eventsByName: [
            {
              eventName: "comprehension_answered",
              count: 1,
              lastOccurredAt: "2026-04-17T10:13:05.000Z",
            },
            {
              eventName: "reader_opened",
              count: 1,
              lastOccurredAt: "2026-04-17T10:00:05.000Z",
            },
          ],
          recentEvents: [
            {
              id: expect.any(String),
              childProfileId: "child-1",
              bookId: "101",
              sessionId: "rs_reader_flow",
              eventName: "comprehension_answered",
              source: "mobile",
              properties: { questionId: "q_reader_2", isCorrect: false },
              occurredAt: "2026-04-17T10:13:05.000Z",
            },
            {
              id: expect.any(String),
              childProfileId: "child-1",
              bookId: "101",
              sessionId: "rs_reader_flow",
              eventName: "reader_opened",
              source: "mobile",
              properties: { entryIntent: "standard" },
              occurredAt: "2026-04-17T10:00:05.000Z",
            },
          ],
        },
      },
    });

    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");
    expect(mockPrisma.reading_session.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.child_book_progress.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.question_attempt.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.mobile_analytics_events.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

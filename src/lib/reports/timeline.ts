import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  eventsForRow,
  type EventCategory,
  type EventLookups,
  type MobileAnalyticsRow,
  type QuestionAttemptRow,
  type ReaderFeedbackRow,
  type ReadingSessionRow,
  type TranslatedEvent,
} from "./eventCatalog";

export const TIMELINE_DEFAULT_LIMIT = 50;
export const TIMELINE_MAX_LIMIT = 200;

export type TimelineFilters = {
  range: "7d" | "30d" | "90d";
  limit?: number;
  childId?: string | null;
  bookId?: bigint | null;
  category?: EventCategory | null;
};

export type TimelinePage = {
  range: TimelineFilters["range"];
  events: TranslatedEvent[];
  pagination: { limit: number; returned: number; truncated: boolean };
};

function clampLimit(input: number | undefined): number {
  if (!input || !Number.isFinite(input) || input < 1) return TIMELINE_DEFAULT_LIMIT;
  return Math.min(Math.floor(input), TIMELINE_MAX_LIMIT);
}

function sinceFromRange(range: TimelineFilters["range"]): Date {
  const days = parseInt(range, 10);
  return new Date(Date.now() - days * 86400000);
}

export async function loadTimeline(
  filters: TimelineFilters,
  deps: { prisma?: typeof defaultPrisma } = {}
): Promise<TimelinePage> {
  const prisma = deps.prisma ?? defaultPrisma;
  const since = sinceFromRange(filters.range);
  const limit = clampLimit(filters.limit);
  const overFetch = Math.min(limit * 2, TIMELINE_MAX_LIMIT);

  // Per-source loads — each capped to overFetch to bound memory.
  const [mobileRows, sessionRows, attemptRows, feedbackRows] = await Promise.all([
    prisma.mobile_analytics_events.findMany({
      where: {
        occurred_at: { gte: since },
        ...(filters.childId ? { child_profile_id: filters.childId } : {}),
        ...(filters.bookId != null ? { book_id: filters.bookId } : {}),
      },
      orderBy: { occurred_at: "desc" },
      take: overFetch,
    }),
    prisma.reading_session.findMany({
      where: {
        endedAt: { gte: since },
        ...(filters.childId ? { childProfileId: filters.childId } : {}),
        ...(filters.bookId != null ? { bookId: filters.bookId } : {}),
      },
      orderBy: { endedAt: "desc" },
      take: overFetch,
    }),
    prisma.question_attempt.findMany({
      where: {
        answeredAt: { gte: since },
        ...(filters.childId ? { childProfileId: filters.childId } : {}),
        ...(filters.bookId != null ? { bookId: filters.bookId } : {}),
      },
      orderBy: { answeredAt: "desc" },
      take: overFetch,
    }),
    // reader_feedback has no childProfileId or bookId — only loaded when no
    // child/book filter is set, so admin views of a specific child/book do not
    // mix in unrelated parent feedback.
    filters.childId || filters.bookId != null
      ? Promise.resolve([])
      : prisma.reader_feedback.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: overFetch,
        }),
  ]);

  const lookups = await buildLookups(prisma, {
    mobile: mobileRows as MobileAnalyticsRow[],
    sessions: sessionRows as ReadingSessionRow[],
    attempts: attemptRows as QuestionAttemptRow[],
  });

  const translated: TranslatedEvent[] = [];
  for (const row of mobileRows as MobileAnalyticsRow[]) {
    translated.push(...eventsForRow({ source: "mobile_analytics_events", row, lookups }));
  }
  for (const row of sessionRows as ReadingSessionRow[]) {
    translated.push(...eventsForRow({ source: "reading_session", row, lookups }));
  }
  for (const row of attemptRows as QuestionAttemptRow[]) {
    translated.push(...eventsForRow({ source: "question_attempt", row, lookups }));
  }
  for (const row of feedbackRows as ReaderFeedbackRow[]) {
    translated.push(...eventsForRow({ source: "reader_feedback", row, lookups }));
  }

  let filtered = translated;
  if (filters.category) {
    filtered = filtered.filter((e) => e.category === filters.category);
  }

  filtered.sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0
  );

  const truncated = filtered.length > limit;
  const events = truncated ? filtered.slice(0, limit) : filtered;

  return {
    range: filters.range,
    events,
    pagination: { limit, returned: events.length, truncated },
  };
}

async function buildLookups(
  prisma: typeof defaultPrisma,
  rows: {
    mobile: MobileAnalyticsRow[];
    sessions: ReadingSessionRow[];
    attempts: QuestionAttemptRow[];
  }
): Promise<EventLookups> {
  const childIds = new Set<string>();
  const bookIds = new Set<bigint>();
  for (const r of rows.mobile) {
    childIds.add(r.child_profile_id);
    if (r.book_id != null) bookIds.add(r.book_id);
  }
  for (const r of rows.sessions) {
    childIds.add(r.childProfileId);
    bookIds.add(r.bookId);
  }
  for (const r of rows.attempts) {
    childIds.add(r.childProfileId);
    bookIds.add(r.bookId);
  }

  const [children, books] = await Promise.all([
    childIds.size === 0
      ? Promise.resolve([])
      : prisma.child_profile.findMany({
          where: { id: { in: Array.from(childIds) } },
          select: { id: true, userId: true, displayName: true },
        }),
    bookIds.size === 0
      ? Promise.resolve([])
      : prisma.books.findMany({
          where: { id: { in: Array.from(bookIds) } },
          select: { id: true, title: true },
        }),
  ]);

  return {
    childById: new Map(children.map((c) => [c.id, c])),
    bookTitleById: new Map(books.map((b) => [b.id.toString(), b.title])),
  };
}

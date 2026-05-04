import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export const VALID_RANGES = ["7d", "30d", "90d"] as const;
export type ReportRange = (typeof VALID_RANGES)[number];

export type ParsedRange = {
  range: ReportRange;
  since: Date;
  until: Date;
};

export type HeadlineData = {
  range: ReportRange;
  generatedAt: string;
  kidsActive: number;
  parentsActive: number;
  totalSessions: number;
  totalReadingMinutes: number;
  averageSessionMinutes: number;
  booksCompleted: number;
  comprehensionAttempts: number;
  averageComprehensionPercent: number;
  narrationAdoptionPercent: number;
  practiceAdoptionPercent: number;
  intentRatio: Record<string, number>;
};

export type TrendPoint = {
  date: string;
  sessions: number;
  minutes: number;
  comprehensionAttempts: number;
};

export type TrendData = {
  range: ReportRange;
  series: TrendPoint[];
};

export type TopBookRow = {
  bookId: string;
  title: string;
  uniqueReaders: number;
  totalSessions: number;
  totalMinutes: number;
  completions: number;
  completionRatePercent: number;
  averageComprehensionPercent: number;
  narrationSessionPercent: number;
  practiceSessionPercent: number;
};

export type TopBooksData = {
  range: ReportRange;
  books: TopBookRow[];
};

export type FeedbackItem = {
  id: string;
  rating: number;
  feedback: string | null;
  createdAt: string;
  parentName: string | null;
  parentEmail: string | null;
};

export type FeedbackData = {
  range: ReportRange;
  items: FeedbackItem[];
  summary: {
    count: number;
    averageRating: number | null;
  };
};

export interface ReportAgg {
  parseRange(input: string | null | undefined): ParsedRange;
  headline(range: ReportRange): Promise<HeadlineData>;
  trend(range: ReportRange): Promise<TrendData>;
  topBooks(range: ReportRange, limit: number): Promise<TopBooksData>;
  feedback(range: ReportRange, limit: number): Promise<FeedbackData>;
}

export function isReportRange(value: unknown): value is ReportRange {
  return (
    typeof value === "string" &&
    (VALID_RANGES as readonly string[]).includes(value)
  );
}

function isoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDailySkeleton(start: Date, end: Date): Map<string, TrendPoint> {
  const out = new Map<string, TrendPoint>();
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const stop = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
  while (cursor.getTime() <= stop.getTime()) {
    const key = isoDateUtc(cursor);
    out.set(key, { date: key, sessions: 0, minutes: 0, comprehensionAttempts: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

type HeadlineRaw = {
  kids_active: bigint | number;
  parents_active: bigint | number;
  total_sessions: bigint | number;
  total_duration_ms: bigint | number;
  books_completed: bigint | number;
  comprehension_attempts: bigint | number;
  comprehension_correct: bigint | number;
  narration_sessions: bigint | number;
  practice_sessions: bigint | number;
};

type SessionsByDayRaw = {
  bucket: Date;
  sessions: bigint | number;
  duration_seconds: bigint | number | null;
};

type AttemptsByDayRaw = {
  bucket: Date;
  attempts: bigint | number;
};

type TopBookRaw = {
  book_id: bigint;
  sessions: bigint | number;
  duration_seconds: bigint | number | null;
  unique_readers: bigint | number;
  narration_sessions: bigint | number;
  practice_sessions: bigint | number;
};

type BookCompletionsRaw = {
  book_id: bigint;
  completions: bigint | number;
};

type BookAttemptsRaw = {
  book_id: bigint;
  attempts: bigint | number;
  correct: bigint | number;
};

export function createReportAgg(
  deps: { prisma?: typeof defaultPrisma } = {}
): ReportAgg {
  const prisma = deps.prisma ?? defaultPrisma;

  return {
    parseRange(input) {
      const range: ReportRange = isReportRange(input) ? input : "30d";
      const days = parseInt(range, 10);
      const until = new Date();
      const since = new Date(until.getTime() - days * 86400000);
      return { range, since, until };
    },

    async headline(range) {
      const days = parseInt(range, 10);
      const since = new Date(Date.now() - days * 86400000);

      const rows = await prisma.$queryRaw<HeadlineRaw[]>(Prisma.sql`
        WITH starts AS (
          SELECT session_id, child_profile_id, user_id, book_id
          FROM mobile_analytics_events
          WHERE event_name = 'reading_session_started'
            AND occurred_at >= ${since}
        ), durations AS (
          SELECT session_id, MAX((properties->>'durationMs')::bigint) AS ms
          FROM mobile_analytics_events
          WHERE event_name IN ('reading_session_ended', 'reading_session_drop_off')
            AND occurred_at >= ${since}
          GROUP BY session_id
        ), narration AS (
          SELECT DISTINCT session_id FROM mobile_analytics_events
          WHERE event_name = 'narration_played' AND occurred_at >= ${since}
        ), practice AS (
          SELECT DISTINCT session_id FROM mobile_analytics_events
          WHERE event_name = 'speech_attempt_started' AND occurred_at >= ${since}
        ), completed AS (
          SELECT DISTINCT child_profile_id, book_id
          FROM mobile_analytics_events
          WHERE event_name = 'book_completed' AND occurred_at >= ${since}
        ), attempts AS (
          SELECT
            COUNT(*)::bigint AS attempts,
            COUNT(*) FILTER (WHERE (properties->>'matchedWordCount')::int > 0)::bigint AS correct
          FROM mobile_analytics_events
          WHERE event_name = 'speech_attempt_completed' AND occurred_at >= ${since}
        )
        SELECT
          (SELECT COUNT(DISTINCT child_profile_id) FROM starts)::bigint AS kids_active,
          (SELECT COUNT(DISTINCT user_id) FROM starts)::bigint AS parents_active,
          (SELECT COUNT(DISTINCT session_id) FROM starts)::bigint AS total_sessions,
          COALESCE((SELECT SUM(ms) FROM durations), 0)::bigint AS total_duration_ms,
          (SELECT COUNT(*) FROM completed)::bigint AS books_completed,
          (SELECT attempts FROM attempts)::bigint AS comprehension_attempts,
          (SELECT correct FROM attempts)::bigint AS comprehension_correct,
          (SELECT COUNT(DISTINCT s.session_id)
             FROM starts s JOIN narration n ON n.session_id = s.session_id)::bigint AS narration_sessions,
          (SELECT COUNT(DISTINCT s.session_id)
             FROM starts s JOIN practice p ON p.session_id = s.session_id)::bigint AS practice_sessions
      `);

      const row = rows[0] ?? ({} as Partial<HeadlineRaw>);
      const totalSessions = Number(row.total_sessions ?? 0);
      const totalReadingMinutes = Math.round(
        Number(row.total_duration_ms ?? 0) / 60000
      );
      const averageSessionMinutes =
        totalSessions > 0 ? Math.round(totalReadingMinutes / totalSessions) : 0;
      const comprehensionAttempts = Number(row.comprehension_attempts ?? 0);
      const comprehensionCorrect = Number(row.comprehension_correct ?? 0);
      const narrationSessions = Number(row.narration_sessions ?? 0);
      const practiceSessions = Number(row.practice_sessions ?? 0);

      return {
        range,
        generatedAt: new Date().toISOString(),
        kidsActive: Number(row.kids_active ?? 0),
        parentsActive: Number(row.parents_active ?? 0),
        totalSessions,
        totalReadingMinutes,
        averageSessionMinutes,
        booksCompleted: Number(row.books_completed ?? 0),
        comprehensionAttempts,
        averageComprehensionPercent: pct(comprehensionCorrect, comprehensionAttempts),
        narrationAdoptionPercent: pct(narrationSessions, totalSessions),
        practiceAdoptionPercent: pct(practiceSessions, totalSessions),
        intentRatio: {},
      };
    },

    async trend(range) {
      const days = parseInt(range, 10);
      const since = new Date(Date.now() - days * 86400000);
      const now = new Date();

      const [sessionsByDay, attemptsByDay] = await Promise.all([
        prisma.$queryRaw<SessionsByDayRaw[]>(Prisma.sql`
          WITH starts AS (
            SELECT session_id, occurred_at
            FROM mobile_analytics_events
            WHERE event_name = 'reading_session_started'
              AND occurred_at >= ${since}
          ), durations AS (
            SELECT session_id, MAX((properties->>'durationMs')::bigint) AS ms
            FROM mobile_analytics_events
            WHERE event_name IN ('reading_session_ended', 'reading_session_drop_off')
              AND occurred_at >= ${since}
            GROUP BY session_id
          )
          SELECT
            DATE_TRUNC('day', s.occurred_at AT TIME ZONE 'UTC') AS bucket,
            COUNT(DISTINCT s.session_id)::bigint AS sessions,
            (COALESCE(SUM(d.ms), 0) / 1000)::bigint AS duration_seconds
          FROM starts s
          LEFT JOIN durations d ON d.session_id = s.session_id
          GROUP BY bucket
          ORDER BY bucket ASC
        `),
        prisma.$queryRaw<AttemptsByDayRaw[]>(Prisma.sql`
          SELECT
            DATE_TRUNC('day', occurred_at AT TIME ZONE 'UTC') AS bucket,
            COUNT(*)::bigint AS attempts
          FROM mobile_analytics_events
          WHERE event_name = 'speech_attempt_completed'
            AND occurred_at >= ${since}
          GROUP BY bucket
          ORDER BY bucket ASC
        `),
      ]);

      const skeleton = buildDailySkeleton(since, now);
      for (const row of sessionsByDay) {
        const key = isoDateUtc(row.bucket);
        const entry = skeleton.get(key);
        if (!entry) continue;
        entry.sessions = Number(row.sessions);
        entry.minutes = Math.round(Number(row.duration_seconds || 0) / 60);
      }
      for (const row of attemptsByDay) {
        const key = isoDateUtc(row.bucket);
        const entry = skeleton.get(key);
        if (!entry) continue;
        entry.comprehensionAttempts = Number(row.attempts);
      }

      return { range, series: Array.from(skeleton.values()) };
    },

    async topBooks(range, limit) {
      const days = parseInt(range, 10);
      const since = new Date(Date.now() - days * 86400000);
      const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

      const bookRows = await prisma.$queryRaw<TopBookRaw[]>(Prisma.sql`
        WITH starts AS (
          SELECT session_id, child_profile_id, book_id
          FROM mobile_analytics_events
          WHERE event_name = 'reading_session_started'
            AND occurred_at >= ${since}
            AND book_id IS NOT NULL
        ), durations AS (
          SELECT session_id, MAX((properties->>'durationMs')::bigint) AS ms
          FROM mobile_analytics_events
          WHERE event_name IN ('reading_session_ended', 'reading_session_drop_off')
            AND occurred_at >= ${since}
          GROUP BY session_id
        ), narration AS (
          SELECT DISTINCT session_id FROM mobile_analytics_events
          WHERE event_name = 'narration_played' AND occurred_at >= ${since}
        ), practice AS (
          SELECT DISTINCT session_id FROM mobile_analytics_events
          WHERE event_name = 'speech_attempt_started' AND occurred_at >= ${since}
        )
        SELECT
          s.book_id AS book_id,
          COUNT(DISTINCT s.session_id)::bigint AS sessions,
          (COALESCE(SUM(d.ms), 0) / 1000)::bigint AS duration_seconds,
          COUNT(DISTINCT s.child_profile_id)::bigint AS unique_readers,
          (COUNT(DISTINCT s.session_id) FILTER (WHERE n.session_id IS NOT NULL))::bigint AS narration_sessions,
          (COUNT(DISTINCT s.session_id) FILTER (WHERE p.session_id IS NOT NULL))::bigint AS practice_sessions
        FROM starts s
        LEFT JOIN durations d ON d.session_id = s.session_id
        LEFT JOIN narration n ON n.session_id = s.session_id
        LEFT JOIN practice p ON p.session_id = s.session_id
        GROUP BY s.book_id
        ORDER BY sessions DESC
        LIMIT ${safeLimit}
      `);

      const bookIds = bookRows.map((r) => r.book_id);
      if (bookIds.length === 0) {
        return { range, books: [] };
      }

      const [titles, completionRows, attemptRows] = await Promise.all([
        prisma.books.findMany({
          where: { id: { in: bookIds } },
          select: { id: true, title: true },
        }),
        prisma.$queryRaw<BookCompletionsRaw[]>(Prisma.sql`
          SELECT book_id, COUNT(DISTINCT child_profile_id)::bigint AS completions
          FROM mobile_analytics_events
          WHERE event_name = 'book_completed'
            AND occurred_at >= ${since}
            AND book_id IN (${Prisma.join(bookIds)})
          GROUP BY book_id
        `),
        prisma.$queryRaw<BookAttemptsRaw[]>(Prisma.sql`
          SELECT
            book_id,
            COUNT(*)::bigint AS attempts,
            COUNT(*) FILTER (WHERE (properties->>'matchedWordCount')::int > 0)::bigint AS correct
          FROM mobile_analytics_events
          WHERE event_name = 'speech_attempt_completed'
            AND occurred_at >= ${since}
            AND book_id IN (${Prisma.join(bookIds)})
          GROUP BY book_id
        `),
      ]);

      const titleById = new Map(
        titles.map((row) => [row.id.toString(), row.title])
      );
      const completionsById = new Map(
        completionRows.map((row) => [row.book_id.toString(), Number(row.completions)])
      );
      const attemptsById = new Map(
        attemptRows.map((row) => [
          row.book_id.toString(),
          { attempts: Number(row.attempts), correct: Number(row.correct) },
        ])
      );

      const books: TopBookRow[] = bookRows.map((row) => {
        const idStr = row.book_id.toString();
        const sessions = Number(row.sessions);
        const uniqueReaders = Number(row.unique_readers);
        const completions = completionsById.get(idStr) ?? 0;
        const attempt = attemptsById.get(idStr) ?? { attempts: 0, correct: 0 };
        const narrationSessions = Number(row.narration_sessions);
        const practiceSessions = Number(row.practice_sessions);
        return {
          bookId: idStr,
          title: titleById.get(idStr) ?? "",
          uniqueReaders,
          totalSessions: sessions,
          totalMinutes: Math.round(Number(row.duration_seconds || 0) / 60),
          completions,
          completionRatePercent: pct(completions, uniqueReaders),
          averageComprehensionPercent: pct(attempt.correct, attempt.attempts),
          narrationSessionPercent: pct(narrationSessions, sessions),
          practiceSessionPercent: pct(practiceSessions, sessions),
        };
      });

      return { range, books };
    },

    async feedback(range, limit) {
      const days = parseInt(range, 10);
      const since = new Date(Date.now() - days * 86400000);
      const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

      const [items, agg] = await Promise.all([
        prisma.reader_feedback.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: safeLimit,
          select: {
            id: true,
            rating: true,
            feedback: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
        }),
        prisma.reader_feedback.aggregate({
          where: { createdAt: { gte: since } },
          _count: true,
          _avg: { rating: true },
        }),
      ]);

      return {
        range,
        items: items.map((row) => ({
          id: row.id,
          rating: row.rating,
          feedback: row.feedback,
          createdAt: row.createdAt.toISOString(),
          parentName: row.user?.name ?? null,
          parentEmail: row.user?.email ?? null,
        })),
        summary: {
          count: agg._count,
          averageRating:
            agg._avg.rating == null ? null : Math.round(agg._avg.rating * 10) / 10,
        },
      };
    },
  };
}

export const reportAgg: ReportAgg = createReportAgg();

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

type DistinctChildRaw = { kids_active: bigint | number };
type DistinctParentRaw = { parents_active: bigint | number };

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

      const [
        sessionAgg,
        practiceAgg,
        narrationAgg,
        booksCompleted,
        comprehensionAttempts,
        correctAttempts,
        intentGroups,
        kidsRows,
        parentsRows,
      ] = await Promise.all([
        prisma.reading_session.aggregate({
          where: { startedAt: { gte: since } },
          _count: true,
          _sum: { durationSeconds: true },
        }),
        prisma.reading_session.aggregate({
          where: { startedAt: { gte: since }, usedPracticeMode: true },
          _count: true,
        }),
        prisma.reading_session.aggregate({
          where: { startedAt: { gte: since }, usedNarration: true },
          _count: true,
        }),
        prisma.child_book_progress.count({
          where: { completedAt: { gte: since } },
        }),
        prisma.question_attempt.count({
          where: { answeredAt: { gte: since } },
        }),
        prisma.question_attempt.count({
          where: { answeredAt: { gte: since }, isCorrect: true },
        }),
        prisma.reading_session.groupBy({
          by: ["entryIntent"],
          where: { startedAt: { gte: since } },
          _count: true,
        }),
        prisma.$queryRaw<DistinctChildRaw[]>(Prisma.sql`
          SELECT COUNT(DISTINCT "childProfileId")::bigint AS kids_active
          FROM reading_session
          WHERE "startedAt" >= ${since}
        `),
        prisma.$queryRaw<DistinctParentRaw[]>(Prisma.sql`
          SELECT COUNT(DISTINCT "userId")::bigint AS parents_active
          FROM reading_session
          WHERE "startedAt" >= ${since}
        `),
      ]);

      const totalSessions = sessionAgg._count;
      const totalReadingMinutes = Math.round(
        (sessionAgg._sum.durationSeconds || 0) / 60
      );
      const averageSessionMinutes =
        totalSessions > 0 ? Math.round(totalReadingMinutes / totalSessions) : 0;

      const intentRatio: Record<string, number> = {};
      for (const row of intentGroups) {
        intentRatio[row.entryIntent || "unknown"] = row._count;
      }

      return {
        range,
        generatedAt: new Date().toISOString(),
        kidsActive: Number(kidsRows[0]?.kids_active ?? 0),
        parentsActive: Number(parentsRows[0]?.parents_active ?? 0),
        totalSessions,
        totalReadingMinutes,
        averageSessionMinutes,
        booksCompleted,
        comprehensionAttempts,
        averageComprehensionPercent: pct(correctAttempts, comprehensionAttempts),
        narrationAdoptionPercent: pct(narrationAgg._count, totalSessions),
        practiceAdoptionPercent: pct(practiceAgg._count, totalSessions),
        intentRatio,
      };
    },

    async trend(range) {
      const days = parseInt(range, 10);
      const since = new Date(Date.now() - days * 86400000);
      const now = new Date();

      const [sessionsByDay, attemptsByDay] = await Promise.all([
        prisma.$queryRaw<SessionsByDayRaw[]>(Prisma.sql`
          SELECT
            DATE_TRUNC('day', "startedAt" AT TIME ZONE 'UTC') AS bucket,
            COUNT(*)::bigint AS sessions,
            COALESCE(SUM("durationSeconds"), 0)::bigint AS duration_seconds
          FROM reading_session
          WHERE "startedAt" >= ${since}
          GROUP BY bucket
          ORDER BY bucket ASC
        `),
        prisma.$queryRaw<AttemptsByDayRaw[]>(Prisma.sql`
          SELECT
            DATE_TRUNC('day', "answeredAt" AT TIME ZONE 'UTC') AS bucket,
            COUNT(*)::bigint AS attempts
          FROM question_attempt
          WHERE "answeredAt" >= ${since}
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
        SELECT
          "bookId" AS book_id,
          COUNT(*)::bigint AS sessions,
          COALESCE(SUM("durationSeconds"), 0)::bigint AS duration_seconds,
          COUNT(DISTINCT "childProfileId")::bigint AS unique_readers,
          SUM(CASE WHEN "usedNarration" THEN 1 ELSE 0 END)::bigint AS narration_sessions,
          SUM(CASE WHEN "usedPracticeMode" THEN 1 ELSE 0 END)::bigint AS practice_sessions
        FROM reading_session
        WHERE "startedAt" >= ${since}
        GROUP BY "bookId"
        ORDER BY sessions DESC
        LIMIT ${safeLimit}
      `);

      const bookIds = bookRows.map((r) => r.book_id);
      if (bookIds.length === 0) {
        return { range, books: [] };
      }

      const [titles, completionRows, attemptRows, correctRows] =
        await Promise.all([
          prisma.books.findMany({
            where: { id: { in: bookIds } },
            select: { id: true, title: true },
          }),
          prisma.child_book_progress.groupBy({
            by: ["bookId"],
            where: { bookId: { in: bookIds }, completedAt: { gte: since } },
            _count: true,
          }),
          prisma.question_attempt.groupBy({
            by: ["bookId"],
            where: { bookId: { in: bookIds }, answeredAt: { gte: since } },
            _count: true,
          }),
          prisma.question_attempt.groupBy({
            by: ["bookId"],
            where: {
              bookId: { in: bookIds },
              answeredAt: { gte: since },
              isCorrect: true,
            },
            _count: true,
          }),
        ]);

      const titleById = new Map(
        titles.map((row) => [row.id.toString(), row.title])
      );
      const completionsById = new Map(
        completionRows.map((row) => [row.bookId.toString(), row._count])
      );
      const attemptsById = new Map(
        attemptRows.map((row) => [row.bookId.toString(), row._count])
      );
      const correctById = new Map(
        correctRows.map((row) => [row.bookId.toString(), row._count])
      );

      const books: TopBookRow[] = bookRows.map((row) => {
        const idStr = row.book_id.toString();
        const sessions = Number(row.sessions);
        const uniqueReaders = Number(row.unique_readers);
        const completions = completionsById.get(idStr) ?? 0;
        const attempts = attemptsById.get(idStr) ?? 0;
        const correct = correctById.get(idStr) ?? 0;
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
          averageComprehensionPercent: pct(correct, attempts),
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

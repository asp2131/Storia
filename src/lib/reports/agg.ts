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

export type LovedPageRow = {
  bookId: string;
  title: string;
  pageNumber: number;
  /** Total heart taps on the page, guests included. Anyone can tap repeatedly. */
  likes: number;
  /** Portion of `likes` from readers who have not signed up. Unverified: the
   *  guest endpoint is public, so treat it as a softer signal. */
  guestLikes: number;
  kidsWhoLiked: number;
  kidsWhoViewed: number;
  /** Share of kids who saw the page and liked it at least once. */
  likeRatePercent: number;
};

export type LovedPagesData = {
  range: ReportRange;
  pages: LovedPageRow[];
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
  lovedPages(range: ReportRange, limit: number): Promise<LovedPagesData>;
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

type LovedPageRaw = {
  book_id: bigint;
  page_number: number;
  likes: bigint;
  guest_likes: bigint;
  kids_liked: bigint;
  kids_viewed: bigint;
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

    async lovedPages(range, limit) {
      const { since } = this.parseRange(range);
      const safeLimit = Math.max(1, Math.min(limit, 50));

      // Signed-in readers: one event per burst of taps with the burst size in
      // `likes`, capped so a forged or buggy client cannot inflate a page.
      // Guests: a daily counter with no reader identity (guest_page_likes).
      // Views are matched as text so a malformed pageNumber on an unrelated
      // event can never fail a cast.
      const rows = await prisma.$queryRaw<LovedPageRaw[]>(Prisma.sql`
        WITH signed_in AS (
          SELECT
            book_id,
            (properties->>'pageNumber')::int AS page_number,
            SUM(LEAST((properties->>'likes')::int, 200))::bigint AS likes,
            COUNT(DISTINCT child_profile_id)::bigint AS kids_liked
          FROM mobile_analytics_events
          WHERE event_name = 'page_interacted'
            AND properties->>'interactionType' = 'page_liked'
            AND occurred_at >= ${since}
            AND book_id IS NOT NULL
            AND properties->>'pageNumber' ~ '^[0-9]{1,6}$'
            AND properties->>'likes' ~ '^[0-9]{1,6}$'
          GROUP BY 1, 2
        ),
        guests AS (
          SELECT book_id, page_number, SUM(likes)::bigint AS likes
          FROM guest_page_likes
          WHERE day >= ${since}::date
          GROUP BY 1, 2
        ),
        liked AS (
          SELECT
            COALESCE(s.book_id, g.book_id) AS book_id,
            COALESCE(s.page_number, g.page_number) AS page_number,
            (COALESCE(s.likes, 0) + COALESCE(g.likes, 0))::bigint AS likes,
            COALESCE(g.likes, 0)::bigint AS guest_likes,
            COALESCE(s.kids_liked, 0)::bigint AS kids_liked
          FROM signed_in s
          FULL OUTER JOIN guests g
            ON g.book_id = s.book_id AND g.page_number = s.page_number
          ORDER BY likes DESC
          LIMIT ${safeLimit}
        )
        SELECT
          l.book_id,
          l.page_number,
          l.likes,
          l.guest_likes,
          l.kids_liked,
          (
            SELECT COUNT(DISTINCT v.child_profile_id)
            FROM mobile_analytics_events v
            WHERE v.event_name = 'page_viewed'
              AND v.occurred_at >= ${since}
              AND v.book_id = l.book_id
              AND v.properties->>'pageNumber' = l.page_number::text
          )::bigint AS kids_viewed
        FROM liked l
        ORDER BY l.likes DESC, l.book_id, l.page_number
      `);

      if (rows.length === 0) {
        return { range, pages: [] };
      }

      const titles = await prisma.books.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.book_id))] } },
        select: { id: true, title: true },
      });
      const titleById = new Map(
        titles.map((row) => [row.id.toString(), row.title])
      );

      return {
        range,
        pages: rows.map((row) => {
          const kidsWhoLiked = Number(row.kids_liked);
          // A like implies a view even if the view event was lost offline.
          const kidsWhoViewed = Math.max(Number(row.kids_viewed), kidsWhoLiked);
          return {
            bookId: row.book_id.toString(),
            title: titleById.get(row.book_id.toString()) ?? "",
            pageNumber: row.page_number,
            likes: Number(row.likes),
            guestLikes: Number(row.guest_likes),
            kidsWhoLiked,
            kidsWhoViewed,
            likeRatePercent: pct(kidsWhoLiked, kidsWhoViewed),
          };
        }),
      };
    },
  };
}

export const reportAgg: ReportAgg = createReportAgg();

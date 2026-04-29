import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateChildAccess } from "@/lib/child-auth";

const VALID_RANGES = ["7d", "30d", "90d"] as const;
type Range = (typeof VALID_RANGES)[number];

function parseSinceDate(range: Range): Date {
  const days = parseInt(range);
  return new Date(Date.now() - days * 86400000);
}

function toCsvRow(values: Array<string | number>) {
  return values
    .map((value) => {
      const stringValue = String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replaceAll('"', '""')}"`;
      }
      return stringValue;
    })
    .join(",");
}

type SourceBreakdownRow = {
  source: string;
  sessions: number;
  minutes: number;
};

type PerBookRow = {
  bookId: string;
  title: string;
  sessions: number;
  minutes: number;
  lastReadAt: string;
  currentPage: number | null;
  totalPages: number | null;
  completed: boolean;
  completionCount: number;
};

type DailySeriesRow = {
  date: string;
  sessions: number;
  minutes: number;
  comprehensionAttempts: number;
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

function isoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDailySkeleton(start: Date, end: Date): Map<string, DailySeriesRow> {
  const out = new Map<string, DailySeriesRow>();
  const cursor = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  ));
  const stop = new Date(Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  ));
  while (cursor.getTime() <= stop.getTime()) {
    const key = isoDateUtc(cursor);
    out.set(key, { date: key, sessions: 0, minutes: 0, comprehensionAttempts: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const childProfileId = searchParams.get("childProfileId");

    if (!childProfileId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "childProfileId is required" } },
        { status: 400 }
      );
    }

    const accessResult = await validateChildAccess(childProfileId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    const range = (searchParams.get("range") || "30d") as string;
    if (!VALID_RANGES.includes(range as Range)) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: `range must be one of: ${VALID_RANGES.join(", ")}` } },
        { status: 400 }
      );
    }

    const sinceDate = parseSinceDate(range as Range);
    const now = new Date();

    const sessionAgg = await prisma.reading_session.aggregate({
      where: { childProfileId, startedAt: { gte: sinceDate } },
      _count: true,
      _sum: { durationSeconds: true },
    });

    const totalSessions = sessionAgg._count;
    const totalReadingMinutes = Math.round((sessionAgg._sum.durationSeconds || 0) / 60);
    const averageSessionMinutes = totalSessions > 0 ? Math.round(totalReadingMinutes / totalSessions) : 0;

    const practiceSessionAgg = await prisma.reading_session.aggregate({
      where: {
        childProfileId,
        startedAt: { gte: sinceDate },
        usedPracticeMode: true,
      },
      _count: true,
      _sum: { durationSeconds: true },
    });

    const practiceSessions = practiceSessionAgg._count;
    const practiceMinutes = Math.round((practiceSessionAgg._sum.durationSeconds || 0) / 60);
    const practiceSessionRatePercent =
      totalSessions > 0 ? Math.round((practiceSessions / totalSessions) * 100) : 0;

    const narrationSessionAgg = await prisma.reading_session.aggregate({
      where: {
        childProfileId,
        startedAt: { gte: sinceDate },
        usedNarration: true,
      },
      _count: true,
      _sum: { durationSeconds: true },
    });

    const narrationSessions = narrationSessionAgg._count;
    const narrationMinutes = Math.round((narrationSessionAgg._sum.durationSeconds || 0) / 60);
    const narrationSessionRatePercent =
      totalSessions > 0 ? Math.round((narrationSessions / totalSessions) * 100) : 0;

    const sourceGroups = await prisma.reading_session.groupBy({
      by: ["source"],
      where: { childProfileId, startedAt: { gte: sinceDate } },
      _count: true,
      _sum: { durationSeconds: true },
    });

    const sourceBreakdown: SourceBreakdownRow[] = sourceGroups
      .map((row) => ({
        source: row.source || "unknown",
        sessions: row._count,
        minutes: Math.round((row._sum.durationSeconds || 0) / 60),
      }))
      .sort((a, b) => b.sessions - a.sessions);

    const perBookGroups = await prisma.reading_session.groupBy({
      by: ["bookId"],
      where: { childProfileId, startedAt: { gte: sinceDate } },
      _count: true,
      _sum: { durationSeconds: true },
      _max: { startedAt: true },
    });

    const booksStarted = perBookGroups.length;
    const bookIds = perBookGroups.map((row) => row.bookId);

    const [progressRows, bookRows] = bookIds.length
      ? await Promise.all([
          prisma.child_book_progress.findMany({
            where: { childProfileId, bookId: { in: bookIds } },
          }),
          prisma.books.findMany({
            where: { id: { in: bookIds } },
            select: { id: true, title: true },
          }),
        ])
      : [[], []];

    const progressByBookId = new Map(
      progressRows.map((row) => [row.bookId.toString(), row])
    );
    const titleByBookId = new Map(
      bookRows.map((row) => [row.id.toString(), row.title])
    );

    const perBook: PerBookRow[] = perBookGroups
      .map((row) => {
        const idStr = row.bookId.toString();
        const progress = progressByBookId.get(idStr);
        const sessionMax = row._max.startedAt;
        const lastRead = progress?.lastReadAt ?? sessionMax ?? sinceDate;
        return {
          bookId: idStr,
          title: titleByBookId.get(idStr) ?? "",
          sessions: row._count,
          minutes: Math.round((row._sum.durationSeconds || 0) / 60),
          lastReadAt: lastRead.toISOString(),
          currentPage: progress?.currentPage ?? null,
          totalPages: progress?.totalPages ?? null,
          completed: Boolean(progress?.completedAt),
          completionCount: progress?.completionCount ?? 0,
        };
      })
      .sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt));

    const booksCompleted = await prisma.child_book_progress.count({
      where: {
        childProfileId,
        completedAt: { gte: sinceDate },
      },
    });

    const comprehensionAttempts = await prisma.question_attempt.count({
      where: { childProfileId, answeredAt: { gte: sinceDate } },
    });

    const correctAttempts = await prisma.question_attempt.count({
      where: { childProfileId, answeredAt: { gte: sinceDate }, isCorrect: true },
    });

    const averageComprehensionScore =
      comprehensionAttempts > 0 ? Math.round((correctAttempts / comprehensionAttempts) * 100) : 0;

    const [sessionsByDay, attemptsByDay] = await Promise.all([
      prisma.$queryRaw<SessionsByDayRaw[]>(Prisma.sql`
        SELECT
          DATE_TRUNC('day', "startedAt" AT TIME ZONE 'UTC') AS bucket,
          COUNT(*)::bigint AS sessions,
          COALESCE(SUM("durationSeconds"), 0)::bigint AS duration_seconds
        FROM reading_session
        WHERE "childProfileId" = ${childProfileId}
          AND "startedAt" >= ${sinceDate}
        GROUP BY bucket
        ORDER BY bucket ASC
      `),
      prisma.$queryRaw<AttemptsByDayRaw[]>(Prisma.sql`
        SELECT
          DATE_TRUNC('day', "answeredAt" AT TIME ZONE 'UTC') AS bucket,
          COUNT(*)::bigint AS attempts
        FROM question_attempt
        WHERE "childProfileId" = ${childProfileId}
          AND "answeredAt" >= ${sinceDate}
        GROUP BY bucket
        ORDER BY bucket ASC
      `),
    ]);

    const dailyMap = buildDailySkeleton(sinceDate, now);
    for (const row of sessionsByDay) {
      const key = isoDateUtc(row.bucket);
      const entry = dailyMap.get(key);
      if (!entry) continue;
      entry.sessions = Number(row.sessions);
      entry.minutes = Math.round(Number(row.duration_seconds || 0) / 60);
    }
    for (const row of attemptsByDay) {
      const key = isoDateUtc(row.bucket);
      const entry = dailyMap.get(key);
      if (!entry) continue;
      entry.comprehensionAttempts = Number(row.attempts);
    }
    const dailySeries = Array.from(dailyMap.values());

    const summary = {
      childProfileId,
      range,
      booksStarted,
      booksCompleted,
      totalSessions,
      totalReadingMinutes,
      averageSessionMinutes,
      comprehensionAttempts,
      averageComprehensionScore,
      practiceSessions,
      practiceMinutes,
      practiceSessionRatePercent,
      narrationSessions,
      narrationMinutes,
      narrationSessionRatePercent,
      sourceBreakdown,
      perBook,
      dailySeries,
    };

    if (searchParams.get("format") === "csv") {
      const csv = [
        toCsvRow([
          "childProfileId",
          "range",
          "booksStarted",
          "booksCompleted",
          "totalSessions",
          "totalReadingMinutes",
          "averageSessionMinutes",
          "comprehensionAttempts",
          "averageComprehensionScore",
          "practiceSessions",
          "practiceMinutes",
          "practiceSessionRatePercent",
          "narrationSessions",
          "narrationMinutes",
          "narrationSessionRatePercent",
        ]),
        toCsvRow([
          summary.childProfileId,
          summary.range,
          summary.booksStarted,
          summary.booksCompleted,
          summary.totalSessions,
          summary.totalReadingMinutes,
          summary.averageSessionMinutes,
          summary.comprehensionAttempts,
          summary.averageComprehensionScore,
          summary.practiceSessions,
          summary.practiceMinutes,
          summary.practiceSessionRatePercent,
          summary.narrationSessions,
          summary.narrationMinutes,
          summary.narrationSessionRatePercent,
        ]),
      ].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reading-summary-${childProfileId}-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to generate summary report:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to generate summary report" } },
      { status: 500 }
    );
  }
}

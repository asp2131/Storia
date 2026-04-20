import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

const VALID_RANGES = ["7d", "30d", "90d"] as const;
type Range = (typeof VALID_RANGES)[number];

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type EventCountRow = {
  event_name: string;
  count: bigint | number;
  last_occurred_at: Date;
};

type RecentEventRow = {
  id: string;
  child_profile_id: string;
  book_id: string | null;
  session_id: string | null;
  event_name: string;
  source: string;
  properties: Record<string, unknown> | null;
  occurred_at: Date;
};

function parseSinceDate(range: Range): Date {
  const days = parseInt(range, 10);
  return new Date(Date.now() - days * 86400000);
}

function toCsvRow(values: Array<string | number>) {
  return values
    .map((value) => {
      const stringValue = String(value);
      if (/[\",\n]/.test(stringValue)) {
        return `"${stringValue.replaceAll('"', '""')}"`;
      }
      return stringValue;
    })
    .join(",");
}

function invalidRequest(message: string, field?: string) {
  return NextResponse.json(
    {
      error: {
        code: "invalid_request",
        message,
        ...(field ? { details: { field } } : {}),
      },
    },
    { status: 400 }
  );
}

function parseLimit(rawValue: string | null): number | NextResponse {
  if (!rawValue) return DEFAULT_LIMIT;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return invalidRequest(`limit must be an integer between 1 and ${MAX_LIMIT}`, "limit");
  }

  return parsed;
}

function isMissingAnalyticsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("mobile_analytics_events") &&
    (message.includes("does not exist") || message.includes("relation") || message.includes("no such table"))
  );
}

async function loadEventCounts(childProfileId: string, sinceDate: Date) {
  try {
    const rows = await prisma.$queryRaw<EventCountRow[]>(Prisma.sql`
      SELECT
        event_name,
        COUNT(*)::bigint AS count,
        MAX(occurred_at) AS last_occurred_at
      FROM mobile_analytics_events
      WHERE child_profile_id = ${childProfileId}
        AND occurred_at >= ${sinceDate}
      GROUP BY event_name
      ORDER BY COUNT(*) DESC, event_name ASC
    `);

    return rows.map((row) => ({
      eventName: row.event_name,
      count: Number(row.count),
      lastOccurredAt: row.last_occurred_at.toISOString(),
    }));
  } catch (error) {
    if (isMissingAnalyticsTableError(error)) {
      return [];
    }
    throw error;
  }
}

async function loadRecentEvents(childProfileId: string, sinceDate: Date, limit: number) {
  try {
    const rows = await prisma.$queryRaw<RecentEventRow[]>(Prisma.sql`
      SELECT
        id,
        child_profile_id,
        book_id::text AS book_id,
        session_id,
        event_name,
        source,
        properties,
        occurred_at
      FROM mobile_analytics_events
      WHERE child_profile_id = ${childProfileId}
        AND occurred_at >= ${sinceDate}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      id: row.id,
      childProfileId: row.child_profile_id,
      bookId: row.book_id,
      sessionId: row.session_id,
      eventName: row.event_name,
      source: row.source,
      properties: row.properties ?? {},
      occurredAt: row.occurred_at.toISOString(),
    }));
  } catch (error) {
    if (isMissingAnalyticsTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const childProfileId = searchParams.get("childProfileId");

    if (!childProfileId) {
      return invalidRequest("childProfileId is required", "childProfileId");
    }

    const range = (searchParams.get("range") || "30d") as string;
    if (!VALID_RANGES.includes(range as Range)) {
      return invalidRequest(`range must be one of: ${VALID_RANGES.join(", ")}`, "range");
    }

    const limit = parseLimit(searchParams.get("limit"));
    if (limit instanceof NextResponse) {
      return limit;
    }

    const accessResult = await validateChildAccess(childProfileId);
    if ("error" in accessResult) {
      return accessResult.error;
    }

    const sinceDate = parseSinceDate(range as Range);

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

    const booksStartedGroups = await prisma.reading_session.groupBy({
      by: ["bookId"],
      where: { childProfileId, startedAt: { gte: sinceDate } },
    });
    const booksStarted = booksStartedGroups.length;

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

    const [eventsByName, recentEvents] = await Promise.all([
      loadEventCounts(childProfileId, sinceDate),
      loadRecentEvents(childProfileId, sinceDate, limit),
    ]);

    const totalEvents = eventsByName.reduce((sum, row) => sum + row.count, 0);

    const report = {
      childProfileId,
      range,
      generatedAt: new Date().toISOString(),
      summary: {
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
      },
      analytics: {
        totalEvents,
        uniqueEventNames: eventsByName.length,
        eventsByName,
        recentEvents,
      },
    };

    if (searchParams.get("format") === "csv") {
      const csv = [
        toCsvRow(["section", "metric", "value"]),
        toCsvRow(["summary", "childProfileId", report.summary.childProfileId]),
        toCsvRow(["summary", "range", report.summary.range]),
        toCsvRow(["summary", "booksStarted", report.summary.booksStarted]),
        toCsvRow(["summary", "booksCompleted", report.summary.booksCompleted]),
        toCsvRow(["summary", "totalSessions", report.summary.totalSessions]),
        toCsvRow(["summary", "totalReadingMinutes", report.summary.totalReadingMinutes]),
        toCsvRow(["summary", "averageSessionMinutes", report.summary.averageSessionMinutes]),
        toCsvRow(["summary", "comprehensionAttempts", report.summary.comprehensionAttempts]),
        toCsvRow(["summary", "averageComprehensionScore", report.summary.averageComprehensionScore]),
        toCsvRow(["summary", "practiceSessions", report.summary.practiceSessions]),
        toCsvRow(["summary", "practiceMinutes", report.summary.practiceMinutes]),
        toCsvRow(["summary", "practiceSessionRatePercent", report.summary.practiceSessionRatePercent]),
        toCsvRow(["analytics", "totalEvents", report.analytics.totalEvents]),
        toCsvRow(["analytics", "uniqueEventNames", report.analytics.uniqueEventNames]),
        "",
        toCsvRow(["eventName", "count", "lastOccurredAt"]),
        ...report.analytics.eventsByName.map((row) =>
          toCsvRow([row.eventName, row.count, row.lastOccurredAt])
        ),
      ].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-report-${childProfileId}-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Failed to generate analytics report:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to generate analytics report" } },
      { status: 500 }
    );
  }
}

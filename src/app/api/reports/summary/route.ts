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

    // Reading sessions aggregation
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

    // Books started: distinct bookId count from reading sessions
    const booksStartedGroups = await prisma.reading_session.groupBy({
      by: ["bookId"],
      where: { childProfileId, startedAt: { gte: sinceDate } },
    });
    const booksStarted = booksStartedGroups.length;

    // Books completed
    const booksCompleted = await prisma.child_book_progress.count({
      where: {
        childProfileId,
        completedAt: { gte: sinceDate },
      },
    });

    // Comprehension attempts
    const comprehensionAttempts = await prisma.question_attempt.count({
      where: { childProfileId, answeredAt: { gte: sinceDate } },
    });

    const correctAttempts = await prisma.question_attempt.count({
      where: { childProfileId, answeredAt: { gte: sinceDate }, isCorrect: true },
    });

    const averageComprehensionScore =
      comprehensionAttempts > 0 ? Math.round((correctAttempts / comprehensionAttempts) * 100) : 0;

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

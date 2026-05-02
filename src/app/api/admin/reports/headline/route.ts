import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reportAgg } from "@/lib/reports/agg";
import { toCsv } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = request.nextUrl;
    const { range } = reportAgg.parseRange(searchParams.get("range"));
    const data = await reportAgg.headline(range);

    if (searchParams.get("format") === "csv") {
      const csv = toCsv(
        [data],
        [
          { header: "range", get: (d) => d.range },
          { header: "kidsActive", get: (d) => d.kidsActive },
          { header: "parentsActive", get: (d) => d.parentsActive },
          { header: "totalSessions", get: (d) => d.totalSessions },
          { header: "totalReadingMinutes", get: (d) => d.totalReadingMinutes },
          { header: "averageSessionMinutes", get: (d) => d.averageSessionMinutes },
          { header: "booksCompleted", get: (d) => d.booksCompleted },
          { header: "comprehensionAttempts", get: (d) => d.comprehensionAttempts },
          { header: "averageComprehensionPercent", get: (d) => d.averageComprehensionPercent },
          { header: "narrationAdoptionPercent", get: (d) => d.narrationAdoptionPercent },
          { header: "practiceAdoptionPercent", get: (d) => d.practiceAdoptionPercent },
        ]
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reports-headline-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[reports/headline] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load headline report" } },
      { status: 500 }
    );
  }
}

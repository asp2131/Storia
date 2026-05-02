import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reportAgg } from "@/lib/reports/agg";
import { toCsv } from "@/lib/reports/csv";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = request.nextUrl;
    const { range } = reportAgg.parseRange(searchParams.get("range"));
    const limit = parseLimit(searchParams.get("limit"));
    const data = await reportAgg.topBooks(range, limit);

    if (searchParams.get("format") === "csv") {
      const csv = toCsv(data.books, [
        { header: "bookId", get: (b) => b.bookId },
        { header: "title", get: (b) => b.title },
        { header: "uniqueReaders", get: (b) => b.uniqueReaders },
        { header: "totalSessions", get: (b) => b.totalSessions },
        { header: "totalMinutes", get: (b) => b.totalMinutes },
        { header: "completions", get: (b) => b.completions },
        { header: "completionRatePercent", get: (b) => b.completionRatePercent },
        { header: "averageComprehensionPercent", get: (b) => b.averageComprehensionPercent },
        { header: "narrationSessionPercent", get: (b) => b.narrationSessionPercent },
        { header: "practiceSessionPercent", get: (b) => b.practiceSessionPercent },
      ]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reports-top-books-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[reports/top-books] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load top-books report" } },
      { status: 500 }
    );
  }
}

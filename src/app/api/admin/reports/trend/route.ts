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
    const data = await reportAgg.trend(range);

    if (searchParams.get("format") === "csv") {
      const csv = toCsv(data.series, [
        { header: "date", get: (p) => p.date },
        { header: "sessions", get: (p) => p.sessions },
        { header: "minutes", get: (p) => p.minutes },
        { header: "comprehensionAttempts", get: (p) => p.comprehensionAttempts },
      ]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reports-trend-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[reports/trend] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load trend report" } },
      { status: 500 }
    );
  }
}

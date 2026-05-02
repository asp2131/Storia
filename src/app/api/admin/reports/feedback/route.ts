import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reportAgg } from "@/lib/reports/agg";
import { toCsv } from "@/lib/reports/csv";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
    const data = await reportAgg.feedback(range, limit);

    if (searchParams.get("format") === "csv") {
      const csv = toCsv(data.items, [
        { header: "id", get: (i) => i.id },
        { header: "createdAt", get: (i) => i.createdAt },
        { header: "rating", get: (i) => i.rating },
        { header: "feedback", get: (i) => i.feedback },
        { header: "parentName", get: (i) => i.parentName },
        { header: "parentEmail", get: (i) => i.parentEmail },
      ]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reports-feedback-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[reports/feedback] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load feedback report" } },
      { status: 500 }
    );
  }
}

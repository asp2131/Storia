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
    const data = await reportAgg.lovedPages(range, limit);

    if (searchParams.get("format") === "csv") {
      const csv = toCsv(data.pages, [
        { header: "bookId", get: (p) => p.bookId },
        { header: "title", get: (p) => p.title },
        { header: "pageNumber", get: (p) => p.pageNumber },
        { header: "likes", get: (p) => p.likes },
        { header: "guestLikes", get: (p) => p.guestLikes },
        { header: "kidsWhoLiked", get: (p) => p.kidsWhoLiked },
        { header: "kidsWhoViewed", get: (p) => p.kidsWhoViewed },
        { header: "likeRatePercent", get: (p) => p.likeRatePercent },
      ]);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reports-loved-pages-${range}.csv"`,
        },
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[reports/loved-pages] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load loved-pages report" } },
      { status: 500 }
    );
  }
}

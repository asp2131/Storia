import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reportAgg } from "@/lib/reports/agg";
import {
  loadTimeline,
  TIMELINE_DEFAULT_LIMIT,
  TIMELINE_MAX_LIMIT,
} from "@/lib/reports/timeline";
import type { EventCategory } from "@/lib/reports/eventCatalog";

const VALID_CATEGORIES: readonly EventCategory[] = [
  "engagement",
  "comprehension",
  "feedback",
  "system",
];

function isCategory(value: string | null): value is EventCategory {
  return value != null && (VALID_CATEGORIES as readonly string[]).includes(value);
}

function parseLimit(raw: string | null): number {
  if (!raw) return TIMELINE_DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return TIMELINE_DEFAULT_LIMIT;
  return Math.min(parsed, TIMELINE_MAX_LIMIT);
}

function parseBookId(raw: string | null): bigint | null {
  if (!raw) return null;
  if (!/^\d+$/.test(raw.trim())) return null;
  try {
    const value = BigInt(raw.trim());
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = request.nextUrl;
    const { range } = reportAgg.parseRange(searchParams.get("range"));
    const limit = parseLimit(searchParams.get("limit"));
    const childId = searchParams.get("childId")?.trim() || null;
    const bookId = parseBookId(searchParams.get("bookId"));
    const categoryRaw = searchParams.get("category");
    const category = isCategory(categoryRaw) ? categoryRaw : null;

    const data = await loadTimeline({ range, limit, childId, bookId, category });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[reports/timeline] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load timeline" } },
      { status: 500 }
    );
  }
}

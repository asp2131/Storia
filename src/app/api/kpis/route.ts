import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { kpiAgg } from "@/lib/reports/kpis";

export const dynamic = "force-dynamic";

function bearer(raw: string | null): string | null {
  const match = raw ? /^bearer\s+(.+)$/i.exec(raw.trim()) : null;
  return match?.[1]?.trim() || null;
}

function tokenMatches(presented: string | null): boolean {
  const expected = process.env.KPI_API_TOKEN;
  if (!expected || !presented) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Launch KPIs for the founder dashboard. Accepts either the shared
 * KPI_API_TOKEN bearer (server-to-server from loratone-workspace) or an
 * admin Better Auth session.
 */
export async function GET(request: NextRequest) {
  if (!tokenMatches(bearer(request.headers.get("authorization")))) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
  }

  try {
    const data = await kpiAgg.kpis();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[kpis] failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to load KPIs" } },
      { status: 500 }
    );
  }
}

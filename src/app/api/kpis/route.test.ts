import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockRequireAdmin, mockKpis } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockKpis: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/reports/kpis", () => ({ kpiAgg: { kpis: mockKpis } }));

import { GET } from "@/app/api/kpis/route";

describe("/api/kpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KPI_API_TOKEN = "secret-token";
    mockKpis.mockResolvedValue({ families: [], funnel: [], authors: [] });
  });
  afterEach(() => {
    delete process.env.KPI_API_TOKEN;
  });

  it("accepts the shared token without an admin session", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/kpis", { headers: { authorization: "Bearer secret-token" } })
    );
    expect(response.status).toBe(200);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it("falls back to admin auth on a wrong token", async () => {
    mockRequireAdmin.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    const response = await GET(
      new NextRequest("http://localhost/api/kpis", { headers: { authorization: "Bearer nope" } })
    );
    expect(response.status).toBe(401);
    expect(mockKpis).not.toHaveBeenCalled();
  });

  it("ignores token auth when KPI_API_TOKEN is unset", async () => {
    delete process.env.KPI_API_TOKEN;
    mockRequireAdmin.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    const response = await GET(
      new NextRequest("http://localhost/api/kpis", { headers: { authorization: "Bearer " } })
    );
    expect(response.status).toBe(401);
  });
});

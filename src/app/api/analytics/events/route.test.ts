import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateChildAccess, mockPrisma } = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockPrisma: {
    mobile_analytics_events: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/analytics/events/route";

describe("/api/analytics/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
  });

  it("rejects invalid book ids", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          event: "reader_opened",
          childProfileId: "child-1",
          bookId: "abc",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "bookId must be a positive integer",
        details: { field: "bookId" },
      },
    });
    expect(mockPrisma.mobile_analytics_events.create).not.toHaveBeenCalled();
  });

  it("persists analytics events", async () => {
    mockPrisma.mobile_analytics_events.create.mockResolvedValue(undefined);

    const response = await POST(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          event: "reader_opened",
          childProfileId: "child-1",
          bookId: "101",
          sessionId: "rs_1",
          source: "mobile",
          properties: {
            childId: "child-1",
            bookId: "101",
            sessionId: "rs_1",
            entryIntent: "standard",
          },
          occurredAt: "2026-04-16T10:00:00.000Z",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockValidateChildAccess).toHaveBeenCalledWith("child-1");
    expect(mockPrisma.mobile_analytics_events.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.mobile_analytics_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: "user-1",
          child_profile_id: "child-1",
          book_id: 101n,
          session_id: "rs_1",
          event_name: "reader_opened",
          source: "mobile",
          properties: {
            childId: "child-1",
            bookId: "101",
            sessionId: "rs_1",
            entryIntent: "standard",
          },
          occurred_at: new Date("2026-04-16T10:00:00.000Z"),
        }),
      })
    );
  });
});

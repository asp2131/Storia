import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateChildAccess, mockGetAuthenticatedUser, mockPrisma } = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockGetAuthenticatedUser: vi.fn(),
  mockPrisma: {
    mobile_analytics_events: {
      create: vi.fn(),
    },
    books: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
  getAuthenticatedUser: mockGetAuthenticatedUser,
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
    mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("persists user-only funnel events without a child profile", async () => {
    mockPrisma.mobile_analytics_events.create.mockResolvedValue(undefined);

    const response = await POST(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ event: "signup_completed", source: "mobile" }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockValidateChildAccess).not.toHaveBeenCalled();
    expect(mockGetAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(mockPrisma.mobile_analytics_events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: "user-1",
          child_profile_id: null,
          event_name: "signup_completed",
        }),
      })
    );
  });

  it("rejects unauthenticated user-only events", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      error: new Response(null, { status: 401 }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ event: "app_opened" }),
      })
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.mobile_analytics_events.create).not.toHaveBeenCalled();
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

  describe("guest readers", () => {
    const anonId = "0b5c7f0e-3a1d-4c55-9a43-2f1e8d6b7a90";
    const post = (body: Record<string, unknown>) =>
      POST(
        new NextRequest("http://localhost/api/analytics/events", {
          method: "POST",
          body: JSON.stringify(body),
        })
      );

    beforeEach(() => {
      mockGetAuthenticatedUser.mockResolvedValue({
        error: new Response(null, { status: 401 }),
      });
      mockPrisma.books.findFirst.mockResolvedValue({ id: 7n });
      mockPrisma.mobile_analytics_events.create.mockResolvedValue(undefined);
    });

    it("stores signed-out reader events against the anonymous id only", async () => {
      const response = await post({
        event: "reading_session_ended",
        anonId,
        bookId: "7",
        sessionId: "web_abc",
        occurredAt: "2001-01-01T00:00:00Z",
        properties: { durationMs: 99 * 3600000, pageNumber: 3, title: "x", email: "a@b.c" },
      });

      expect(response.status).toBe(201);
      const data = mockPrisma.mobile_analytics_events.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        user_id: null,
        anon_id: anonId,
        child_profile_id: null,
        book_id: 7n,
        source: "web",
        properties: { durationMs: 4 * 3600000, pageNumber: 3 },
      });
      expect(Object.keys(data.properties)).toEqual(["pageNumber", "durationMs"]);
      expect(data.occurred_at.getFullYear()).toBeGreaterThan(2001);
    });

    it("rejects events a reader would not send, and unpublished books", async () => {
      expect((await post({ event: "signup_completed", anonId, bookId: "7" })).status).toBe(400);
      expect((await post({ event: "page_viewed", anonId })).status).toBe(400);
      mockPrisma.books.findFirst.mockResolvedValue(null);
      expect((await post({ event: "page_viewed", anonId, bookId: "7" })).status).toBe(404);
      expect(mockPrisma.mobile_analytics_events.create).not.toHaveBeenCalled();
    });

    it("still requires an account when a child profile is named or the id is malformed", async () => {
      mockValidateChildAccess.mockResolvedValue({ error: new Response(null, { status: 401 }) });
      expect((await post({ event: "page_viewed", anonId, bookId: "7", childProfileId: "c" })).status).toBe(401);
      expect((await post({ event: "page_viewed", anonId: "not-a-uuid", bookId: "7" })).status).toBe(401);
      expect(mockPrisma.mobile_analytics_events.create).not.toHaveBeenCalled();
    });

    it("ignores the anonymous id when the reader is signed in", async () => {
      mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "user-1" } });
      await post({ event: "page_viewed", anonId, bookId: "7" });
      const data = mockPrisma.mobile_analytics_events.create.mock.calls[0][0].data;
      expect(data.user_id).toBe("user-1");
      expect(data).not.toHaveProperty("anon_id");
    });
  });
});

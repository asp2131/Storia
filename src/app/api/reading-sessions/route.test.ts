import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockValidateChildAccess, mockPrisma } = vi.hoisted(() => ({
  mockValidateChildAccess: vi.fn(),
  mockPrisma: {
    reading_session: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  validateChildAccess: mockValidateChildAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/reading-sessions/route";

describe("/api/reading-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateChildAccess.mockResolvedValue({
      user: { id: "user-1" },
      childProfile: { id: "child-1" },
    });
    mockPrisma.reading_session.findUnique.mockResolvedValue(null);
  });

  it("rejects invalid endedAt values", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/reading-sessions", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "rs_1",
          childProfileId: "child-1",
          bookId: "101",
          startedAt: "2026-04-06T11:00:00.000Z",
          endedAt: "not-a-date",
          startPage: 1,
          endPage: 5,
        }),
      })
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "endedAt must be a valid ISO date",
        details: { field: "endedAt" },
      },
    });
    expect(mockPrisma.reading_session.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.reading_session.upsert).not.toHaveBeenCalled();
  });

  it("rejects updates to a foreign sessionId", async () => {
    mockPrisma.reading_session.findUnique.mockResolvedValue({ childProfileId: "child-2" });

    const response = await POST(
      new NextRequest("http://localhost/api/reading-sessions", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "rs_foreign",
          childProfileId: "child-1",
          bookId: "101",
          startedAt: "2026-04-06T11:00:00.000Z",
          endedAt: "2026-04-06T11:15:00.000Z",
          startPage: 1,
          endPage: 7,
        }),
      })
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "forbidden",
        message: "Reading session does not belong to this child profile",
      },
    });
    expect(mockPrisma.reading_session.findUnique).toHaveBeenCalledWith({
      where: { sessionId: "rs_foreign" },
      select: { childProfileId: true },
    });
    expect(mockPrisma.reading_session.upsert).not.toHaveBeenCalled();
  });

  it("upserts reading sessions with normalized book ids", async () => {
    mockPrisma.reading_session.upsert.mockImplementation(async ({ create }) => ({
      sessionId: create.sessionId,
      childProfileId: create.childProfileId,
      bookId: create.bookId,
      startedAt: create.startedAt,
      endedAt: create.endedAt,
      durationSeconds: create.durationSeconds,
      startPage: create.startPage,
      endPage: create.endPage,
      entryIntent: create.entryIntent,
      usedNarration: create.usedNarration,
      usedPracticeMode: create.usedPracticeMode,
      completedBook: create.completedBook,
      source: create.source,
    }));

    const response = await POST(
      new NextRequest("http://localhost/api/reading-sessions", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "rs_1",
          childProfileId: "child-1",
          bookId: "101",
          startedAt: "2026-04-06T11:00:00.000Z",
          endedAt: "2026-04-06T11:15:00.000Z",
          startPage: 1,
          endPage: 7,
          entryIntent: "autoplay_narration",
          usedNarration: true,
          usedPracticeMode: false,
          completedBook: false,
          source: "mobile",
        }),
      })
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.readingSession.bookId).toBe("101");
    expect(body.readingSession.durationSeconds).toBe(900);
    expect(body.readingSession.entryIntent).toBe("autoplay_narration");
  });
});

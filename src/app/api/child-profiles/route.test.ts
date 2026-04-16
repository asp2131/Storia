import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAuthenticatedUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockPrisma: {
    child_profile: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/child-auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/child-profiles/route";

describe("/api/child-profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns child profiles for the authenticated user", async () => {
    mockPrisma.child_profile.findMany.mockResolvedValue([
      { id: "child-1", userId: "user-1", displayName: "Ava", ageBand: "6-8", isDefault: true },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.child_profile.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(body).toEqual({
      childProfiles: [
        { id: "child-1", userId: "user-1", displayName: "Ava", ageBand: "6-8", isDefault: true },
      ],
    });
  });

  it("trims input and auto-defaults the first child profile", async () => {
    mockPrisma.child_profile.count.mockResolvedValue(0);
    mockPrisma.child_profile.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.child_profile.create.mockResolvedValue({
      id: "child-1",
      userId: "user-1",
      displayName: "Ava",
      ageBand: "6-8",
      readingLevel: "Level 1",
      isDefault: true,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/child-profiles", {
        method: "POST",
        body: JSON.stringify({
          displayName: "  Ava  ",
          ageBand: " 6-8 ",
          readingLevel: " Level 1 ",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.child_profile.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isDefault: true },
      data: { isDefault: false },
    });
    expect(mockPrisma.child_profile.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        displayName: "Ava",
        ageBand: "6-8",
        readingLevel: "Level 1",
        isDefault: true,
      },
    });
    expect(body.childProfile.isDefault).toBe(true);
  });

  it("returns auth errors for GET without querying prisma", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      error: new Response(JSON.stringify({ error: { code: "unauthorized", message: "Unauthorized" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: "unauthorized",
        message: "Unauthorized",
      },
    });
    expect(mockPrisma.child_profile.findMany).not.toHaveBeenCalled();
  });

  it("creates a non-default child when another default already exists", async () => {
    mockPrisma.child_profile.count.mockResolvedValue(2);
    mockPrisma.child_profile.create.mockResolvedValue({
      id: "child-2",
      userId: "user-1",
      displayName: "Noah",
      ageBand: "9-12",
      readingLevel: null,
      isDefault: false,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/child-profiles", {
        method: "POST",
        body: JSON.stringify({
          displayName: "Noah",
          ageBand: "9-12",
          isDefault: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.child_profile.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.child_profile.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        displayName: "Noah",
        ageBand: "9-12",
        readingLevel: null,
        isDefault: false,
      },
    });
    expect(body.childProfile.isDefault).toBe(false);
  });

  it("rejects non-string readingLevel values", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/child-profiles", {
        method: "POST",
        body: JSON.stringify({
          displayName: "Ava",
          ageBand: "6-8",
          readingLevel: 3,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "invalid_request",
        message: "readingLevel must be a string",
        details: { field: "readingLevel" },
      },
    });
    expect(mockPrisma.child_profile.create).not.toHaveBeenCalled();
  });
});

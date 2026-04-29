import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockHeaders,
  mockCreateClient,
  mockGetUser,
  mockGetSession,
  mockPrisma,
} = vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

  const users = {
    "mobile-user-1": {
      id: "mobile-user-1",
      email: "mobile@example.com",
      name: "Mobile Parent",
      role: "user",
    },
    "web-user-1": {
      id: "web-user-1",
      email: "web@example.com",
      name: "Web Parent",
      role: "user",
    },
  } as const;

  const mockGetUser = vi.fn();
  const mockGetSession = vi.fn();

  return {
    mockHeaders: vi.fn(),
    mockGetUser,
    mockGetSession,
    mockCreateClient: vi.fn(() => ({
      auth: {
        getUser: mockGetUser,
      },
    })),
    mockPrisma: {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id) return users[where.id as keyof typeof users] ?? null;
          if (where.email) return Object.values(users).find((user) => user.email === where.email) ?? null;
          return null;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
          ...(users[where.id as keyof typeof users] ?? users["mobile-user-1"]),
          ...data,
        })),
        create: vi.fn(),
      },
      child_profile: {
        findFirst: vi.fn(),
      },
      child_book_progress: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      user_reading_progress: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
  SupabaseClient: class SupabaseClient {},
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/reading-progress/route";

describe("/api/reading-progress parent-user dual-stack auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "mobile-user-1",
          email: "mobile@example.com",
          email_confirmed_at: "2026-04-28T12:00:00.000Z",
          user_metadata: { full_name: "Mobile Parent" },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({ user: { id: "web-user-1" } });
  });

  it("accepts mobile Supabase bearer auth on the parent GET branch", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Bearer mobile-token" }));
    mockPrisma.user_reading_progress.findUnique.mockResolvedValue({
      userId: "mobile-user-1",
      bookId: 101n,
      currentPage: 8,
      totalPages: 20,
      lastReadAt: new Date("2026-04-28T13:00:00.000Z"),
    });

    const response = await GET(new NextRequest("http://localhost/api/reading-progress?bookId=101"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith("mobile-token");
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockPrisma.user_reading_progress.findUnique).toHaveBeenCalledWith({
      where: {
        userId_bookId: {
          userId: "mobile-user-1",
          bookId: 101n,
        },
      },
    });
    expect(body).toEqual({
      currentPage: 8,
      totalPages: 20,
      lastReadAt: "2026-04-28T13:00:00.000Z",
      progressPercent: 40,
    });
  });

  it("accepts Better Auth cookie auth on the parent POST branch", async () => {
    mockHeaders.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=session-value" }));
    mockPrisma.user_reading_progress.upsert.mockResolvedValue({
      userId: "web-user-1",
      bookId: 101n,
      currentPage: 5,
      totalPages: 10,
      lastReadAt: new Date("2026-04-28T13:05:00.000Z"),
    });

    const response = await POST(new NextRequest("http://localhost/api/reading-progress", {
      method: "POST",
      body: JSON.stringify({
        bookId: "101",
        currentPage: 5,
        totalPages: 10,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(mockPrisma.user_reading_progress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_bookId: {
            userId: "web-user-1",
            bookId: 101n,
          },
        },
        create: expect.objectContaining({
          userId: "web-user-1",
          bookId: 101n,
          currentPage: 5,
          totalPages: 10,
        }),
      })
    );
    expect(body).toEqual({
      success: true,
      progress: {
        currentPage: 5,
        totalPages: 10,
        lastReadAt: "2026-04-28T13:05:00.000Z",
        progressPercent: 50,
      },
    });
  });
});

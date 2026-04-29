import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      reader_feedback: {
        findFirst: vi.fn(),
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

import { GET } from "@/app/api/feedback/status/route";

describe("GET /api/feedback/status", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    mockPrisma.reader_feedback.findFirst.mockResolvedValue(null);
  });

  it("accepts mobile Supabase bearer auth and returns the existing never-submitted shape", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Bearer mobile-token" }));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith("mobile-token");
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockPrisma.reader_feedback.findFirst).toHaveBeenCalledWith({
      where: { userId: "mobile-user-1" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    expect(body).toEqual({ shouldShowFeedback: true, lastFeedbackDate: null });
  });

  it("accepts Better Auth cookie auth and returns the existing cooldown shape", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z"));
    mockHeaders.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=session-value" }));
    mockPrisma.reader_feedback.findFirst.mockResolvedValue({
      createdAt: new Date("2026-04-18T12:00:00.000Z"),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(mockPrisma.reader_feedback.findFirst).toHaveBeenCalledWith({
      where: { userId: "web-user-1" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    expect(body).toEqual({
      shouldShowFeedback: false,
      lastFeedbackDate: "2026-04-18T12:00:00.000Z",
      daysSinceLastFeedback: 10,
    });
  });

  it("keeps the legacy unauthenticated no-modal response shape", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      shouldShowFeedback: false,
      reason: "not_authenticated",
    });
    expect(mockPrisma.reader_feedback.findFirst).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

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
        create: vi.fn(),
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

import { POST } from "@/app/api/feedback/route";

describe("POST /api/feedback", () => {
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
    mockPrisma.reader_feedback.create.mockResolvedValue({ id: "feedback-1" });
  });

  it("accepts mobile Supabase bearer auth and preserves the success response shape", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Bearer mobile-token" }));
    mockPrisma.reader_feedback.create.mockResolvedValue({ id: "feedback-mobile" });

    const response = await POST(new Request("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({ rating: 5, feedback: "Great reader" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith("mobile-token");
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockPrisma.reader_feedback.create).toHaveBeenCalledWith({
      data: {
        userId: "mobile-user-1",
        rating: 5,
        feedback: "Great reader",
      },
    });
    expect(body).toEqual({ success: true, id: "feedback-mobile" });
  });

  it("accepts Better Auth cookie auth and preserves the success response shape", async () => {
    mockHeaders.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=session-value" }));
    mockPrisma.reader_feedback.create.mockResolvedValue({ id: "feedback-web" });

    const response = await POST(new Request("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({ rating: 4 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(mockPrisma.reader_feedback.create).toHaveBeenCalledWith({
      data: {
        userId: "web-user-1",
        rating: 4,
        feedback: null,
      },
    });
    expect(body).toEqual({ success: true, id: "feedback-web" });
  });

  it("keeps the legacy unauthorized response shape", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({ rating: 5 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockPrisma.reader_feedback.create).not.toHaveBeenCalled();
  });
});

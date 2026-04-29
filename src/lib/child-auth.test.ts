import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHeaders, mockCreateClient, mockSupabaseGetUser, mockAuthGetSession, mockPrisma } = vi.hoisted(
  () => ({
    mockHeaders: vi.fn(),
    mockSupabaseGetUser: vi.fn(),
    mockCreateClient: vi.fn(),
    mockAuthGetSession: vi.fn(),
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      child_profile: {
        findFirst: vi.fn(),
      },
    },
  })
);

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockAuthGetSession,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

async function loadChildAuth() {
  vi.resetModules();
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  mockCreateClient.mockReturnValue({
    auth: {
      getUser: mockSupabaseGetUser,
    },
  });
  return import("@/lib/child-auth");
}

const dbUser = {
  id: "user-1",
  email: "parent@example.com",
  name: "Parent Reader",
  role: "user",
};

async function expectErrorStatus(result: unknown, status: number) {
  expect(result).toHaveProperty("error");
  const response = (result as { error: Response }).error;
  expect(response.status).toBe(status);
  return response.json();
}

describe("child-auth dual-stack helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockAuthGetSession.mockResolvedValue(null);
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue(dbUser);
    mockPrisma.user.create.mockResolvedValue(dbUser);
    mockPrisma.child_profile.findFirst.mockResolvedValue(null);
  });

  it("resolves a valid Better Auth cookie session when no bearer token is present", async () => {
    mockAuthGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(dbUser);
    const { getAuthenticatedUser } = await loadChildAuth();

    const result = await getAuthenticatedUser();

    expect(result).toEqual({ user: dbUser });
    expect(mockAuthGetSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(mockSupabaseGetUser).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("resolves an Authorization Bearer token through Supabase and the mapped database user", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Bearer valid-token" }));
    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "supa-1",
          email: "mobile@example.com",
          email_confirmed_at: "2026-04-28T00:00:00.000Z",
          user_metadata: { name: "Mobile Parent" },
        },
      },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "supa-1",
      email: "mobile@example.com",
      name: "Mobile Parent",
      role: "user",
    });
    mockPrisma.user.update.mockResolvedValue({
      id: "supa-1",
      email: "mobile@example.com",
      name: "Mobile Parent",
      role: "user",
    });
    const { getAuthenticatedUser } = await loadChildAuth();

    const result = await getAuthenticatedUser();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://supabase.example.test",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    expect(mockSupabaseGetUser).toHaveBeenCalledWith("valid-token");
    expect(result).toEqual({
      user: {
        id: "supa-1",
        email: "mobile@example.com",
        name: "Mobile Parent",
        role: "user",
      },
    });
    expect(mockAuthGetSession).not.toHaveBeenCalled();
  });

  it("accepts x-supabase-access-token as the explicit raw-token compatibility header", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-supabase-access-token": "raw-mobile-token" }));
    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "supa-raw",
          email: "raw@example.com",
          email_confirmed_at: "2026-04-28T00:00:00.000Z",
          user_metadata: {},
        },
      },
      error: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "supa-raw",
      email: "raw@example.com",
      name: "Raw User",
      role: "user",
    });
    mockPrisma.user.update.mockResolvedValue({
      id: "supa-raw",
      email: "raw@example.com",
      name: "Raw User",
      role: "user",
    });
    const { getAuthenticatedUser } = await loadChildAuth();

    const result = await getAuthenticatedUser();

    expect(mockSupabaseGetUser).toHaveBeenCalledWith("raw-mobile-token");
    expect(result).toEqual({
      user: {
        id: "supa-raw",
        email: "raw@example.com",
        name: "Raw User",
        role: "user",
      },
    });
  });

  it("returns 401 for an invalid bearer token", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Bearer invalid-token" }));
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid jwt" },
    });
    const { getAuthenticatedUser } = await loadChildAuth();

    const result = await getAuthenticatedUser();

    expect(await expectErrorStatus(result, 401)).toEqual({
      error: { code: "unauthorized", message: "Authentication required" },
    });
    expect(mockAuthGetSession).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets non-Bearer Authorization fall through to Better Auth cookie resolution", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Basic abc" }));
    mockAuthGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(dbUser);
    const { getAuthenticatedUser } = await loadChildAuth();

    const result = await getAuthenticatedUser();

    expect(result).toEqual({ user: dbUser });
    expect(mockSupabaseGetUser).not.toHaveBeenCalled();
    expect(mockAuthGetSession).toHaveBeenCalledTimes(1);
  });

  it("rejects unverified Supabase email before linking to an existing Better Auth user", async () => {
    mockHeaders.mockResolvedValue(new Headers({ authorization: "Bearer unverified-token" }));
    mockSupabaseGetUser.mockResolvedValue({
      data: {
        user: {
          id: "supa-unverified",
          email: "parent@example.com",
          email_confirmed_at: null,
          user_metadata: {},
        },
      },
      error: null,
    });
    const { getAuthenticatedUser } = await loadChildAuth();

    const result = await getAuthenticatedUser();

    expect(await expectErrorStatus(result, 401)).toEqual({
      error: { code: "unauthorized", message: "Authentication required" },
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 403 from validateChildAccess for a child profile owned by another user", async () => {
    mockAuthGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(dbUser);
    mockPrisma.child_profile.findFirst.mockResolvedValue(null);
    const { validateChildAccess } = await loadChildAuth();

    const result = await validateChildAccess("child-2");

    expect(await expectErrorStatus(result, 403)).toEqual({
      error: {
        code: "forbidden",
        message: "You do not have access to this child profile",
      },
    });
    expect(mockPrisma.child_profile.findFirst).toHaveBeenCalledWith({
      where: { id: "child-2", userId: "user-1" },
    });
  });

  it("returns user and childProfile from validateChildAccess for an owned child profile", async () => {
    const childProfile = { id: "child-1", userId: "user-1", displayName: "Ava" };
    mockAuthGetSession.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(dbUser);
    mockPrisma.child_profile.findFirst.mockResolvedValue(childProfile);
    const { validateChildAccess } = await loadChildAuth();

    const result = await validateChildAccess("child-1");

    expect(result).toEqual({ user: dbUser, childProfile });
    expect(mockPrisma.child_profile.findFirst).toHaveBeenCalledWith({
      where: { id: "child-1", userId: "user-1" },
    });
  });
});

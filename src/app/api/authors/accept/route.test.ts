import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockGetSession } = vi.hoisted(() => ({
  mockPrisma: {
    author_invite: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { update: vi.fn() },
  },
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { getSession: mockGetSession } }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { POST } from "@/app/api/authors/accept/route";
import { hashInviteToken } from "@/lib/author-invites";

const TOKEN = "invite-token-abc";
const FUTURE = new Date(Date.now() + 60_000);

const pendingInvite = {
  id: "inv_1",
  email: "author@example.com",
  token_hash: hashInviteToken(TOKEN),
  invited_by: "admin_1",
  note: null,
  expires_at: FUTURE,
  accepted_at: null,
  accepted_user_id: null,
  revoked_at: null,
  createdAt: new Date(),
};

const signedInAs = (email: string, role = "user") => {
  mockGetSession.mockResolvedValue({
    user: { id: "user_1", email, name: "A", role },
  });
};

const post = (token: string = TOKEN) =>
  POST(
    new NextRequest("http://localhost/api/authors/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
    })
  );

describe("POST /api/authors/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.author_invite.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("promotes the invited account to author", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue(pendingInvite);
    signedInAs("author@example.com");

    const response = await post();

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { role: "author" },
    });
    // Single-use: the claim is conditional on the invite still being open.
    expect(mockPrisma.author_invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1", accepted_at: null, revoked_at: null },
      })
    );
  });

  it("refuses a forwarded link redeemed by a different account", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue(pendingInvite);
    signedInAs("someone.else@example.com");

    const response = await post();

    expect(response.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses an expired invite", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue({
      ...pendingInvite,
      expires_at: new Date(Date.now() - 60_000),
    });
    signedInAs("author@example.com");

    const response = await post();

    expect(response.status).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses an already-accepted invite", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue({
      ...pendingInvite,
      accepted_at: new Date(),
    });
    signedInAs("author@example.com");

    expect((await post()).status).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue(pendingInvite);
    mockGetSession.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue(null);
    signedInAs("author@example.com");

    expect((await post("bogus")).status).toBe(404);
  });

  it("never demotes an admin who redeems an invite", async () => {
    mockPrisma.author_invite.findUnique.mockResolvedValue(pendingInvite);
    signedInAs("author@example.com", "admin");

    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ role: "admin" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth";
import {
  emailsMatch,
  hashInviteToken,
  inviteState,
} from "@/lib/author-invites";

/**
 * Look up an invite by token so the accept page can tell the visitor which
 * address to sign in with. Returns only the invited email and the state —
 * never anything about the rest of the library.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const invite = await prisma.author_invite.findUnique({
    where: { token_hash: hashInviteToken(token) },
    select: { email: true, accepted_at: true, revoked_at: true, expires_at: true },
  });

  if (!invite) {
    return NextResponse.json(
      { error: "This invitation link is not valid." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    email: invite.email,
    state: inviteState(invite),
  });
}

/** Redeem an invite: grants role="author" to the signed-in, matching account. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token ?? "");
    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Sign in first to accept this invitation." },
        { status: 401 }
      );
    }

    const invite = await prisma.author_invite.findUnique({
      where: { token_hash: hashInviteToken(token) },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "This invitation link is not valid." },
        { status: 404 }
      );
    }

    const state = inviteState(invite);
    if (state !== "pending") {
      return NextResponse.json(
        { error: `This invitation has already been ${state}.` },
        { status: 409 }
      );
    }

    // The invite is bound to one address — a forwarded link must not let a
    // different account claim it.
    if (!emailsMatch(invite.email, session.user.email)) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`,
        },
        { status: 403 }
      );
    }

    const currentRole =
      (session.user as { role?: string }).role ?? "user";

    // Never demote an admin who happens to redeem an invite.
    if (currentRole === "user") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { role: "author" },
      });
    }

    // Conditional update: two clicks on the same link can't both win.
    const claimed = await prisma.author_invite.updateMany({
      where: { id: invite.id, accepted_at: null, revoked_at: null },
      data: { accepted_at: new Date(), accepted_user_id: session.user.id },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This invitation has already been accepted." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      role: currentRole === "admin" ? "admin" : "author",
    });
  } catch (error) {
    console.error("[author invites] Failed to accept:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation." },
      { status: 500 }
    );
  }
}

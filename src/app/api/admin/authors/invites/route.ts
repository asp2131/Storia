import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { sendMail } from "@/lib/mail";
import {
  INVITE_TTL_DAYS,
  hashInviteToken,
  inviteState,
  inviteUrl,
  newInviteToken,
  normalizeEmail,
} from "@/lib/author-invites";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const invites = await prisma.author_invite.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        note: invite.note,
        state: inviteState(invite),
        expiresAt: invite.expires_at.toISOString(),
        acceptedAt: invite.accepted_at?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[author invites] Failed to list:", error);
    return NextResponse.json(
      { error: "Failed to load invites." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const { user: admin } = authResult;

  try {
    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ""));
    const note = body?.note ? String(body.note).slice(0, 500) : null;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });
    if (existing && existing.role !== "user") {
      return NextResponse.json(
        { error: `That account is already a ${existing.role}.` },
        { status: 409 }
      );
    }

    const token = newInviteToken();
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    // Supersede any outstanding invite for this address so only the newest
    // link is redeemable.
    await prisma.author_invite.updateMany({
      where: { email, accepted_at: null, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    const invite = await prisma.author_invite.create({
      data: {
        email,
        token_hash: hashInviteToken(token),
        invited_by: admin.id,
        note,
        expires_at: expiresAt,
      },
    });

    const url = inviteUrl(token);
    let emailSent = true;
    try {
      await sendMail({
        to: email,
        subject: "You're invited to publish on Loratone",
        text: `You've been invited to add your books to the Loratone library.\n\nAccept your invitation: ${url}\n\nThis link expires in ${INVITE_TTL_DAYS} days and works only for ${email}.`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #111827; margin-bottom: 16px;">Loratone</h2>
            <p style="color: #374151;">You've been invited to add your books to the Loratone library.</p>
            ${note ? `<p style="color:#374151;font-style:italic;">${escapeHtml(note)}</p>` : ""}
            <p style="margin: 24px 0;">
              <a href="${url}" style="background:#1337ec;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invitation</a>
            </p>
            <p style="color:#6b7280;font-size:13px;">This link expires in ${INVITE_TTL_DAYS} days and works only for ${escapeHtml(email)}.</p>
          </div>
        `,
      });
    } catch (mailError) {
      // The invite row is valid regardless — hand the admin the link to send
      // manually rather than losing the whole request.
      console.error("[author invites] Email send failed:", mailError);
      emailSent = false;
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        note: invite.note,
        state: inviteState(invite),
        expiresAt: invite.expires_at.toISOString(),
        acceptedAt: null,
        createdAt: invite.createdAt.toISOString(),
      },
      // Shown once so the admin can share it directly if mail delivery failed.
      url,
      emailSent,
    });
  } catch (error) {
    console.error("[author invites] Failed to create:", error);
    return NextResponse.json(
      { error: "Failed to create invite." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

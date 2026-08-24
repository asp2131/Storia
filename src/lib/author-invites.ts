import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** How long an unaccepted invite stays valid. */
export const INVITE_TTL_DAYS = 14;

export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Only the hash is stored. An invite link grants a role, so a leaked database
 * dump must not be redeemable.
 */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Case-insensitive, length-safe email comparison for the redemption check. */
export function emailsMatch(a: string, b: string): boolean {
  const x = Buffer.from(normalizeEmail(a));
  const y = Buffer.from(normalizeEmail(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function inviteUrl(token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/authors/accept?token=${encodeURIComponent(token)}`;
}

export type InviteState = "pending" | "accepted" | "revoked" | "expired";

export function inviteState(invite: {
  accepted_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
}): InviteState {
  if (invite.accepted_at) return "accepted";
  if (invite.revoked_at) return "revoked";
  if (invite.expires_at.getTime() < Date.now()) return "expired";
  return "pending";
}

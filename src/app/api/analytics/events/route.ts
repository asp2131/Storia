import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

function parsePositiveBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return null;
  }

  const stringValue = String(value).trim();
  if (!/^\d+$/.test(stringValue)) {
    return null;
  }

  const parsed = BigInt(stringValue);
  return parsed > 0n ? parsed : null;
}

const ANON_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The only events a guest (no account) may send: what the web reader emits. */
const GUEST_EVENTS = new Set([
  "reading_session_started",
  "reading_session_ended",
  "book_started",
  "page_viewed",
  "book_completed",
]);

const MAX_GUEST_DURATION_MS = 4 * 60 * 60 * 1000;

/** Keeps the few numeric properties reports read; drops everything else. */
function guestProperties(properties: unknown): Prisma.InputJsonValue {
  const input = (properties ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of ["pageNumber", "totalPages"]) {
    const value = input[key];
    if (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100_000) {
      out[key] = value as number;
    }
  }
  const duration = input.durationMs;
  if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0) {
    out.durationMs = Math.min(Math.round(duration), MAX_GUEST_DURATION_MS);
  }
  return out;
}

// ponytail: per-instance fixed window, so it only stops floods hitting one warm
// instance. Generous because a school shares one IP. Move to an edge limiter
// (Vercel firewall / Upstash) if guest numbers start to look off.
const GUEST_LIMIT = 1000;
const GUEST_WINDOW_MS = 10 * 60 * 1000;
const guestHits = new Map<string, { count: number; resetAt: number }>();

function guestRateLimited(request: NextRequest): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if (guestHits.size > 10_000) guestHits.clear();
  const hit = guestHits.get(ip);
  if (!hit || hit.resetAt <= now) {
    guestHits.set(ip, { count: 1, resetAt: now + GUEST_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > GUEST_LIMIT;
}

function invalidRequest(message: string, field: string) {
  return NextResponse.json(
    { error: { code: "invalid_request", message, details: { field } } },
    { status: 400 }
  );
}

/**
 * Ingests one analytics event.
 *
 * `childProfileId` is optional: funnel events (app opened, sign-up, onboarding,
 * profile creation) and web-reader events happen before or without a child
 * profile. When present it must belong to the caller; when absent the event is
 * stored against the authenticated user only.
 *
 * Signed-out web readers send `anonId` (a random UUID from localStorage) and are
 * stored as guests: reader events only, published books only, server clock,
 * and only page/duration numbers kept from properties.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = typeof body?.event === "string" ? body.event.trim() : "";
    const childProfileId =
      typeof body?.childProfileId === "string" && body.childProfileId.trim()
        ? body.childProfileId.trim()
        : null;
    const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "mobile";
    const sessionId = typeof body?.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
    const occurredAtRaw = body?.occurredAt;
    const properties = body?.properties;

    if (!event) {
      return invalidRequest("event is required", "event");
    }
    if (body?.bookId != null && parsePositiveBigInt(body.bookId) == null) {
      return invalidRequest("bookId must be a positive integer", "bookId");
    }
    if (properties != null && (typeof properties !== "object" || Array.isArray(properties))) {
      return invalidRequest("properties must be a JSON object", "properties");
    }

    const anonId =
      typeof body?.anonId === "string" && ANON_ID_PATTERN.test(body.anonId.trim())
        ? body.anonId.trim().toLowerCase()
        : null;

    const accessResult = childProfileId
      ? await validateChildAccess(childProfileId)
      : await getAuthenticatedUser();
    if ("error" in accessResult) {
      if (childProfileId || !anonId) return accessResult.error;
      return await recordGuestEvent(request, { anonId, event, bookId: body?.bookId, sessionId, properties });
    }

    const occurredAt =
      typeof occurredAtRaw === "string" || occurredAtRaw instanceof Date
        ? new Date(occurredAtRaw)
        : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return invalidRequest("occurredAt must be a valid ISO date", "occurredAt");
    }

    const bookId = body?.bookId == null ? null : parsePositiveBigInt(body.bookId);
    const normalizedProperties = (properties ?? {}) as Prisma.InputJsonValue;

    await prisma.mobile_analytics_events.create({
      data: {
        id: crypto.randomUUID(),
        user_id: accessResult.user.id,
        child_profile_id: childProfileId,
        book_id: bookId,
        session_id: sessionId,
        event_name: event,
        source,
        properties: normalizedProperties,
        occurred_at: occurredAt,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to persist analytics event:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to persist analytics event" } },
      { status: 500 }
    );
  }
}

async function recordGuestEvent(
  request: NextRequest,
  input: { anonId: string; event: string; bookId: unknown; sessionId: string | null; properties: unknown }
) {
  if (!GUEST_EVENTS.has(input.event)) {
    return invalidRequest("event is not allowed without an account", "event");
  }
  const bookId = parsePositiveBigInt(input.bookId);
  if (bookId == null) {
    return invalidRequest("bookId is required", "bookId");
  }
  if (guestRateLimited(request)) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many events" } },
      { status: 429 }
    );
  }
  const book = await prisma.books.findFirst({
    where: { id: bookId, is_published: true },
    select: { id: true },
  });
  if (!book) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No such published book" } },
      { status: 404 }
    );
  }

  await prisma.mobile_analytics_events.create({
    data: {
      id: crypto.randomUUID(),
      user_id: null,
      anon_id: input.anonId,
      child_profile_id: null,
      book_id: bookId,
      session_id: input.sessionId?.slice(0, 64) ?? null,
      event_name: input.event,
      source: "web",
      properties: guestProperties(input.properties),
      // A guest's clock is never trusted.
      occurred_at: new Date(),
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

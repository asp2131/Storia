import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
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

function invalidRequest(message: string, field: string) {
  return NextResponse.json(
    { error: { code: "invalid_request", message, details: { field } } },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = typeof body?.event === "string" ? body.event.trim() : "";
    const childProfileId = typeof body?.childProfileId === "string" ? body.childProfileId.trim() : "";
    const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "mobile";
    const sessionId = typeof body?.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
    const occurredAtRaw = body?.occurredAt;
    const properties = body?.properties;

    if (!event) {
      return invalidRequest("event is required", "event");
    }
    if (!childProfileId) {
      return invalidRequest("childProfileId is required", "childProfileId");
    }
    if (body?.bookId != null && parsePositiveBigInt(body.bookId) == null) {
      return invalidRequest("bookId must be a positive integer", "bookId");
    }
    if (properties != null && (typeof properties !== "object" || Array.isArray(properties))) {
      return invalidRequest("properties must be a JSON object", "properties");
    }

    const accessResult = await validateChildAccess(childProfileId);
    if ("error" in accessResult) return accessResult.error;

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

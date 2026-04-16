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

function parseDateValue(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      childProfileId,
      bookId,
      startedAt,
      endedAt,
      startPage,
      endPage,
      entryIntent,
      usedNarration,
      usedPracticeMode,
      completedBook,
      source,
      metadata,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "sessionId is required", details: { field: "sessionId" } } },
        { status: 400 }
      );
    }
    if (!childProfileId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "childProfileId is required", details: { field: "childProfileId" } } },
        { status: 400 }
      );
    }
    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required", details: { field: "bookId" } } },
        { status: 400 }
      );
    }
    if (!startedAt) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "startedAt is required", details: { field: "startedAt" } } },
        { status: 400 }
      );
    }
    if (!endedAt) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endedAt is required", details: { field: "endedAt" } } },
        { status: 400 }
      );
    }

    const result = await validateChildAccess(childProfileId);
    if ("error" in result) return result.error;

    const parsedBookId = parsePositiveBigInt(bookId);
    if (parsedBookId == null) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId must be a positive integer", details: { field: "bookId" } } },
        { status: 400 }
      );
    }

    const start = parseDateValue(startedAt);
    if (!start) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "startedAt must be a valid ISO date", details: { field: "startedAt" } } },
        { status: 400 }
      );
    }

    const end = parseDateValue(endedAt);
    if (!end) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endedAt must be a valid ISO date", details: { field: "endedAt" } } },
        { status: 400 }
      );
    }

    if (end < start) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endedAt must be >= startedAt", details: { field: "endedAt" } } },
        { status: 400 }
      );
    }
    if (typeof startPage !== "number" || startPage < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "startPage must be >= 1", details: { field: "startPage" } } },
        { status: 400 }
      );
    }
    if (typeof endPage !== "number" || endPage < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endPage must be >= 1", details: { field: "endPage" } } },
        { status: 400 }
      );
    }

    const durationSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

    const readingSession = await prisma.reading_session.upsert({
      where: { sessionId },
      update: {
        endedAt: end,
        durationSeconds,
        startPage,
        endPage,
        entryIntent: entryIntent || "standard",
        usedNarration: usedNarration || false,
        usedPracticeMode: usedPracticeMode || false,
        completedBook: completedBook || false,
        source: source || "mobile",
        metadata: metadata || {},
      },
      create: {
        sessionId,
        userId: result.user.id,
        childProfileId,
        bookId: parsedBookId,
        startedAt: start,
        endedAt: end,
        durationSeconds,
        startPage,
        endPage,
        entryIntent: entryIntent || "standard",
        usedNarration: usedNarration || false,
        usedPracticeMode: usedPracticeMode || false,
        completedBook: completedBook || false,
        source: source || "mobile",
        metadata: metadata || {},
      },
    });

    return NextResponse.json({
      readingSession: {
        sessionId: readingSession.sessionId,
        childProfileId: readingSession.childProfileId,
        bookId: readingSession.bookId.toString(),
        startedAt: readingSession.startedAt.toISOString(),
        endedAt: readingSession.endedAt.toISOString(),
        durationSeconds: readingSession.durationSeconds,
        startPage: readingSession.startPage,
        endPage: readingSession.endPage,
        entryIntent: readingSession.entryIntent,
        usedNarration: readingSession.usedNarration,
        usedPracticeMode: readingSession.usedPracticeMode,
        completedBook: readingSession.completedBook,
        source: readingSession.source,
      },
    });
  } catch (error) {
    console.error("Error creating reading session:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create reading session" } },
      { status: 500 }
    );
  }
}

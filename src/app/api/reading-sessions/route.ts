import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

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

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "sessionId is required" } },
        { status: 400 }
      );
    }
    if (!childProfileId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "childProfileId is required" } },
        { status: 400 }
      );
    }
    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required" } },
        { status: 400 }
      );
    }
    if (!startedAt) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "startedAt is required" } },
        { status: 400 }
      );
    }
    if (!endedAt) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endedAt is required" } },
        { status: 400 }
      );
    }

    const result = await validateChildAccess(childProfileId);
    if ("error" in result) return result.error;

    const start = new Date(startedAt);
    const end = new Date(endedAt);

    if (end < start) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endedAt must be >= startedAt" } },
        { status: 400 }
      );
    }
    if (typeof startPage !== "number" || startPage < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "startPage must be >= 1" } },
        { status: 400 }
      );
    }
    if (typeof endPage !== "number" || endPage < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "endPage must be >= 1" } },
        { status: 400 }
      );
    }

    const durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);

    const readingSession = await prisma.reading_session.upsert({
      where: { sessionId },
      update: {
        endedAt: end,
        durationSeconds,
        endPage,
        completedBook: completedBook || false,
        metadata: metadata || {},
      },
      create: {
        sessionId,
        userId: result.user.id,
        childProfileId,
        bookId: BigInt(bookId),
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

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_TRACKS_PER_BOOK,
  narrationError,
  serializeTrack,
} from "@/lib/narration/tracks";

const TRACK_INCLUDE = {
  pages: {
    include: { page: { select: { page_number: true } } },
  },
} as const;

/** GET /api/narrations/tracks?bookId=123 — the caller's own tracks. */
export async function GET(request: NextRequest) {
  try {
    const result = await getAuthenticatedUser();
    if ("error" in result) return result.error;

    const bookIdParam = request.nextUrl.searchParams.get("bookId");
    let bookId: bigint | undefined;

    if (bookIdParam) {
      try {
        bookId = BigInt(bookIdParam);
      } catch {
        return narrationError("invalid_request", "bookId must be numeric", 400);
      }
    }

    const tracks = await prisma.user_narration_track.findMany({
      where: { userId: result.user.id, ...(bookId !== undefined ? { book_id: bookId } : {}) },
      include: TRACK_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ tracks: tracks.map(serializeTrack) });
  } catch (error) {
    console.error("[narration] list tracks failed:", error);
    return narrationError("internal_error", "Failed to load narration tracks", 500);
  }
}

/** POST /api/narrations/tracks — start a new recording track for a book. */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthenticatedUser();
    if ("error" in result) return result.error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return narrationError("invalid_request", "Request body must be JSON", 400);
    }

    const { bookId: rawBookId, label: rawLabel } = body as {
      bookId?: unknown;
      label?: unknown;
    };

    const label = typeof rawLabel === "string" ? rawLabel.trim() : "";
    if (!label) {
      return narrationError("invalid_request", "label is required", 400, { field: "label" });
    }
    if (label.length > 80) {
      return narrationError("invalid_request", "label must be 80 characters or fewer", 400, {
        field: "label",
      });
    }

    let bookId: bigint;
    try {
      bookId = BigInt(String(rawBookId ?? ""));
    } catch {
      return narrationError("invalid_request", "bookId is required", 400, { field: "bookId" });
    }

    const book = await prisma.books.findUnique({
      where: { id: bookId },
      select: { id: true, is_published: true },
    });

    if (!book || !book.is_published) {
      return narrationError("not_found", "Book not found", 404);
    }

    const existingCount = await prisma.user_narration_track.count({
      where: { userId: result.user.id, book_id: bookId },
    });

    if (existingCount >= MAX_TRACKS_PER_BOOK) {
      return narrationError(
        "limit_reached",
        `You can keep up to ${MAX_TRACKS_PER_BOOK} recordings per book. Delete one to record another.`,
        409
      );
    }

    const track = await prisma.user_narration_track.create({
      data: { userId: result.user.id, book_id: bookId, label, status: "draft" },
      include: TRACK_INCLUDE,
    });

    return NextResponse.json({ track: serializeTrack(track) }, { status: 201 });
  } catch (error) {
    console.error("[narration] create track failed:", error);
    return narrationError("internal_error", "Failed to create narration track", 500);
  }
}

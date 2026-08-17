import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";
import { narrationError, serializeTrack } from "@/lib/narration/tracks";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/books/[id]/narrations
 *
 * Reader payload: the caller's own narration tracks for this book, each with
 * per-page audio + word timings. The mobile reader substitutes these into
 * PageData, so the shape mirrors pages.narration_url / narration_timestamps.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    let bookId: bigint;
    try {
      bookId = BigInt(id);
    } catch {
      return narrationError("invalid_request", "Book id must be numeric", 400);
    }

    const tracks = await prisma.user_narration_track.findMany({
      where: { userId: auth.user.id, book_id: bookId },
      include: { pages: { include: { page: { select: { page_number: true } } } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ tracks: tracks.map(serializeTrack) });
  } catch (error) {
    console.error("[narration] book narrations failed:", error);
    return narrationError("internal_error", "Failed to load narrations for this book", 500);
  }
}

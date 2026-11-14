import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** A reader without an account gets one like per page, so each request adds one. */
const MAX_LIKES_PER_REQUEST = 1;

function positiveInt(value: unknown, max: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).trim();
  if (!/^\d{1,9}$/.test(text)) return null;
  const parsed = Number(text);
  return parsed >= 1 && parsed <= max ? parsed : null;
}

function invalidRequest(field: string) {
  return NextResponse.json(
    { error: { code: "invalid_request", message: `${field} is invalid`, details: { field } } },
    { status: 400 }
  );
}

/**
 * Counts page likes from readers who have not signed up.
 *
 * Public on purpose: there is no account to authenticate. To keep that safe it
 * accepts three numbers and nothing else, stores no identifier of any kind
 * (these readers have no parent consent), and only counts pages of published
 * books, so the table cannot grow past books x pages x days.
 *
 * ponytail: no rate limit, so someone could inflate guest counts by replaying
 * requests. Guest likes are reported separately from signed-in likes for that
 * reason. Add a per-IP limiter at the edge if the numbers start to look off.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("body");
  }
  const input = (body ?? {}) as Record<string, unknown>;

  const bookId = positiveInt(input.bookId, 999_999_999);
  if (bookId == null) return invalidRequest("bookId");
  const pageNumber = positiveInt(input.pageNumber, 100_000);
  if (pageNumber == null) return invalidRequest("pageNumber");
  const likes = positiveInt(input.likes, 1_000_000);
  if (likes == null) return invalidRequest("likes");

  try {
    // The day comes from the server clock; a client date is never trusted.
    const counted = await prisma.$executeRaw`
      INSERT INTO guest_page_likes (book_id, page_number, day, likes, bursts)
      SELECT p.book_id, p.page_number, (now() AT TIME ZONE 'utc')::date,
             ${Math.min(likes, MAX_LIKES_PER_REQUEST)}, 1
      FROM pages p
      JOIN books b ON b.id = p.book_id
      WHERE p.book_id = ${BigInt(bookId)}
        AND p.page_number = ${pageNumber}
        AND b.is_published = true
      LIMIT 1
      ON CONFLICT (book_id, page_number, day)
      DO UPDATE SET likes = guest_page_likes.likes + EXCLUDED.likes,
                    bursts = guest_page_likes.bursts + 1
    `;
    if (counted === 0) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No such published page" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to count guest likes:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to count guest likes" } },
      { status: 500 }
    );
  }
}

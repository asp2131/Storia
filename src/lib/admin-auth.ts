import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Roles allowed into the /admin surface. Authors see only their own books. */
export const STUDIO_ROLES = ["admin", "author"] as const;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AdminAuthResult {
  user: AdminUser;
}

/**
 * Verify the current request comes from a signed-in user holding one of
 * `allowed` roles.
 *
 * Usage in a route handler:
 *   const authResult = await requireRole(["admin"]);
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { user } = authResult;
 *
 * Uses Better Auth (NOT NextAuth). Reads session from cookies
 * via the Better Auth `api.getSession()` method.
 */
export async function requireRole(
  allowed: readonly string[]
): Promise<AdminAuthResult | NextResponse> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Better Auth's additionalFields (role) are present at runtime
    // but not reflected in the default session type.
    const user = session.user as typeof session.user & { role?: string };
    const role = user.role ?? "user";

    if (!allowed.includes(role)) {
      return NextResponse.json(
        { error: "You do not have access to this resource." },
        { status: 403 }
      );
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
    };
  } catch (error) {
    console.error("[admin-auth] Session verification failed:", error);
    return NextResponse.json(
      { error: "Authentication failed." },
      { status: 401 }
    );
  }
}

/** Admin-only. Reports, soundscapes, invites, publishing. */
export function requireAdmin(): Promise<AdminAuthResult | NextResponse> {
  return requireRole(["admin"]);
}

/** Admin or author. The shared book-editing surface. */
export function requireStudio(): Promise<AdminAuthResult | NextResponse> {
  return requireRole(STUDIO_ROLES);
}

export interface BookAccessResult extends AdminAuthResult {
  /** True when the caller owns the book but is not an admin. */
  isOwner: boolean;
}

/**
 * Gate a single book. Admins reach every book; an author reaches only books
 * they own. A book an author doesn't own answers 404, not 403, so the editor
 * can't be used to enumerate the rest of the library.
 *
 * Admins short-circuit before the id is parsed, so routes keep their own
 * validation errors for a malformed id instead of every one becoming a 404.
 */
export async function requireBookAccess(
  rawBookId: string
): Promise<BookAccessResult | NextResponse> {
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  if (user.role === "admin") {
    return { user, isOwner: false };
  }

  let bookId: bigint;
  try {
    bookId = BigInt(rawBookId);
  } catch {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  const book = await prisma.books.findUnique({
    where: { id: bookId },
    select: { owner_id: true },
  });

  if (!book || book.owner_id !== user.id) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  return { user, isOwner: true };
}

/**
 * Ownership check for routes that learn the book id only after parsing their
 * body. Returns null when the caller may touch the book, or the response to
 * send back when they may not.
 */
export async function assertBookAccess(
  user: AdminUser,
  rawBookId: string | number | bigint | null | undefined
): Promise<NextResponse | null> {
  if (user.role === "admin") return null;

  if (rawBookId === null || rawBookId === undefined || rawBookId === "") {
    // Authors must always say which of their books they're acting on.
    return NextResponse.json({ error: "bookId is required." }, { status: 400 });
  }

  let bookId: bigint;
  try {
    bookId = BigInt(rawBookId);
  } catch {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  const book = await prisma.books.findUnique({
    where: { id: bookId },
    select: { owner_id: true },
  });

  if (!book || book.owner_id !== user.id) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  return null;
}

/** Same as assertBookAccess, but starting from a page id. */
export async function assertPageAccess(
  user: AdminUser,
  rawPageId: string | number | bigint | null | undefined
): Promise<NextResponse | null> {
  if (user.role === "admin") return null;

  if (rawPageId === null || rawPageId === undefined || rawPageId === "") {
    return NextResponse.json({ error: "pageId is required." }, { status: 400 });
  }

  let pageId: bigint;
  try {
    pageId = BigInt(rawPageId);
  } catch {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }

  const page = await prisma.pages.findUnique({
    where: { id: pageId },
    select: { books: { select: { owner_id: true } } },
  });

  if (!page || page.books.owner_id !== user.id) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }

  return null;
}

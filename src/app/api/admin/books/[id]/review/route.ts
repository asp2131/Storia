import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireBookAccess } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

const AUTHOR_ACTIONS = ["submit", "withdraw"] as const;
const ADMIN_ACTIONS = ["approve", "reject", "unpublish"] as const;

/**
 * The review workflow. Authors move their own book draft <-> submitted;
 * only an admin can approve (which is the only thing that sets is_published),
 * reject, or pull a live book back down.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let action: string;
  let note: string | null = null;
  try {
    const body = await request.json();
    action = String(body?.action ?? "");
    note = body?.note ? String(body.note).slice(0, 2000) : null;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const isAdminAction = (ADMIN_ACTIONS as readonly string[]).includes(action);
  const isAuthorAction = (AUTHOR_ACTIONS as readonly string[]).includes(action);
  if (!isAdminAction && !isAuthorAction) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  // Admin actions never fall through to the ownership check — an admin
  // reviews books they don't own, by definition.
  const access = isAdminAction
    ? await requireAdmin()
    : await requireBookAccess(id);
  if (access instanceof NextResponse) return access;

  let bookId: bigint;
  try {
    bookId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  try {
    const book = await prisma.books.findUnique({
      where: { id: bookId },
      select: {
        title: true,
        author: true,
        review_status: true,
        total_pages: true,
      },
    });
    if (!book) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const now = new Date();
    let data: Record<string, unknown>;

    switch (action) {
      case "submit": {
        if (book.review_status === "submitted") {
          return NextResponse.json(
            { error: "This book is already in review." },
            { status: 409 }
          );
        }
        const problems = submissionProblems(book);
        if (problems.length > 0) {
          return NextResponse.json(
            { error: "This book isn't ready to submit.", problems },
            { status: 400 }
          );
        }
        data = {
          review_status: "submitted",
          submitted_at: now,
          review_note: null,
          updated_at: now,
        };
        break;
      }
      case "withdraw": {
        if (book.review_status !== "submitted") {
          return NextResponse.json(
            { error: "Only a submitted book can be withdrawn." },
            { status: 409 }
          );
        }
        data = { review_status: "draft", submitted_at: null, updated_at: now };
        break;
      }
      case "approve": {
        data = {
          review_status: "approved",
          is_published: true,
          review_note: null,
          reviewed_at: now,
          updated_at: now,
        };
        break;
      }
      case "reject": {
        if (!note) {
          return NextResponse.json(
            { error: "A reason is required when rejecting a book." },
            { status: 400 }
          );
        }
        data = {
          review_status: "rejected",
          is_published: false,
          review_note: note,
          reviewed_at: now,
          updated_at: now,
        };
        break;
      }
      case "unpublish": {
        data = {
          is_published: false,
          review_status: "rejected",
          review_note: note,
          reviewed_at: now,
          updated_at: now,
        };
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const updated = await prisma.books.update({ where: { id: bookId }, data });

    return NextResponse.json({
      book: {
        id: updated.id.toString(),
        reviewStatus: updated.review_status,
        reviewNote: updated.review_note,
        isPublished: updated.is_published,
        submittedAt: updated.submitted_at?.toISOString() ?? null,
        reviewedAt: updated.reviewed_at?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[book review] Failed:", error);
    return NextResponse.json(
      { error: "Failed to update review status." },
      { status: 500 }
    );
  }
}

/** Cheap completeness gate so reviewers don't get empty placeholder drafts. */
export function submissionProblems(book: {
  title: string;
  author: string;
  total_pages: number | null;
}): string[] {
  const problems: string[] = [];
  if (!book.title.trim() || book.title.trim() === "Untitled Book") {
    problems.push("Give the book a title.");
  }
  if (!book.author.trim() || book.author.trim() === "Unknown") {
    problems.push("Set the author name.");
  }
  if (!book.total_pages || book.total_pages < 1) {
    problems.push("Add at least one page.");
  }
  return problems;
}

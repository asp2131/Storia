import { NextRequest, NextResponse } from "next/server";
import { requireBookAccess } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isArtworkProvenance } from "@/lib/artwork-provenance";
import {
  coerceBookTextStyle,
  validateBookTextStyle,
} from "@/types/text-overlay";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const access = await requireBookAccess((await params).id);
  if (access instanceof NextResponse) return access;

  try {
    const { id } = await params;
    const bookId = BigInt(id);

    const book = await prisma.books.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    return NextResponse.json({
      book: {
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        artworkProvenance: book.artwork_provenance,
        processingStatus: book.processing_status,
        updatedAt: book.updated_at?.toISOString?.() ?? null,
        coverUrl: book.cover_url,
        description: book.description,
        isPublished: book.is_published,
        ownerId: book.owner_id,
        reviewStatus: book.review_status,
        reviewNote: book.review_note,
        submittedAt: book.submitted_at?.toISOString() ?? null,
        defaultTextStyle: coerceBookTextStyle(book.default_text_style),
      },
    });
  } catch (error) {
    console.error("[admin books] Failed to fetch:", error);
    return NextResponse.json(
      { error: "Failed to fetch book." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const access = await requireBookAccess((await params).id);
  if (access instanceof NextResponse) return access;

  try {
    const body = await request.json();
    const now = new Date();

    const { id } = await params;
    const bookId = BigInt(id);

    const data: Record<string, unknown> = { updated_at: now };
    if ("artworkProvenance" in body) {
      if (access.user.role !== "admin") {
        return NextResponse.json(
          { error: "Only administrators can set artwork provenance." },
          { status: 403 }
        );
      }
      if (!isArtworkProvenance(body.artworkProvenance)) {
        return NextResponse.json(
          { error: "Invalid artworkProvenance." },
          { status: 400 }
        );
      }
      data.artwork_provenance = body.artworkProvenance;
    }
    if ("title" in body) data.title = body.title;
    if ("author" in body) data.author = body.author;
    if ("coverUrl" in body) data.cover_url = body.coverUrl || null;
    if ("description" in body) data.description = body.description || null;
    // Publishing is a review decision, not a book edit — only an admin can
    // flip it, and only through /review. See requireAdmin there.
    if ("isPublished" in body && access.user.role === "admin") {
      data.is_published = Boolean(body.isPublished);
    }
    if ("processingStatus" in body) data.processing_status = body.processingStatus || "pending";
    if ("defaultTextStyle" in body) {
      try {
        data.default_text_style = validateBookTextStyle(
          body.defaultTextStyle
        ) as unknown as Prisma.InputJsonValue;
      } catch (validationError) {
        return NextResponse.json(
          {
            error: "Invalid defaultTextStyle",
            details:
              validationError instanceof Error
                ? validationError.message
                : "Unknown validation error",
          },
          { status: 400 }
        );
      }
    }

    // An author editing an already-approved book puts it back in the queue so
    // nothing changes under the library's feet after review.
    if (access.isOwner) {
      const current = await prisma.books.findUnique({
        where: { id: bookId },
        select: { review_status: true },
      });
      if (current?.review_status === "approved") {
        data.review_status = "submitted";
        data.submitted_at = now;
      }
    }

    const book = await prisma.books.update({
      where: { id: bookId },
      data,
    });

    return NextResponse.json({
      book: {
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        artworkProvenance: book.artwork_provenance,
        processingStatus: book.processing_status,
        updatedAt: book.updated_at?.toISOString?.() ?? null,
        coverUrl: book.cover_url,
        description: book.description,
        isPublished: book.is_published,
        ownerId: book.owner_id,
        reviewStatus: book.review_status,
        reviewNote: book.review_note,
        submittedAt: book.submitted_at?.toISOString() ?? null,
        defaultTextStyle: coerceBookTextStyle(book.default_text_style),
      },
    });
  } catch (error) {
    console.error("[admin books] Failed to update:", error);
    return NextResponse.json(
      { error: "Failed to update book." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const access = await requireBookAccess((await params).id);
  if (access instanceof NextResponse) return access;

  try {
    const { id } = await params;
    const bookId = BigInt(id);

    if (access.isOwner) {
      const current = await prisma.books.findUnique({
        where: { id: bookId },
        select: { is_published: true },
      });
      if (current?.is_published) {
        return NextResponse.json(
          {
            error:
              "This book is live in the library. Ask an admin to unpublish it first.",
          },
          { status: 409 }
        );
      }
    }

    await prisma.books.delete({ where: { id: bookId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin books] Failed to delete:", error);
    return NextResponse.json(
      { error: "Failed to delete book." },
      { status: 500 }
    );
  }
}

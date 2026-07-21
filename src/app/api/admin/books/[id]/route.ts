import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
        processingStatus: book.processing_status,
        updatedAt: book.updated_at?.toISOString?.() ?? null,
        coverUrl: book.cover_url,
        description: book.description,
        isPublished: book.is_published,
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
  try {
    const body = await request.json();
    const now = new Date();

    const { id } = await params;
    const bookId = BigInt(id);

    const data: Record<string, unknown> = { updated_at: now };
    if ("title" in body) data.title = body.title;
    if ("author" in body) data.author = body.author;
    if ("coverUrl" in body) data.cover_url = body.coverUrl || null;
    if ("description" in body) data.description = body.description || null;
    if ("isPublished" in body) data.is_published = Boolean(body.isPublished);
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

    const book = await prisma.books.update({
      where: { id: bookId },
      data,
    });

    return NextResponse.json({
      book: {
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        processingStatus: book.processing_status,
        updatedAt: book.updated_at?.toISOString?.() ?? null,
        coverUrl: book.cover_url,
        description: book.description,
        isPublished: book.is_published,
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
  try {
    const { id } = await params;
    const bookId = BigInt(id);
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

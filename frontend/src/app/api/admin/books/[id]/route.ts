import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json();
    const now = new Date();

    const { id } = await params;
    const bookId = BigInt(id);
    const book = await prisma.books.update({
      where: { id: bookId },
      data: {
        title: body.title,
        author: body.author,
        cover_url: body.coverUrl || null,
        description: body.description || null,
        is_published: Boolean(body.isPublished),
        processing_status: body.processingStatus || "pending",
        updated_at: now,
      },
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

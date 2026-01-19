import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const pages = await prisma.pages.findMany({
      where: { book_id: bookId },
      orderBy: { page_number: "asc" },
      include: {
        page_audio_assignments: true,
      },
    });

    return NextResponse.json({
      book: {
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        description: book.description,
      },
      pages: pages.map((page) => ({
        id: page.id.toString(),
        pageNumber: page.page_number,
        textContent: page.text_content,
        imageUrl: page.image_url,
        narrationUrl: page.narration_url,
        narrationTimestamps: page.narration_timestamps,
        assignments: page.page_audio_assignments.map((assignment) => ({
          id: assignment.id.toString(),
          audioUrl: assignment.audio_url,
          audioType: assignment.audio_type,
          scope: assignment.scope,
          rangeStart: assignment.range_start,
          rangeEnd: assignment.range_end,
          volume: assignment.volume,
        })),
      })),
    });
  } catch (error) {
    console.error("[reader] Failed to load:", error);
    return NextResponse.json(
      { error: "Failed to load reader data." },
      { status: 500 }
    );
  }
}

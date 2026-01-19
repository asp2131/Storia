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

    // Get all audio assignments for this book (including range-based ones)
    const allAssignments = await prisma.page_audio_assignments.findMany({
      where: {
        pages: {
          book_id: bookId,
        },
      },
      include: {
        pages: {
          select: {
            page_number: true,
          },
        },
      },
    });

    // Helper function to get assignments applicable to a specific page number
    const getAssignmentsForPage = (pageNumber: number) => {
      return allAssignments.filter((assignment) => {
        // Direct assignment (scope is "single" or assignment is on this page)
        if (assignment.scope === "single" && assignment.pages.page_number === pageNumber) {
          return true;
        }
        // Range assignment - check if pageNumber falls within the range
        if (assignment.scope === "range") {
          const start = assignment.range_start ?? assignment.pages.page_number;
          const end = assignment.range_end ?? assignment.pages.page_number;
          return pageNumber >= start && pageNumber <= end;
        }
        // Fallback: direct page assignment
        return assignment.pages.page_number === pageNumber;
      });
    };

    return NextResponse.json({
      book: {
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        description: book.description,
      },
      pages: pages.map((page) => {
        const applicableAssignments = getAssignmentsForPage(page.page_number);

        return {
          id: page.id.toString(),
          pageNumber: page.page_number,
          textContent: page.text_content,
          imageUrl: page.image_url,
          narrationUrl: page.narration_url,
          narrationTimestamps: page.narration_timestamps,
          assignments: applicableAssignments.map((assignment) => ({
            id: assignment.id.toString(),
            audioUrl: assignment.audio_url,
            audioType: assignment.audio_type,
            scope: assignment.scope,
            rangeStart: assignment.range_start,
            rangeEnd: assignment.range_end,
            volume: assignment.volume,
          })),
        };
      }),
    });
  } catch (error) {
    console.error("[reader] Failed to load:", error);
    return NextResponse.json(
      { error: "Failed to load reader data." },
      { status: 500 }
    );
  }
}

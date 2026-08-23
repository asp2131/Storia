import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TextOverlayConfig } from "@/types/text-overlay";

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

    const overlayNarrationRows = await prisma.$queryRaw<Array<{
      id: bigint;
      page_id: bigint;
      overlay_element_id: string;
      voice_id: string;
      voice_name: string | null;
      audio_url: string;
      sort_order: number;
      word_timestamps: unknown;
      inserted_at: Date;
    }>>`
      SELECT
        por.id,
        por.page_id,
        por.overlay_element_id,
        por.voice_id,
        por.voice_name,
        por.audio_url,
        por.sort_order,
        por.word_timestamps,
        por.inserted_at
      FROM page_overlay_narrations por
      JOIN pages p ON p.id = por.page_id
      WHERE p.book_id = ${bookId}
      ORDER BY por.page_id ASC, por.sort_order ASC, por.inserted_at ASC
    `;

    const overlayNarrationsByPageId = new Map<string, Array<{
      id: string;
      overlayElementId: string;
      voiceId: string;
      voiceName: string | null;
      audioUrl: string;
      sortOrder: number;
      wordTimestamps: unknown;
    }>>();

    for (const row of overlayNarrationRows) {
      const key = row.page_id.toString();
      const current = overlayNarrationsByPageId.get(key) || [];
      current.push({
        id: row.id.toString(),
        overlayElementId: row.overlay_element_id,
        voiceId: row.voice_id,
        voiceName: row.voice_name,
        audioUrl: row.audio_url,
        sortOrder: row.sort_order,
        wordTimestamps: row.word_timestamps,
      });
      overlayNarrationsByPageId.set(key, current);
    }

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
      return allAssignments
        .filter((assignment) => {
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
        })
        .sort((a, b) => Number(b.scope === "single") - Number(a.scope === "single"));
    };

    const bookIdStr = book.id.toString();
    const hasPronunciations = pages.some((p) => {
      if (!p.word_pronunciations) return false;
      const map = p.word_pronunciations as Record<string, unknown>;
      return Object.keys(map).length > 0;
    });
    const pronunciationManifestUrl = hasPronunciations
      ? `/api/books/${bookIdStr}/pronunciations`
      : null;

    return NextResponse.json({
      book: {
        id: bookIdStr,
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        description: book.description,
        hasPronunciations,
        pronunciationManifestUrl,
      },
      pages: pages.map((page) => {
        const applicableAssignments = getAssignmentsForPage(page.page_number);

        return {
          id: page.id.toString(),
          pageNumber: page.page_number,
          textContent: page.text_content,
          imageUrl: page.image_url,
          compositedImageUrl: page.composited_image_url,
          overlay: page.text_overlay as TextOverlayConfig | null,
          narrationUrl: page.narration_url,
          narrationTimestamps: page.narration_timestamps,
          wordPronunciations: page.word_pronunciations,
          assignments: applicableAssignments.map((assignment) => ({
            id: assignment.id.toString(),
            audioUrl: assignment.audio_url,
            audioType: assignment.audio_type,
            scope: assignment.scope,
            rangeStart: assignment.range_start,
            rangeEnd: assignment.range_end,
            volume: assignment.volume,
          })),
          overlayNarrations: overlayNarrationsByPageId.get(page.id.toString()) || [],
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

import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

function computeStatus(currentPage: number, completedAt: Date | null): string {
  if (completedAt) return "completed";
  if (currentPage > 1) return "in_progress";
  return "new";
}

export async function GET(request: NextRequest) {
  const childProfileId = request.nextUrl.searchParams.get("childProfileId");
  if (!childProfileId) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "childProfileId is required", details: { field: "childProfileId" } } },
      { status: 400 }
    );
  }

  try {
    const result = await validateChildAccess(childProfileId);
    if ("error" in result) return result.error;

    const progress = await prisma.child_book_progress.findFirst({
      where: {
        childProfileId,
        completedAt: null,
        currentPage: { gt: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!progress) {
      return NextResponse.json({ continueReading: null });
    }

    const book = await prisma.books.findUnique({
      where: { id: progress.bookId },
      include: {
        pages: {
          where: { narration_url: { not: null } },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ continueReading: null });
    }

    return NextResponse.json({
      continueReading: {
        book: {
          id: book.id.toString(),
          title: book.title,
          author: book.author,
          coverUrl: book.cover_url,
          totalPages: book.total_pages,
          hasNarration: book.pages.length > 0,
        },
        progress: {
          childProfileId: progress.childProfileId,
          bookId: progress.bookId.toString(),
          currentPage: progress.currentPage,
          totalPages: progress.totalPages,
          progressPercent: progress.totalPages > 0
            ? Math.round((progress.currentPage / progress.totalPages) * 100)
            : 0,
          lastReadAt: progress.lastReadAt.toISOString(),
          completedAt: progress.completedAt ? progress.completedAt.toISOString() : null,
          completionCount: progress.completionCount,
          lastSessionId: progress.lastSessionId,
          status: computeStatus(progress.currentPage, progress.completedAt),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching continue reading:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to fetch continue reading data" } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

function computeStatus(currentPage: number, completedAt: Date | null): string {
  if (completedAt) return "completed";
  if (currentPage > 1) return "in_progress";
  return "new";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const genre = searchParams.get("genre") || "";
  const sort = searchParams.get("sort") || "recent";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "10");
  const userId = searchParams.get("userId");
  const childProfileId = searchParams.get("childProfileId");

  const skip = (page - 1) * perPage;

  // Build where clause
  const where: Record<string, unknown> = {
    is_published: true,
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { author: { contains: search, mode: "insensitive" } },
    ];
  }

  if (genre) {
    where.metadata = {
      path: ["genre"],
      equals: genre,
    };
  }

  // Build orderBy
  let orderBy: Record<string, string> = {};
  switch (sort) {
    case "title_asc":
      orderBy = { title: "asc" };
      break;
    case "title_desc":
      orderBy = { title: "desc" };
      break;
    case "author_asc":
      orderBy = { author: "asc" };
      break;
    case "recent":
    default:
      orderBy = { inserted_at: "desc" };
      break;
  }

  try {
    // Validate child access if childProfileId is provided
    if (childProfileId) {
      const result = await validateChildAccess(childProfileId);
      if ("error" in result) return result.error;
    }

    const [books, total] = await Promise.all([
      prisma.books.findMany({
        where,
        orderBy,
        skip,
        take: perPage,
        include: {
          scenes: {
            include: {
              soundscapes: {
                where: { admin_approved: true },
                take: 1,
              },
            },
          },
          pages: {
            select: {
              narration_url: true,
              word_pronunciations: true,
            },
          },
        },
      }),
      prisma.books.count({ where }),
    ]);

    // Fetch book_question counts for all returned books
    const bookIds = books.map((book) => book.id);

    const questionCountsRaw = bookIds.length > 0
      ? await prisma.book_question.groupBy({
          by: ["bookId"],
          where: { bookId: { in: bookIds } },
          _count: { id: true },
        })
      : [];

    const questionCountMap = new Map<string, number>();
    questionCountsRaw.forEach((entry) => {
      questionCountMap.set(entry.bookId.toString(), entry._count.id);
    });

    // Fetch child book progress if childProfileId is provided
    const childProgressMap: Map<string, {
      childProfileId: string;
      bookId: string;
      currentPage: number;
      totalPages: number;
      progressPercent: number;
      lastReadAt: Date;
      completedAt: Date | null;
      completionCount: number;
      lastSessionId: string | null;
      status: string;
    }> = new Map();

    if (childProfileId && bookIds.length > 0) {
      try {
        const progressRecords = await prisma.child_book_progress.findMany({
          where: {
            childProfileId,
            bookId: { in: bookIds },
          },
        });
        progressRecords.forEach((record) => {
          const progressPercent = record.totalPages > 0
            ? Math.round((record.currentPage / record.totalPages) * 100)
            : 0;
          childProgressMap.set(record.bookId.toString(), {
            childProfileId: record.childProfileId,
            bookId: record.bookId.toString(),
            currentPage: record.currentPage,
            totalPages: record.totalPages,
            progressPercent,
            lastReadAt: record.lastReadAt,
            completedAt: record.completedAt,
            completionCount: record.completionCount,
            lastSessionId: record.lastSessionId,
            status: computeStatus(record.currentPage, record.completedAt),
          });
        });
      } catch (progressError) {
        console.error("Error fetching child book progress:", progressError);
      }
    }

    // Fetch user reading progress if userId is provided (legacy)
    const userProgressMap: Map<string, { currentPage: number; totalPages: number; lastReadAt: Date }> = new Map();
    if (userId && !childProfileId && bookIds.length > 0) {
      try {
        const progressRecords = await prisma.user_reading_progress.findMany({
          where: {
            userId: userId,
            bookId: { in: bookIds },
          },
          select: {
            bookId: true,
            currentPage: true,
            totalPages: true,
            lastReadAt: true,
          },
        });
        progressRecords.forEach((record) => {
          userProgressMap.set(record.bookId.toString(), {
            currentPage: record.currentPage,
            totalPages: record.totalPages,
            lastReadAt: record.lastReadAt,
          });
        });
      } catch (progressError) {
        console.error("Error fetching reading progress:", progressError);
      }
    }

    // Transform books
    const transformedBooks = books.map((book) => {
      const bookIdStr = book.id.toString();
      const hasNarration = book.pages.some((p) => p.narration_url != null);
      const hasQuestions = (questionCountMap.get(bookIdStr) || 0) > 0;
      const hasPronunciations = book.pages.some((p) => {
        if (!p.word_pronunciations) return false;
        const map = p.word_pronunciations as Record<string, unknown>;
        return Object.keys(map).length > 0;
      });
      const pronunciationManifestUrl = hasPronunciations
        ? `/api/books/${bookIdStr}/pronunciations`
        : null;

      const baseBook = {
        id: bookIdStr,
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        description: book.description,
        totalPages: book.total_pages,
        metadata: book.metadata,
        hasSoundscape: book.scenes.some((scene) => scene.soundscapes.length > 0),
        hasNarration,
        hasQuestions,
        hasPronunciations,
        pronunciationManifestUrl,
      };

      // Child-aware progress
      if (childProfileId) {
        const cp = childProgressMap.get(bookIdStr);
        return {
          ...baseBook,
          progress: cp
            ? {
                childProfileId: cp.childProfileId,
                bookId: cp.bookId,
                currentPage: cp.currentPage,
                totalPages: cp.totalPages,
                progressPercent: cp.progressPercent,
                lastReadAt: cp.lastReadAt.toISOString(),
                completedAt: cp.completedAt ? cp.completedAt.toISOString() : null,
                completionCount: cp.completionCount,
                lastSessionId: cp.lastSessionId,
                status: cp.status,
              }
            : null,
        };
      }

      // Legacy user-based progress
      if (userId) {
        const progress = userProgressMap.get(bookIdStr);
        return {
          ...baseBook,
          currentPage: progress ? progress.currentPage : null,
          progressPercent: progress && progress.totalPages > 0
            ? Math.round((progress.currentPage / progress.totalPages) * 100)
            : null,
          lastReadAt: progress ? progress.lastReadAt.toISOString() : null,
        };
      }

      return baseBook;
    });

    return NextResponse.json({
      books: transformedBooks,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to fetch books", details: error instanceof Error ? error.message : "Unknown error" } },
      { status: 500 }
    );
  }
}

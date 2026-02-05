import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const genre = searchParams.get("genre") || "";
  const sort = searchParams.get("sort") || "recent";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "10");
  const userId = searchParams.get("userId");

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
        },
      }),
      prisma.books.count({ where }),
    ]);

    // Fetch user reading progress if userId is provided
    let progressMap: Map<string, { currentPage: number; totalPages: number; lastReadAt: Date }> = new Map();
    if (userId) {
      const bookIds = books.map((book) => book.id);
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
        progressMap.set(record.bookId.toString(), {
          currentPage: record.currentPage,
          totalPages: record.totalPages,
          lastReadAt: record.lastReadAt,
        });
      });
    }

    // Transform books to include hasSoundscape flag and progress data
    const transformedBooks = books.map((book) => {
      const bookIdStr = book.id.toString();
      const progress = userId ? progressMap.get(bookIdStr) : undefined;

      const baseBook = {
        id: bookIdStr,
        title: book.title,
        author: book.author,
        coverUrl: book.cover_url,
        description: book.description,
        totalPages: book.total_pages,
        metadata: book.metadata,
        hasSoundscape: book.scenes.some((scene) => scene.soundscapes.length > 0),
      };

      // Only add progress fields when userId is provided
      if (userId) {
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
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { bookId, currentPage } = body;

    // Validate input
    if (!bookId || typeof currentPage !== "number") {
      return NextResponse.json(
        { error: "Invalid request. bookId and currentPage are required." },
        { status: 400 }
      );
    }

    if (currentPage < 1) {
      return NextResponse.json(
        { error: "Invalid page number. Must be greater than 0." },
        { status: 400 }
      );
    }

    // Verify book exists and belongs to user
    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { id: true, userId: true, totalPages: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    if (book.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update progress for this book" },
        { status: 403 }
      );
    }

    if (currentPage > book.totalPages) {
      return NextResponse.json(
        { error: `Invalid page number. Book has ${book.totalPages} pages.` },
        { status: 400 }
      );
    }

    // Upsert reading progress
    const progress = await db.readingProgress.upsert({
      where: {
        userId_bookId: {
          userId: session.user.id,
          bookId: bookId,
        },
      },
      update: {
        currentPage: currentPage,
      },
      create: {
        userId: session.user.id,
        bookId: bookId,
        currentPage: currentPage,
      },
    });

    return NextResponse.json({
      success: true,
      progress: {
        bookId: progress.bookId,
        currentPage: progress.currentPage,
        updatedAt: progress.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error saving reading progress:", error);
    return NextResponse.json(
      { error: "Failed to save reading progress" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get bookId from query params
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("bookId");

    if (!bookId) {
      return NextResponse.json(
        { error: "bookId query parameter is required" },
        { status: 400 }
      );
    }

    // Get reading progress
    const progress = await db.readingProgress.findUnique({
      where: {
        userId_bookId: {
          userId: session.user.id,
          bookId: bookId,
        },
      },
    });

    if (!progress) {
      return NextResponse.json({
        success: true,
        progress: null,
      });
    }

    return NextResponse.json({
      success: true,
      progress: {
        bookId: progress.bookId,
        currentPage: progress.currentPage,
        updatedAt: progress.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching reading progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch reading progress" },
      { status: 500 }
    );
  }
}

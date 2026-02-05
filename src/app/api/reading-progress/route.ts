import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bookId = searchParams.get("bookId");

  if (!bookId) {
    return NextResponse.json(
      { error: "bookId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });

    // Graceful handling for anonymous users
    if (!session?.user?.id) {
      return NextResponse.json(null);
    }

    const progress = await prisma.user_reading_progress.findUnique({
      where: {
        userId_bookId: {
          userId: session.user.id,
          bookId: BigInt(bookId),
        },
      },
    });

    if (!progress) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
      lastReadAt: progress.lastReadAt.toISOString(),
      progressPercent: Math.round((progress.currentPage / progress.totalPages) * 100),
    });
  } catch (error) {
    console.error("Error fetching reading progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch reading progress" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    // Authentication required for saving progress
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookId, currentPage, totalPages } = body;

    // Validate required fields
    if (!bookId) {
      return NextResponse.json(
        { error: "bookId is required" },
        { status: 400 }
      );
    }

    if (typeof currentPage !== "number" || currentPage < 1) {
      return NextResponse.json(
        { error: "currentPage must be a positive number" },
        { status: 400 }
      );
    }

    if (typeof totalPages !== "number" || totalPages < 1) {
      return NextResponse.json(
        { error: "totalPages must be a positive number" },
        { status: 400 }
      );
    }

    const now = new Date();

    const progress = await prisma.user_reading_progress.upsert({
      where: {
        userId_bookId: {
          userId: session.user.id,
          bookId: BigInt(bookId),
        },
      },
      update: {
        currentPage,
        totalPages,
        lastReadAt: now,
      },
      create: {
        userId: session.user.id,
        bookId: BigInt(bookId),
        currentPage,
        totalPages,
        lastReadAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      progress: {
        currentPage: progress.currentPage,
        totalPages: progress.totalPages,
        lastReadAt: progress.lastReadAt.toISOString(),
        progressPercent: Math.round((progress.currentPage / progress.totalPages) * 100),
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

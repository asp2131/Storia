import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateChildAccess } from "@/lib/child-auth";
import { prisma } from "@/lib/prisma";

function computeStatus(currentPage: number, completedAt: Date | null): string {
  if (completedAt) return "completed";
  if (currentPage > 1) return "in_progress";
  return "new";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get("bookId");
    const childProfileId = searchParams.get("childProfileId");

    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required" } },
        { status: 400 }
      );
    }

    // Child-aware flow
    if (childProfileId) {
      const result = await validateChildAccess(childProfileId);
      if ("error" in result) return result.error;

      const progress = await prisma.child_book_progress.findUnique({
        where: {
          childProfileId_bookId: {
            childProfileId,
            bookId: BigInt(bookId),
          },
        },
      });

      if (!progress) {
        return NextResponse.json({ progress: null });
      }

      return NextResponse.json({
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
      });
    }

    // Legacy user-based flow (backward compat for web clients)
    const session = await auth.api.getSession({ headers: await headers() });

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
      { error: { code: "internal_error", message: "Failed to fetch reading progress" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childProfileId, bookId, currentPage, totalPages, lastSessionId, completed, source } = body;

    // Child-aware flow
    if (childProfileId) {
      const result = await validateChildAccess(childProfileId);
      if ("error" in result) return result.error;

      if (!bookId) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "bookId is required" } },
          { status: 400 }
        );
      }
      if (typeof currentPage !== "number" || currentPage < 1) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "currentPage must be >= 1" } },
          { status: 400 }
        );
      }
      if (typeof totalPages !== "number" || totalPages < 1) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "totalPages must be >= 1" } },
          { status: 400 }
        );
      }

      const now = new Date();
      const bigBookId = BigInt(bookId);

      // Check existing progress for completion logic
      const existing = await prisma.child_book_progress.findUnique({
        where: {
          childProfileId_bookId: {
            childProfileId,
            bookId: bigBookId,
          },
        },
      });

      const updateData: Record<string, unknown> = {
        currentPage,
        totalPages,
        lastReadAt: now,
        lastSessionId: lastSessionId || undefined,
      };

      // Handle completion
      if (completed) {
        if (!existing?.completedAt) {
          updateData.completedAt = now;
        }
        updateData.completionCount = (existing?.completionCount || 0) + (existing?.completedAt ? 0 : 1);
      }

      const progress = await prisma.child_book_progress.upsert({
        where: {
          childProfileId_bookId: {
            childProfileId,
            bookId: bigBookId,
          },
        },
        update: updateData,
        create: {
          childProfileId,
          bookId: bigBookId,
          currentPage,
          totalPages,
          lastReadAt: now,
          completedAt: completed ? now : null,
          completionCount: completed ? 1 : 0,
          lastSessionId: lastSessionId || null,
        },
      });

      return NextResponse.json({
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
      });
    }

    // Legacy user-based flow (backward compat for web clients)
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 }
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required" } },
        { status: 400 }
      );
    }
    if (typeof currentPage !== "number" || currentPage < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "currentPage must be a positive number" } },
        { status: 400 }
      );
    }
    if (typeof totalPages !== "number" || totalPages < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "totalPages must be a positive number" } },
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
      { error: { code: "internal_error", message: "Failed to save reading progress" } },
      { status: 500 }
    );
  }
}

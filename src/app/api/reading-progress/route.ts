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

function parsePositiveBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return null;
  }

  const stringValue = String(value).trim();
  if (!/^\d+$/.test(stringValue)) {
    return null;
  }

  const parsed = BigInt(stringValue);
  return parsed > 0n ? parsed : null;
}

function formatChildProgress(progress: {
  childProfileId: string;
  bookId: bigint;
  currentPage: number;
  totalPages: number;
  lastReadAt: Date;
  completedAt: Date | null;
  completionCount: number;
  lastSessionId: string | null;
}) {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get("bookId");
    const childProfileId = searchParams.get("childProfileId");

    if (childProfileId) {
      const result = await validateChildAccess(childProfileId);
      if ("error" in result) return result.error;

      if (!bookId) {
        const progressList = await prisma.child_book_progress.findMany({
          where: { childProfileId },
          orderBy: [{ updatedAt: "desc" }, { lastReadAt: "desc" }],
        });

        return NextResponse.json({
          progressList: progressList.map(formatChildProgress),
        });
      }

      const parsedBookId = parsePositiveBigInt(bookId);
      if (parsedBookId == null) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "bookId must be a positive integer", details: { field: "bookId" } } },
          { status: 400 }
        );
      }

      const progress = await prisma.child_book_progress.findUnique({
        where: {
          childProfileId_bookId: {
            childProfileId,
            bookId: parsedBookId,
          },
        },
      });

      if (!progress) {
        return NextResponse.json({ progress: null });
      }

      return NextResponse.json({ progress: formatChildProgress(progress) });
    }

    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required", details: { field: "bookId" } } },
        { status: 400 }
      );
    }

    const parsedBookId = parsePositiveBigInt(bookId);
    if (parsedBookId == null) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId must be a positive integer", details: { field: "bookId" } } },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json(null);
    }

    const progress = await prisma.user_reading_progress.findUnique({
      where: {
        userId_bookId: {
          userId: session.user.id,
          bookId: parsedBookId,
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
    const { childProfileId, bookId, currentPage, totalPages, lastSessionId, completed } = body;

    if (childProfileId) {
      const result = await validateChildAccess(childProfileId);
      if ("error" in result) return result.error;

      if (!bookId) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "bookId is required", details: { field: "bookId" } } },
          { status: 400 }
        );
      }
      if (typeof currentPage !== "number" || currentPage < 1) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "currentPage must be >= 1", details: { field: "currentPage" } } },
          { status: 400 }
        );
      }
      if (typeof totalPages !== "number" || totalPages < 1) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "totalPages must be >= 1", details: { field: "totalPages" } } },
          { status: 400 }
        );
      }
      if (currentPage > totalPages) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "currentPage must be <= totalPages", details: { field: "currentPage" } } },
          { status: 400 }
        );
      }

      const bigBookId = parsePositiveBigInt(bookId);
      if (bigBookId == null) {
        return NextResponse.json(
          { error: { code: "invalid_request", message: "bookId must be a positive integer", details: { field: "bookId" } } },
          { status: 400 }
        );
      }

      const now = new Date();

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
        lastSessionId: lastSessionId || null,
      };

      if (completed) {
        if (!existing?.completedAt) {
          updateData.completedAt = now;
        }
        updateData.completionCount = (existing?.completionCount || 0) + (existing?.completedAt ? 0 : 1);
      } else if (existing?.completedAt) {
        updateData.completedAt = null;
        updateData.completionCount = existing.completionCount;
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

      return NextResponse.json({ progress: formatChildProgress(progress) });
    }

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 }
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId is required", details: { field: "bookId" } } },
        { status: 400 }
      );
    }
    if (typeof currentPage !== "number" || currentPage < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "currentPage must be a positive number", details: { field: "currentPage" } } },
        { status: 400 }
      );
    }
    if (typeof totalPages !== "number" || totalPages < 1) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "totalPages must be a positive number", details: { field: "totalPages" } } },
        { status: 400 }
      );
    }
    if (currentPage > totalPages) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "currentPage must be <= totalPages", details: { field: "currentPage" } } },
        { status: 400 }
      );
    }

    const parsedBookId = parsePositiveBigInt(bookId);
    if (parsedBookId == null) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "bookId must be a positive integer", details: { field: "bookId" } } },
        { status: 400 }
      );
    }

    const now = new Date();

    const progress = await prisma.user_reading_progress.upsert({
      where: {
        userId_bookId: {
          userId: session.user.id,
          bookId: parsedBookId,
        },
      },
      update: {
        currentPage,
        totalPages,
        lastReadAt: now,
      },
      create: {
        userId: session.user.id,
        bookId: parsedBookId,
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

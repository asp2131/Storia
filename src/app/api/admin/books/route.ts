import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudio } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const reviewStatus = searchParams.get("reviewStatus") || "";

  const where: Record<string, unknown> = {};

  // Authors see only their own shelf; admins see the whole library.
  if (user.role !== "admin") {
    where.owner_id = user.id;
  }

  if (reviewStatus) {
    where.review_status = reviewStatus;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { author: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const books = await prisma.books.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 200,
      include: { owner: { select: { email: true } } },
    });

    const payload = books.map((book) => ({
      id: book.id.toString(),
      title: book.title,
      author: book.author,
      processingStatus: book.processing_status,
      updatedAt: book.updated_at?.toISOString?.() ?? null,
      coverUrl: book.cover_url,
      description: book.description,
      isPublished: book.is_published,
      ownerId: book.owner_id,
      reviewStatus: book.review_status,
      reviewNote: book.review_note,
      submittedAt: book.submitted_at?.toISOString() ?? null,
      ownerEmail: book.owner?.email ?? null,
    }));

    return NextResponse.json({ books: payload });
  } catch (error) {
    console.error("[admin books] Failed to load:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin books." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await request.json();
    const now = new Date();

    if (!body?.title || !body?.author) {
      return NextResponse.json(
        { error: "Title and author are required." },
        { status: 400 }
      );
    }

    const book = await prisma.books.create({
      data: {
        title: body.title,
        author: body.author,
        cover_url: body.coverUrl || null,
        description: body.description || null,
        // Only an admin can create something already live; an author's book
        // reaches the library through /review.
        is_published: user.role === "admin" && Boolean(body.isPublished),
        owner_id: user.role === "admin" ? null : user.id,
        processing_status: body.processingStatus || "pending",
        total_pages: 1,
        inserted_at: now,
        updated_at: now,
        // Auto-create the first page so a new book is immediately editable.
        pages: {
          create: {
            page_number: 1,
            inserted_at: now,
            updated_at: now,
          },
        },
      },
    });

    return NextResponse.json({
      book: {
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        processingStatus: book.processing_status,
        updatedAt: book.updated_at?.toISOString?.() ?? null,
        coverUrl: book.cover_url,
        description: book.description,
        isPublished: book.is_published,
      },
    });
  } catch (error) {
    console.error("[admin books] Failed to create:", error);
    return NextResponse.json(
      { error: "Failed to create book." },
      { status: 500 }
    );
  }
}

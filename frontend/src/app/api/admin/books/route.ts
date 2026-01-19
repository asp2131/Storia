import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};

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
        is_published: Boolean(body.isPublished),
        processing_status: body.processingStatus || "pending",
        inserted_at: now,
        updated_at: now,
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

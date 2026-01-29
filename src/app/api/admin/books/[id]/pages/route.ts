import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const bookId = BigInt(id);

    const pages = await prisma.pages.findMany({
      where: { book_id: bookId },
      orderBy: { page_number: "asc" },
    });

    return NextResponse.json({
      pages: pages.map((page) => ({
        id: page.id.toString(),
        pageNumber: page.page_number,
        textContent: page.text_content,
        imageUrl: page.image_url,
        narrationUrl: page.narration_url,
        narrationTimestamps: page.narration_timestamps,
      })),
    });
  } catch (error) {
    console.error("[admin pages] Failed to load:", error);
    return NextResponse.json(
      { error: "Failed to load pages." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const bookId = BigInt(id);
    const body = await request.json();
    const now = new Date();

    const pagesInput = Array.isArray(body?.pages) ? body.pages : [];
    const totalPages = body?.totalPages;

    let pagesToCreate: Array<{
      page_number: number;
      text_content?: string | null;
      image_url?: string | null;
    }> = [];

    if (pagesInput.length > 0) {
      pagesToCreate = pagesInput.map((page: any) => ({
        page_number: Number(page.pageNumber),
        text_content: page.textContent ?? null,
        image_url: page.imageUrl ?? null,
      }));
    } else if (typeof totalPages === "number" && totalPages > 0) {
      pagesToCreate = Array.from({ length: totalPages }, (_, idx) => ({
        page_number: idx + 1,
        text_content: null,
        image_url: null,
      }));
    } else {
      return NextResponse.json(
        { error: "No pages provided." },
        { status: 400 }
      );
    }

    await prisma.pages.createMany({
      data: pagesToCreate.map((page) => ({
        ...page,
        book_id: bookId,
        inserted_at: now,
        updated_at: now,
      })),
    });

    const pages = await prisma.pages.findMany({
      where: { book_id: bookId },
      orderBy: { page_number: "asc" },
    });

    return NextResponse.json({
      pages: pages.map((page) => ({
        id: page.id.toString(),
        pageNumber: page.page_number,
        textContent: page.text_content,
        imageUrl: page.image_url,
      })),
    });
  } catch (error) {
    console.error("[admin pages] Failed to create:", error);
    return NextResponse.json(
      { error: "Failed to create pages." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const bookId = BigInt(id);
    const body = await request.json();
    const now = new Date();

    const pagesInput = Array.isArray(body?.pages) ? body.pages : [];

    if (pagesInput.length === 0) {
      return NextResponse.json(
        { error: "No pages provided." },
        { status: 400 }
      );
    }

    // Upsert each page (update if exists, create if not)
    for (const page of pagesInput) {
      const pageNumber = Number(page.pageNumber);

      await prisma.pages.upsert({
        where: {
          book_id_page_number: {
            book_id: bookId,
            page_number: pageNumber,
          },
        },
        update: {
          text_content: page.textContent ?? null,
          image_url: page.imageUrl ?? null,
          narration_url: page.narrationUrl ?? undefined,
          narration_timestamps: page.narrationTimestamps ?? undefined,
          updated_at: now,
        },
        create: {
          book_id: bookId,
          page_number: pageNumber,
          text_content: page.textContent ?? null,
          image_url: page.imageUrl ?? null,
          narration_url: page.narrationUrl ?? null,
          narration_timestamps: page.narrationTimestamps ?? null,
          inserted_at: now,
          updated_at: now,
        },
      });
    }

    // Fetch and return updated pages
    const pages = await prisma.pages.findMany({
      where: { book_id: bookId },
      orderBy: { page_number: "asc" },
    });

    return NextResponse.json({
      pages: pages.map((page) => ({
        id: page.id.toString(),
        pageNumber: page.page_number,
        textContent: page.text_content,
        imageUrl: page.image_url,
      })),
    });
  } catch (error) {
    console.error("[admin pages] Failed to update:", error);
    return NextResponse.json(
      { error: "Failed to update pages." },
      { status: 500 }
    );
  }
}

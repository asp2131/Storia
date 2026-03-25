import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TextOverlayConfig } from "@/types/text-overlay";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

type SavePageInput = {
  id?: string;
  textContent: string | null;
  imageUrl: string | null;
  narrationUrl?: string | null;
  narrationTimestamps?: any;
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
        compositedImageUrl: page.composited_image_url,
        overlay: page.text_overlay as TextOverlayConfig | null,
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

    const normalizedPages: SavePageInput[] = pagesInput.map((page: any) => ({
      id: typeof page.id === "string" && page.id.length > 0 ? page.id : undefined,
      textContent: page.textContent ?? null,
      imageUrl: page.imageUrl ?? null,
      narrationUrl: page.narrationUrl,
      narrationTimestamps: page.narrationTimestamps,
    }));

    const hasIdHints = normalizedPages.some((page) => page.id);

    if (!hasIdHints) {
      // Legacy fallback: update by page_number only.
      for (const [index, page] of normalizedPages.entries()) {
        const pageNumber = index + 1;

        await prisma.pages.upsert({
          where: {
            book_id_page_number: {
              book_id: bookId,
              page_number: pageNumber,
            },
          },
          update: {
            text_content: page.textContent,
            image_url: page.imageUrl,
            narration_url: page.narrationUrl ?? undefined,
            narration_timestamps: page.narrationTimestamps ?? undefined,
            updated_at: now,
          },
          create: {
            book_id: bookId,
            page_number: pageNumber,
            text_content: page.textContent,
            image_url: page.imageUrl,
            narration_url: page.narrationUrl ?? null,
            narration_timestamps: page.narrationTimestamps ?? null,
            inserted_at: now,
            updated_at: now,
          },
        });
      }
    } else {
      await prisma.$transaction(async (tx) => {
        const existingPages = await tx.pages.findMany({
          where: { book_id: bookId },
          select: { id: true, page_number: true },
        });

        const existingIdSet = new Set(existingPages.map((page) => page.id.toString()));
        const validIdsInPayload = normalizedPages
          .map((page) => page.id)
          .filter((idValue): idValue is string => !!idValue && existingIdSet.has(idValue));

        const uniqueValidIds = Array.from(new Set(validIdsInPayload));

        if (uniqueValidIds.length !== validIdsInPayload.length) {
          throw new Error("Duplicate page id(s) in save payload.");
        }

        // Move rows with known ids to temporary page numbers to avoid unique collisions.
        const maxPageNumber = existingPages.reduce(
          (max, page) => Math.max(max, page.page_number),
          0
        );
        const tempBase = Math.max(maxPageNumber, normalizedPages.length) + 1000;

        for (const [index, pageId] of uniqueValidIds.entries()) {
          await tx.pages.update({
            where: { id: BigInt(pageId) },
            data: {
              page_number: tempBase + index,
              updated_at: now,
            },
          });
        }

        // Full-sync semantics in id-aware mode: rows not present are deleted.
        if (uniqueValidIds.length > 0) {
          await tx.pages.deleteMany({
            where: {
              book_id: bookId,
              NOT: {
                id: {
                  in: uniqueValidIds.map((pageId) => BigInt(pageId)),
                },
              },
            },
          });
        }

        // Re-assign final order by payload index; existing IDs keep their row identity
        // (and therefore keep overlay/composited/narration relations unless explicitly changed).
        for (const [index, page] of normalizedPages.entries()) {
          const finalPageNumber = index + 1;

          if (page.id && existingIdSet.has(page.id)) {
            await tx.pages.update({
              where: { id: BigInt(page.id) },
              data: {
                page_number: finalPageNumber,
                text_content: page.textContent,
                image_url: page.imageUrl,
                narration_url: page.narrationUrl ?? undefined,
                narration_timestamps: page.narrationTimestamps ?? undefined,
                updated_at: now,
              },
            });
            continue;
          }

          await tx.pages.create({
            data: {
              book_id: bookId,
              page_number: finalPageNumber,
              text_content: page.textContent,
              image_url: page.imageUrl,
              narration_url: page.narrationUrl ?? null,
              narration_timestamps: page.narrationTimestamps ?? null,
              inserted_at: now,
              updated_at: now,
            },
          });
        }
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

import { NextRequest, NextResponse } from "next/server";
import { requireBookAccess } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyBookTextStyle,
  coerceBookTextStyle,
  validateOverlayConfig,
} from "@/types/text-overlay";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * POST /api/admin/books/[id]/apply-text-style
 *
 * Bulk-restyles every overlay element in the book to the book's saved
 * default text style (falling back to DEFAULT_BOOK_TEXT_STYLE). Element
 * text, position, size, and rotation are preserved. Composited images
 * are invalidated the same way the overlay save route invalidates them.
 * All page updates happen in a single transaction.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const access = await requireBookAccess((await params).id);
  if (access instanceof NextResponse) return access;

  try {
    const { id } = await params;
    const bookId = BigInt(id);

    const book = await prisma.books.findUnique({
      where: { id: bookId },
      select: { default_text_style: true },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const style = coerceBookTextStyle(book.default_text_style);

    const pages = await prisma.pages.findMany({
      where: { book_id: bookId },
      select: { id: true, text_overlay: true },
    });

    const now = new Date();
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    let elementsRestyled = 0;
    let pagesSkipped = 0;

    for (const page of pages) {
      // Skip pages without an overlay. Nullable JSON columns can read back
      // as null (DbNull) or Prisma.JsonNull — handle both explicitly.
      const raw: unknown = page.text_overlay;
      if (raw === null || raw === undefined || raw === Prisma.JsonNull) {
        continue;
      }

      let overlay;
      try {
        overlay = validateOverlayConfig(raw);
      } catch {
        // Malformed overlays are skipped (and counted), never fatal.
        pagesSkipped += 1;
        continue;
      }

      const next = applyBookTextStyle(overlay, style);
      elementsRestyled += next.elements.length;
      updates.push(
        prisma.pages.update({
          where: { id: page.id },
          data: {
            text_overlay: next as unknown as Prisma.InputJsonValue,
            composited_image_url: null,
            composited_image_path: null,
            composited_at: null,
            composited_by: null,
            updated_at: now,
          },
        })
      );
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({
      pagesUpdated: updates.length,
      elementsRestyled,
      pagesSkipped,
    });
  } catch (error) {
    console.error("[apply-text-style] Failed:", error);
    return NextResponse.json(
      { error: "Failed to apply text style." },
      { status: 500 }
    );
  }
}

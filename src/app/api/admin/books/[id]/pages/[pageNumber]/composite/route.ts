import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { compositePageImage } from "@/lib/image-compositing";
import {
  uploadCompositedImage,
  deleteCompositedImage,
} from "@/lib/storage";
import type { TextOverlayConfig } from "@/types/text-overlay";

interface RouteParams {
  params: Promise<{ id: string; pageNumber: string }>;
}

/**
 * GET /api/admin/books/[id]/pages/[pageNumber]/composite
 *
 * Check compositing status for a page.
 * Returns whether overlay and base image exist, composited image URL,
 * and whether the composited image is stale.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id, pageNumber } = await params;
    const bookId = BigInt(id);
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum)) {
      return NextResponse.json(
        { error: "Invalid page number." },
        { status: 400 }
      );
    }

    const page = await prisma.pages.findUnique({
      where: {
        book_id_page_number: {
          book_id: bookId,
          page_number: pageNum,
        },
      },
      select: {
        text_overlay: true,
        image_url: true,
        composited_image_url: true,
        composited_at: true,
        updated_at: true,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: "Page not found." },
        { status: 404 }
      );
    }

    // Determine if overlay exists and has elements
    const overlayConfig = page.text_overlay as unknown as TextOverlayConfig | null;
    const hasOverlay =
      overlayConfig !== null &&
      Array.isArray(overlayConfig.elements) &&
      overlayConfig.elements.length > 0;

    const hasBaseImage = page.image_url !== null && page.image_url !== "";

    // Determine if composited image is stale
    // Stale if: no composited_at, or updated_at > composited_at
    let isStale = true;
    if (page.composited_at !== null) {
      const updatedAt = new Date(page.updated_at).getTime();
      const compositedAt = new Date(page.composited_at).getTime();
      isStale = updatedAt > compositedAt;
    }

    return NextResponse.json({
      hasOverlay,
      hasBaseImage,
      compositedImageUrl: page.composited_image_url ?? null,
      compositedAt: page.composited_at?.toISOString() ?? null,
      isStale,
    });
  } catch (error) {
    console.error("[composite] GET error:", error);
    return NextResponse.json(
      { error: "Failed to check compositing status." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/books/[id]/pages/[pageNumber]/composite
 *
 * Trigger compositing for a page.
 * Renders text overlay onto base image, uploads to storage,
 * and updates the page record.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const { id, pageNumber } = await params;
    const bookId = BigInt(id);
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum)) {
      return NextResponse.json(
        { error: "Invalid page number." },
        { status: 400 }
      );
    }

    // Fetch page data
    const page = await prisma.pages.findUnique({
      where: {
        book_id_page_number: {
          book_id: bookId,
          page_number: pageNum,
        },
      },
      select: {
        id: true,
        text_overlay: true,
        image_url: true,
        composited_image_path: true,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: "Page not found." },
        { status: 404 }
      );
    }

    // Verify page has overlay config
    const overlayConfig = page.text_overlay as unknown as TextOverlayConfig | null;
    const hasOverlay =
      overlayConfig !== null &&
      Array.isArray(overlayConfig.elements) &&
      overlayConfig.elements.length > 0;

    if (!hasOverlay) {
      return NextResponse.json(
        { error: "Page does not have a text overlay configuration." },
        { status: 400 }
      );
    }

    // Verify page has base image
    if (!page.image_url) {
      return NextResponse.json(
        { error: "Page does not have a base image." },
        { status: 400 }
      );
    }

    // Composite the image
    const compositeResult = await compositePageImage(
      page.image_url,
      overlayConfig
    );

    // Upload composited image
    const uploadResult = await uploadCompositedImage(
      bookId,
      pageNum,
      compositeResult.buffer,
      compositeResult.contentType
    );

    // Delete old composited image if it exists
    const oldPath = page.composited_image_path;
    if (oldPath) {
      await deleteCompositedImage(oldPath);
    }

    // Update page record
    const now = new Date();
    await prisma.pages.update({
      where: {
        id: page.id,
      },
      data: {
        composited_image_url: uploadResult.url,
        composited_image_path: uploadResult.path,
        composited_at: now,
        composited_by: user.id,
      },
    });

    return NextResponse.json({
      compositedImageUrl: uploadResult.url,
      compositedImagePath: uploadResult.path,
      compositedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[composite] POST error:", error);
    return NextResponse.json(
      { error: "Failed to composite image." },
      { status: 500 }
    );
  }
}

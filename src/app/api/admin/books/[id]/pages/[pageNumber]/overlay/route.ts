import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import {
  TextOverlayConfig,
  validateOverlayConfig,
  deriveTextContent,
} from "@/types/text-overlay";

interface RouteParams {
  params: Promise<{ id: string; pageNumber: string }>;
}

/**
 * GET /api/admin/books/[id]/pages/[pageNumber]/overlay
 * Fetch overlay config for a page
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { id, pageNumber } = await params;
    const bookId = BigInt(id);
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
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
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: "Page not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      overlay: page.text_overlay as unknown as TextOverlayConfig | null,
      imageUrl: page.image_url,
      compositedImageUrl: page.composited_image_url,
    });
  } catch (error) {
    console.error("[overlay GET] Error fetching overlay:", error);
    return NextResponse.json(
      { error: "Failed to fetch overlay configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/books/[id]/pages/[pageNumber]/overlay
 * Save/replace full overlay config
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  // User authenticated successfully (authResult.user available if needed)

  try {
    const { id, pageNumber } = await params;
    const bookId = BigInt(id);
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json(
        { error: "Invalid page number" },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body.overlay) {
      return NextResponse.json(
        { error: "Missing overlay in request body" },
        { status: 400 }
      );
    }

    // Validate the overlay config
    let validatedOverlay: TextOverlayConfig;
    try {
      validatedOverlay = validateOverlayConfig(body.overlay);
    } catch (validationError) {
      return NextResponse.json(
        {
          error: "Invalid overlay configuration",
          details:
            validationError instanceof Error
              ? validationError.message
              : "Unknown validation error",
        },
        { status: 400 }
      );
    }

    // Derive text_content from overlay elements (mirrors overlay → textContent)
    const derivedText = deriveTextContent(validatedOverlay);

    // Upsert the page with overlay config (fixes first-save 404 when page row doesn't exist yet)
    // Clear composited fields to mark compositing as stale
    const now = new Date();
    const updatedPage = await prisma.pages.upsert({
      where: {
        book_id_page_number: {
          book_id: bookId,
          page_number: pageNum,
        },
      },
      update: {
        text_overlay: validatedOverlay as unknown as Prisma.InputJsonValue,
        text_content: derivedText || null,
        composited_image_url: null,
        composited_image_path: null,
        composited_at: null,
        composited_by: null,
        updated_at: now,
      },
      create: {
        book_id: bookId,
        page_number: pageNum,
        text_overlay: validatedOverlay as unknown as Prisma.InputJsonValue,
        text_content: derivedText || null,
        inserted_at: now,
        updated_at: now,
      },
      select: {
        text_overlay: true,
        text_content: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      overlay: updatedPage.text_overlay as unknown as TextOverlayConfig,
      textContent: updatedPage.text_content,
      updatedAt: updatedPage.updated_at.toISOString(),
    });
  } catch (error) {
    console.error("[overlay POST] Error saving overlay:", error);

    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return NextResponse.json(
        { error: "Page not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save overlay configuration" },
      { status: 500 }
    );
  }
}

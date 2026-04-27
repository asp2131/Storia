import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPronunciationReviewData,
  type PronunciationReviewCoverageStatus,
  type PronunciationReviewFilters,
  type PronunciationReviewStatus,
} from "@/lib/pronunciationReview";

const ALLOWED_COVERAGE_FILTERS = new Set<PronunciationReviewCoverageStatus>([
  "missing",
  "full-word-only",
  "covered",
]);

const ALLOWED_REVIEW_FILTERS = new Set<PronunciationReviewStatus>([
  "missing",
  "generated",
  "failed",
  "reviewed",
]);

function parseBookIdParam(bookId: string): bigint | null {
  try {
    return BigInt(bookId);
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

function parseFilters(searchParams: URLSearchParams): {
  filters: PronunciationReviewFilters;
  errors: string[];
} {
  const filters: PronunciationReviewFilters = {};
  const errors: string[] = [];

  const search = searchParams.get("search")?.trim();
  if (search) {
    filters.search = search;
  }

  const coverageStatus = searchParams.get("coverageStatus");
  if (coverageStatus) {
    if (ALLOWED_COVERAGE_FILTERS.has(coverageStatus as PronunciationReviewCoverageStatus)) {
      filters.coverageStatus = coverageStatus as PronunciationReviewCoverageStatus;
    } else {
      errors.push(
        "coverageStatus must be one of: missing, full-word-only, covered."
      );
    }
  }

  const reviewStatus = searchParams.get("reviewStatus");
  if (reviewStatus) {
    if (ALLOWED_REVIEW_FILTERS.has(reviewStatus as PronunciationReviewStatus)) {
      filters.reviewStatus = reviewStatus as PronunciationReviewStatus;
    } else {
      errors.push(
        "reviewStatus must be one of: missing, generated, failed, reviewed."
      );
    }
  }

  const pageNumberParam = searchParams.get("pageNumber");
  if (pageNumberParam !== null) {
    const pageNumber = parsePositiveInteger(pageNumberParam);
    if (pageNumber === undefined) {
      errors.push("pageNumber must be a positive integer.");
    } else {
      filters.pageNumber = pageNumber;
    }
  }

  const limitParam = searchParams.get("limit");
  if (limitParam !== null) {
    const limit = parsePositiveInteger(limitParam);
    if (limit === undefined) {
      errors.push("limit must be a positive integer.");
    } else {
      filters.limit = limit;
    }
  }

  const offsetParam = searchParams.get("offset");
  if (offsetParam !== null) {
    const offset = parseNonNegativeInteger(offsetParam);
    if (offset === undefined) {
      errors.push("offset must be a non-negative integer.");
    } else {
      filters.offset = offset;
    }
  }

  return { filters, errors };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookId } = await params;
  const parsedBookId = parseBookIdParam(bookId);

  if (parsedBookId === null) {
    return NextResponse.json(
      { error: "Invalid book ID.", code: "invalid_book_id" },
      { status: 400 }
    );
  }

  const { filters, errors } = parseFilters(request.nextUrl.searchParams);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: errors[0],
        code: "invalid_review_filters",
        details: errors,
      },
      { status: 400 }
    );
  }

  try {
    const [pages, pronunciations] = await Promise.all([
      prisma.pages.findMany({
        where: { book_id: parsedBookId },
        orderBy: { page_number: "asc" },
        select: {
          id: true,
          page_number: true,
          text_content: true,
        },
      }),
      prisma.book_pronunciations.findMany({
        where: { book_id: parsedBookId },
        select: {
          normalized_word: true,
          display_word: true,
          full_word_url: true,
          breakdown_url: true,
          source: true,
          status: true,
          confidence: true,
          human_reviewed: true,
          generated_at: true,
          updated_at: true,
          phonetic_display: true,
          syllables: true,
          breakdown_segments: true,
        },
      }),
    ]);

    const review = buildPronunciationReviewData(
      {
        pages: pages.map((page) => ({
          id: page.id,
          pageNumber: page.page_number,
          textContent: page.text_content,
        })),
        pronunciations,
      },
      filters
    );

    return NextResponse.json({
      bookId,
      filters: {
        search: filters.search ?? null,
        pageNumber: filters.pageNumber ?? null,
        coverageStatus: filters.coverageStatus ?? null,
        reviewStatus: filters.reviewStatus ?? null,
        limit: filters.limit ?? null,
        offset: filters.offset ?? 0,
      },
      review,
    });
  } catch (error) {
    console.error("[admin/books/[id]/pronunciations] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load pronunciation review data.",
      },
      { status: 500 }
    );
  }
}

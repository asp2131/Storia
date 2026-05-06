import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
    pageNumber: string;
  }>;
};

type OverlayEntryInput = {
  id?: string;
  text?: string;
  includeInNarration?: boolean;
  sortOrder?: number;
  bbox?: unknown;
  confidence?: number | null;
};

function parsePositiveBigInt(value: string): bigint | null {
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function mapEntry(entry: {
  id: bigint;
  text_content: string;
  include_in_narration: boolean;
  sort_order: number;
  bbox: Prisma.JsonValue | null;
  confidence: number | null;
  source: string;
}) {
  return {
    id: entry.id.toString(),
    text: entry.text_content,
    includeInNarration: entry.include_in_narration,
    sortOrder: entry.sort_order,
    bbox: entry.bbox,
    confidence: entry.confidence,
    source: entry.source,
  };
}

async function findPage(bookId: bigint, pageNumber: number) {
  return prisma.pages.findUnique({
    where: {
      book_id_page_number: {
        book_id: bookId,
        page_number: pageNumber,
      },
    },
    select: { id: true },
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id, pageNumber } = await params;
  const bookId = parsePositiveBigInt(id);
  const parsedPageNumber = parsePositiveInt(pageNumber);

  if (!bookId || !parsedPageNumber) {
    return NextResponse.json(
      { error: "Invalid book or page number." },
      { status: 400 }
    );
  }

  const page = await findPage(bookId, parsedPageNumber);
  if (!page) return NextResponse.json({ entries: [] });

  const entries = await prisma.page_overlay_text_entries.findMany({
    where: { page_id: page.id },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ entries: entries.map(mapEntry) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, pageNumber } = await params;
  const bookId = parsePositiveBigInt(id);
  const parsedPageNumber = parsePositiveInt(pageNumber);

  if (!bookId || !parsedPageNumber) {
    return NextResponse.json(
      { error: "Invalid book or page number." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const entriesInput = Array.isArray(body?.entries) ? (body.entries as OverlayEntryInput[]) : [];

  const normalizedEntries = entriesInput
    .map((entry, index) => ({
      text: typeof entry.text === "string" ? entry.text.trim() : "",
      includeInNarration: entry.includeInNarration !== false,
      sortOrder: Number.isInteger(entry.sortOrder) ? Number(entry.sortOrder) : index,
      bbox: entry.bbox && typeof entry.bbox === "object" ? entry.bbox : null,
      confidence:
        typeof entry.confidence === "number" && Number.isFinite(entry.confidence)
          ? entry.confidence
          : null,
    }))
    .filter((entry) => entry.text.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((entry, index) => ({ ...entry, sortOrder: index }));

  const now = new Date();

  try {
    const page = await prisma.pages.upsert({
      where: {
        book_id_page_number: {
          book_id: bookId,
          page_number: parsedPageNumber,
        },
      },
      update: { updated_at: now },
      create: {
        book_id: bookId,
        page_number: parsedPageNumber,
        inserted_at: now,
        updated_at: now,
      },
      select: { id: true },
    });

    const entries = await prisma.$transaction(async (tx) => {
      await tx.page_overlay_text_entries.deleteMany({
        where: { page_id: page.id },
      });

      if (normalizedEntries.length > 0) {
        await tx.page_overlay_text_entries.createMany({
          data: normalizedEntries.map((entry) => ({
            page_id: page.id,
            text_content: entry.text,
            include_in_narration: entry.includeInNarration,
            sort_order: entry.sortOrder,
            bbox: entry.bbox === null ? Prisma.JsonNull : (entry.bbox as Prisma.InputJsonValue),
            confidence: entry.confidence,
            source: "ocr",
            inserted_at: now,
            updated_at: now,
          })),
        });
      }

      return tx.page_overlay_text_entries.findMany({
        where: { page_id: page.id },
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      });
    });

    return NextResponse.json({ entries: entries.map(mapEntry) });
  } catch (error) {
    console.error("[admin overlay text] Failed to save:", error);
    return NextResponse.json(
      { error: "Failed to save overlay text entries." },
      { status: 500 }
    );
  }
}

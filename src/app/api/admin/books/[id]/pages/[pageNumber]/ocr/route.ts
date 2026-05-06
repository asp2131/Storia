import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseReplicateOcrOutput } from "@/lib/overlayText";

const REPLICATE_VERSION =
  "5f9e86550c3540aab9292e0cae22f71bb75724be3c9bb72ebf0798d028f0f27b";
const OCR_TIMEOUT_MS = 30_000;

type Params = {
  params: Promise<{
    id: string;
    pageNumber: string;
  }>;
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

function extractReplicateOutput(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  return record.output ?? record.error ?? "";
}

async function runReplicateOcr(imageUrl: string): Promise<unknown> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("OCR is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=25",
      },
      body: JSON.stringify({
        version: REPLICATE_VERSION,
        input: {
          image: imageUrl,
          question: "whats the text on this image?",
          video_fps: 10,
          thinking_mode: "fast",
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error("OCR provider request failed.");
    }

    const record = payload as { status?: string; urls?: { get?: string } };
    if (record.status === "failed") {
      throw new Error("OCR provider request failed.");
    }
    if (record.status === "succeeded" || !record.urls?.get) {
      return extractReplicateOutput(payload);
    }

    const pollDeadline = Date.now() + OCR_TIMEOUT_MS;
    let pollUrl = record.urls.get;
    while (Date.now() < pollDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const poll = await fetch(pollUrl, {
        headers: { Authorization: `Token ${token}` },
        signal: controller.signal,
      });
      const pollPayload = await poll.json().catch(() => ({}));
      if (!poll.ok) throw new Error("OCR provider polling failed.");
      const pollRecord = pollPayload as { status?: string; urls?: { get?: string } };
      pollUrl = pollRecord.urls?.get || pollUrl;
      if (pollRecord.status === "failed") {
        throw new Error("OCR provider request failed.");
      }
      if (pollRecord.status === "succeeded") {
        return extractReplicateOutput(pollPayload);
      }
    }

    throw new Error("OCR request timed out.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OCR request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

export async function POST(request: NextRequest, { params }: Params) {
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
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required." }, { status: 400 });
  }

  try {
    const output = await runReplicateOcr(imageUrl);
    const detected = parseReplicateOcrOutput(output);
    const now = new Date();

    const page = await prisma.pages.upsert({
      where: {
        book_id_page_number: {
          book_id: bookId,
          page_number: parsedPageNumber,
        },
      },
      update: {
        image_url: imageUrl,
        updated_at: now,
      },
      create: {
        book_id: bookId,
        page_number: parsedPageNumber,
        image_url: imageUrl,
        inserted_at: now,
        updated_at: now,
      },
      select: { id: true },
    });

    const entries = await prisma.$transaction(async (tx) => {
      await tx.page_overlay_text_entries.deleteMany({
        where: { page_id: page.id, source: "ocr" },
      });

      if (detected.length === 0) return [];

      await tx.page_overlay_text_entries.createMany({
        data: detected.map((text, index) => ({
          page_id: page.id,
          text_content: text,
          include_in_narration: true,
          sort_order: index,
          bbox: Prisma.JsonNull,
          confidence: null,
          source: "ocr",
          inserted_at: now,
          updated_at: now,
        })),
      });

      return tx.page_overlay_text_entries.findMany({
        where: { page_id: page.id },
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      });
    });

    return NextResponse.json({
      pageId: page.id.toString(),
      detectedText: detected,
      entries: entries.map(mapEntry),
    });
  } catch (error) {
    console.warn("[admin page ocr] OCR failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "OCR failed.",
        entries: [],
      },
      { status: error instanceof Error && error.message.includes("timed out") ? 504 : 502 }
    );
  }
}

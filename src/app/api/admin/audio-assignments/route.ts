import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
        create: (args: unknown) => Promise<any>;
      };
    };
    if (!client.page_audio_assignments) {
      return NextResponse.json(
        {
          error:
            "Prisma client is missing page_audio_assignments. Run `npx prisma generate` and restart the dev server.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const now = new Date();

    if (!body?.pageId || !body?.audioUrl || !body?.audioType || !body?.scope) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const assignment = await client.page_audio_assignments.create({
      data: {
        page_id: BigInt(body.pageId),
        audio_url: body.audioUrl,
        audio_type: body.audioType,
        scope: body.scope,
        range_start: body.rangeStart ?? null,
        range_end: body.rangeEnd ?? null,
        volume: body.volume ?? null,
        inserted_at: now,
        updated_at: now,
      },
    });

    return NextResponse.json({
      assignment: {
        id: assignment.id.toString(),
        pageId: assignment.page_id.toString(),
        audioUrl: assignment.audio_url,
        audioType: assignment.audio_type,
        scope: assignment.scope,
        rangeStart: assignment.range_start,
        rangeEnd: assignment.range_end,
        volume: assignment.volume,
      },
    });
  } catch (error) {
    console.error("[audio assignments] Failed to create:", error);
    return NextResponse.json(
      { error: "Failed to create assignment." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
        findMany: (args: unknown) => Promise<any[]>;
      };
      pages?: {
        findFirst: (args: unknown) => Promise<any | null>;
      };
    };
    if (!client.page_audio_assignments || !client.pages) {
      return NextResponse.json(
        {
          error:
            "Prisma client is missing page_audio_assignments. Run `npx prisma generate` and restart the dev server.",
        },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const bookId = url.searchParams.get("bookId");
    const pageNumber = Number(url.searchParams.get("pageNumber"));

    if (!bookId || Number.isNaN(pageNumber)) {
      return NextResponse.json(
        { error: "bookId and pageNumber are required." },
        { status: 400 }
      );
    }

    const page = await client.pages.findFirst({
      where: { book_id: BigInt(bookId), page_number: pageNumber },
      select: { id: true },
    });

    if (!page) {
      return NextResponse.json({ assignments: [] });
    }

    const assignments = await client.page_audio_assignments.findMany({
      where: {
        OR: [
          { page_id: page.id },
          {
            scope: "range",
            range_start: { lte: pageNumber },
            range_end: { gte: pageNumber },
            pages: { book_id: BigInt(bookId) },
          },
        ],
      },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({
      assignments: assignments.map((assignment) => ({
        id: assignment.id.toString(),
        audioUrl: assignment.audio_url,
        audioType: assignment.audio_type,
        scope: assignment.scope,
        rangeStart: assignment.range_start,
        rangeEnd: assignment.range_end,
        volume: assignment.volume,
      })),
    });
  } catch (error) {
    console.error("[audio assignments] Failed to load:", error);
    return NextResponse.json(
      { error: "Failed to load assignments." },
      { status: 500 }
    );
  }
}

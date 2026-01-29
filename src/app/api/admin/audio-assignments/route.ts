import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
        create: (args: unknown) => Promise<any>;
        findFirst: (args: unknown) => Promise<any>;
        update: (args: unknown) => Promise<any>;
        delete: (args: unknown) => Promise<any>;
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

    // Check if an assignment already exists for this page and audio type
    const existingAssignment = await client.page_audio_assignments.findFirst({
      where: {
        page_id: BigInt(body.pageId),
        audio_type: body.audioType,
        scope: "single", // Only replace single-page assignments
      },
    });

    let assignment;

    if (existingAssignment) {
      // Update the existing assignment
      console.log(`[audio assignments] Updating existing assignment ${existingAssignment.id}`);
      assignment = await client.page_audio_assignments.update({
        where: { id: existingAssignment.id },
        data: {
          audio_url: body.audioUrl,
          scope: body.scope,
          range_start: body.rangeStart ?? null,
          range_end: body.rangeEnd ?? null,
          volume: body.volume ?? null,
          updated_at: now,
        },
      });
    } else {
      // Create a new assignment
      console.log(`[audio assignments] Creating new assignment for page ${body.pageId}`);
      assignment = await client.page_audio_assignments.create({
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
    }

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
      updated: !!existingAssignment,
    });
  } catch (error) {
    console.error("[audio assignments] Failed to create/update:", error);
    return NextResponse.json(
      { error: "Failed to save assignment." },
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

export async function DELETE(request: NextRequest) {
  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
        delete: (args: unknown) => Promise<any>;
        deleteMany: (args: unknown) => Promise<any>;
        findUnique: (args: unknown) => Promise<any | null>;
      };
      pages?: {
        findFirst: (args: unknown) => Promise<any | null>;
        update: (args: unknown) => Promise<any>;
      };
    };
    if (!client.page_audio_assignments || !client.pages) {
      return NextResponse.json(
        { error: "Prisma client is missing required models." },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const assignmentId = url.searchParams.get("id");
    const pageId = url.searchParams.get("pageId");
    const audioType = url.searchParams.get("audioType");

    // Delete by assignment ID
    if (assignmentId) {
      // Get the assignment first to check if it's narration
      const assignment = await client.page_audio_assignments.findUnique({
        where: { id: BigInt(assignmentId) },
      });

      await client.page_audio_assignments.delete({
        where: { id: BigInt(assignmentId) },
      });

      // If it was a narration assignment, also clear the page's narration fields
      if (assignment?.audio_type === "narration") {
        await client.pages.update({
          where: { id: assignment.page_id },
          data: {
            narration_url: null,
            narration_timestamps: null,
            updated_at: new Date(),
          },
        });
        console.log(`[audio assignments] Also cleared narration from page ${assignment.page_id}`);
      }

      console.log(`[audio assignments] Deleted assignment ${assignmentId}`);
      return NextResponse.json({ success: true, deletedId: assignmentId });
    }

    // Delete by pageId and audioType
    if (pageId && audioType) {
      const result = await client.page_audio_assignments.deleteMany({
        where: {
          page_id: BigInt(pageId),
          audio_type: audioType,
        },
      });

      // If deleting narration, also clear the page's narration fields
      if (audioType === "narration") {
        await client.pages.update({
          where: { id: BigInt(pageId) },
          data: {
            narration_url: null,
            narration_timestamps: null,
            updated_at: new Date(),
          },
        });
        console.log(`[audio assignments] Also cleared narration from page ${pageId}`);
      }

      console.log(`[audio assignments] Deleted ${result.count} assignments for page ${pageId}, type ${audioType}`);
      return NextResponse.json({ success: true, deletedCount: result.count });
    }

    return NextResponse.json(
      { error: "Must provide either 'id' or both 'pageId' and 'audioType'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[audio assignments] Failed to delete:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment." },
      { status: 500 }
    );
  }
}

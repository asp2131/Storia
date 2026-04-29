import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { extractStoragePath } from "@/lib/elevenlabs";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const bucket =
  process.env.SUPABASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
  "storia-storage";

function buildSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

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

/**
 * Delete Storage files from their public URLs (best-effort, won't fail the request).
 */
async function deleteStorageFiles(urls: string[]) {
  const supabase = buildSupabaseClient();
  if (!supabase) return;

  const paths = urls
    .map((u) => extractStoragePath(u, bucket))
    .filter((p): p is string => !!p);

  if (paths.length > 0) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      console.warn(`[audio assignments] Storage cleanup warning: ${error.message}`);
    } else {
      console.log(`[audio assignments] Deleted ${paths.length} file(s) from storage`);
    }
  }
}

/**
 * Delete overlay narration DB rows + Storage files for a given page.
 */
async function deleteOverlayNarrations(pageId: bigint) {
  const rows = await prisma.$queryRaw<Array<{ audio_url: string }>>`
    SELECT audio_url FROM page_overlay_narrations WHERE page_id = ${pageId}
  `;

  if (rows.length > 0) {
    await deleteStorageFiles(rows.map((r) => r.audio_url));
    await prisma.$executeRaw`
      DELETE FROM page_overlay_narrations WHERE page_id = ${pageId}
    `;
    console.log(`[audio assignments] Deleted ${rows.length} overlay narration(s) for page ${pageId}`);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
        delete: (args: unknown) => Promise<any>;
        deleteMany: (args: unknown) => Promise<any>;
        findUnique: (args: unknown) => Promise<any | null>;
        findMany: (args: unknown) => Promise<any[]>;
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
      const assignment = await client.page_audio_assignments.findUnique({
        where: { id: BigInt(assignmentId) },
      });

      await client.page_audio_assignments.delete({
        where: { id: BigInt(assignmentId) },
      });

      if (assignment) {
        // Clean up the Storage file for this assignment
        await deleteStorageFiles([assignment.audio_url]);

        if (assignment.audio_type === "narration") {
          await client.pages.update({
            where: { id: assignment.page_id },
            data: {
              narration_url: null,
              narration_timestamps: null,
              updated_at: new Date(),
            },
          });
          // Also delete overlay narrations for this page
          await deleteOverlayNarrations(assignment.page_id);
          console.log(`[audio assignments] Cleared narration + overlays for page ${assignment.page_id}`);
        }
      }

      console.log(`[audio assignments] Deleted assignment ${assignmentId}`);
      return NextResponse.json({ success: true, deletedId: assignmentId });
    }

    // Delete by pageId and audioType
    if (pageId && audioType) {
      // Collect audio URLs before deleting so we can clean up Storage
      const toDelete = await client.page_audio_assignments.findMany({
        where: {
          page_id: BigInt(pageId),
          audio_type: audioType,
        },
        select: { audio_url: true },
      });

      const result = await client.page_audio_assignments.deleteMany({
        where: {
          page_id: BigInt(pageId),
          audio_type: audioType,
        },
      });

      // Clean up Storage files
      await deleteStorageFiles(toDelete.map((a: any) => a.audio_url));

      if (audioType === "narration") {
        await client.pages.update({
          where: { id: BigInt(pageId) },
          data: {
            narration_url: null,
            narration_timestamps: null,
            updated_at: new Date(),
          },
        });
        // Also delete overlay narrations for this page
        await deleteOverlayNarrations(BigInt(pageId));
        console.log(`[audio assignments] Cleared narration + overlays for page ${pageId}`);
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

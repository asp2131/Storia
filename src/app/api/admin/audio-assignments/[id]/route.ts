import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertPageAccess, requireStudio, type AdminUser } from "@/lib/admin-auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/** Resolve the assignment's page so ownership can be checked before writing. */
async function assertAssignmentAccess(user: AdminUser, id: string) {
  if (user.role === "admin") return null;
  const assignment = await prisma.page_audio_assignments.findUnique({
    where: { id: BigInt(id) },
    select: { page_id: true },
  });
  return assertPageAccess(user, assignment?.page_id ?? null);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) return authResult;
  const denied = await assertAssignmentAccess(
    authResult.user,
    (await params).id
  );
  if (denied) return denied;

  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
        update: (args: unknown) => Promise<any>;
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

    const { id } = await params;
    const body = await request.json();
    const now = new Date();

    const assignment = await client.page_audio_assignments.update({
      where: { id: BigInt(id) },
      data: {
        audio_url: body.audioUrl,
        audio_type: body.audioType,
        scope: body.scope,
        range_start: body.rangeStart ?? null,
        range_end: body.rangeEnd ?? null,
        volume: body.volume ?? null,
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
    console.error("[audio assignments] Failed to update:", error);
    return NextResponse.json(
      { error: "Failed to update assignment." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) return authResult;
  const denied = await assertAssignmentAccess(
    authResult.user,
    (await params).id
  );
  if (denied) return denied;

  try {
    const client = prisma as typeof prisma & {
      page_audio_assignments?: {
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

    const { id } = await params;
    await client.page_audio_assignments.delete({ where: { id: BigInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[audio assignments] Failed to delete:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment." },
      { status: 500 }
    );
  }
}

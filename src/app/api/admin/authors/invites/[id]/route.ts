import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

/** Revoke an outstanding invite. Accepted invites are left alone. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const result = await prisma.author_invite.updateMany({
      where: { id, accepted_at: null, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "No outstanding invite to revoke." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[author invites] Failed to revoke:", error);
    return NextResponse.json(
      { error: "Failed to revoke invite." },
      { status: 500 }
    );
  }
}

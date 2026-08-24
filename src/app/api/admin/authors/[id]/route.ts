import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Revoke author access. Their books stay in the library — unpublishing is a
 * separate, deliberate decision per book.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const result = await prisma.user.updateMany({
      where: { id, role: "author" },
      data: { role: "user" },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Author not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[authors] Failed to revoke:", error);
    return NextResponse.json(
      { error: "Failed to revoke author access." },
      { status: 500 }
    );
  }
}

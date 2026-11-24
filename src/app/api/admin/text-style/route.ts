import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireStudio } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  creatorTextStyleFrom,
  validateBookTextStyle,
  type CreatorTextStyle,
} from "@/types/text-overlay";

/**
 * GET/PUT /api/admin/text-style
 *
 * The signed-in creator's "Use style for new text boxes" default. It seeds new
 * text boxes in every book they edit. Saving it never touches existing boxes
 * or published pages. `style: null` means "use the book's style".
 */
export async function GET() {
  const auth = await requireStudio();
  if (auth instanceof NextResponse) return auth;

  const row = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { default_text_style: true },
  });

  let style: CreatorTextStyle | null = null;
  if (row?.default_text_style) {
    try {
      style = creatorTextStyleFrom(validateBookTextStyle(row.default_text_style));
    } catch {
      // A stale or hand-edited value falls back to the book style instead of breaking the editor.
    }
  }
  return NextResponse.json({ style });
}

export async function PUT(request: NextRequest) {
  const auth = await requireStudio();
  if (auth instanceof NextResponse) return auth;

  let style: CreatorTextStyle;
  try {
    const body = (await request.json()) as { style?: unknown };
    style = creatorTextStyleFrom(validateBookTextStyle(body.style));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid text style." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { default_text_style: style as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ style });
}

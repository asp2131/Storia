"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/admin-auth";

export async function createBookDraft() {
  // Server actions are publicly callable endpoints — gate them like routes.
  const authResult = await requireStudio();
  if (authResult instanceof NextResponse) {
    throw new Error("You do not have access to create books.");
  }
  const { user } = authResult;

  const now = new Date();

  // Inherit the text/voice style from the most recently styled book so new
  // books don't reset to hardcoded defaults. null => editor falls back to
  // DEFAULT_BOOK_TEXT_STYLE, same as before.
  const lastStyled = await prisma.books.findFirst({
    where: { default_text_style: { not: Prisma.DbNull } },
    orderBy: { updated_at: "desc" },
    select: { default_text_style: true },
  });

  const book = await prisma.books.create({
    data: {
      title: "Untitled Book",
      author: "Unknown",
      is_published: false,
      // Staff drafts stay unowned; an author's draft belongs to them.
      owner_id: user.role === "admin" ? null : user.id,
      review_status: "draft",
      processing_status: "pending",
      total_pages: 1,
      default_text_style:
        (lastStyled?.default_text_style as Prisma.InputJsonValue | undefined) ??
        Prisma.DbNull,
      inserted_at: now,
      updated_at: now,
      // Auto-create the first page so a new draft is immediately editable.
      pages: {
        create: {
          page_number: 1,
          inserted_at: now,
          updated_at: now,
        },
      },
    },
  });

  redirect(`/admin/books/${book.id}/edit`);
}

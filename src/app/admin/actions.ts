"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function createBookDraft() {
  const now = new Date();
  
  const book = await prisma.books.create({
    data: {
      title: "Untitled Book",
      author: "Unknown",
      is_published: false,
      processing_status: "pending",
      inserted_at: now,
      updated_at: now,
    },
  });

  redirect(`/admin/books/${book.id}/edit`);
}

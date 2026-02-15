import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await prisma.books.findMany({
    where: { is_published: true },
    select: { id: true, updated_at: true },
  });

  const bookEntries: MetadataRoute.Sitemap = books.map((book) => ({
    url: `https://storia.kids/books/${book.id}/reader`,
    lastModified: book.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    { url: "https://storia.kids", changeFrequency: "weekly", priority: 1.0 },
    { url: "https://storia.kids/library", changeFrequency: "daily", priority: 0.9 },
    ...bookEntries,
  ];
}

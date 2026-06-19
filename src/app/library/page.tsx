import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import LibraryClient from "./LibraryClient";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Browse Loratone's collection of interactive children's books with AI-generated narration and immersive soundscapes. Find your next read aloud adventure.",
  openGraph: {
    title: "Library | Loratone",
    description:
      "Browse interactive children's books with AI narration and soundscapes.",
  },
};

export const dynamic = "force-dynamic";

interface BookRow {
  id: bigint;
  title: string;
  author: string;
  cover_url: string | null;
  description: string | null;
  total_pages: number | null;
  metadata: unknown;
  scenes: { soundscapes: { id: bigint }[] }[];
}

export default async function LibraryPage() {
  let initialBooks: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    description: string | null;
    totalPages: number | null;
    metadata: Record<string, unknown> | null;
    hasSoundscape: boolean;
  }[] = [];

  try {
    const books: BookRow[] = await prisma.books.findMany({
      where: { is_published: true },
      orderBy: { inserted_at: "desc" },
      take: 10,
      include: {
        scenes: {
          include: {
            soundscapes: {
              where: { admin_approved: true },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });

    initialBooks = books.map((book) => ({
      id: book.id.toString(),
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url,
      description: book.description,
      totalPages: book.total_pages,
      metadata: book.metadata as Record<string, unknown> | null,
      hasSoundscape: book.scenes.some((s) => s.soundscapes.length > 0),
    }));
  } catch (error) {
    console.error("[library] Failed to prefetch books:", error);
  }

  return (
    <>
      <LibraryClient initialBooks={initialBooks} />

      {/* SSR book catalog for crawlers — hidden visually, fully indexable */}
      <noscript>
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h1 className="text-2xl font-bold mb-6">
            Loratone Library — Interactive Children&apos;s Books
          </h1>
          <p className="mb-8 text-gray-600">
            Browse our collection of illustrated children&apos;s books with AI-generated
            narration and immersive soundscapes.
          </p>
          <ul>
            {initialBooks.map((book) => (
              <li key={book.id} className="mb-4">
                <a href={`/books/${book.id}/reader`} className="text-blue-600 underline">
                  {book.title}
                </a>{" "}
                by {book.author}
                {book.description && (
                  <p className="text-sm text-gray-500 mt-1">{book.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </noscript>

      {/* Hidden structured content for search engines (visible in DOM, off-screen) */}
      <div className="sr-only" aria-hidden="true">
        <h2>Children&apos;s Books Available on Loratone</h2>
        <ul>
          {initialBooks.map((book) => (
            <li key={book.id}>
              &quot;{book.title}&quot; by {book.author}
              {book.hasSoundscape && " — includes AI soundscape"}
              {book.description && ` — ${book.description}`}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

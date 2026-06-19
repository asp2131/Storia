import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let bookId: bigint;
  try {
    bookId = BigInt(id);
  } catch {
    return { title: "Book Not Found" };
  }

  const book = await prisma.books.findUnique({
    where: { id: bookId },
    select: { title: true, author: true, description: true, cover_url: true },
  });

  if (!book) return { title: "Book Not Found" };

  const description =
    book.description ||
    `Read "${book.title}" by ${book.author} with immersive AI narration and soundscapes on Loratone.`;

  return {
    title: `${book.title} by ${book.author}`,
    description,
    openGraph: {
      title: `${book.title} by ${book.author}`,
      description,
      images: book.cover_url ? [{ url: book.cover_url, alt: book.title }] : [],
      type: "book",
    },
    twitter: {
      card: "summary_large_image",
      title: `${book.title} by ${book.author}`,
      description,
      images: book.cover_url ? [book.cover_url] : [],
    },
  };
}

export default async function BookLayout({ params, children }: Props) {
  const { id } = await params;

  let book: { title: string; author: string; description: string | null; cover_url: string | null } | null = null;
  try {
    book = await prisma.books.findUnique({
      where: { id: BigInt(id) },
      select: { title: true, author: true, description: true, cover_url: true },
    });
  } catch {
    // Invalid ID — let child render the error
  }

  return (
    <>
      {book && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Book",
              name: book.title,
              author: { "@type": "Person", name: book.author },
              description: book.description,
              image: book.cover_url,
              url: `https://loratone.kids/books/${id}/reader`,
              publisher: { "@type": "Organization", name: "Loratone" },
            }),
          }}
        />
      )}
      {children}
    </>
  );
}

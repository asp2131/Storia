import { prisma } from "@/lib/prisma";

export async function GET() {
  const books = await prisma.books.findMany({
    where: { is_published: true },
    select: { title: true, author: true, description: true },
    orderBy: { title: "asc" },
  });

  const bookList = books
    .map(
      (b) =>
        `- "${b.title}" by ${b.author}${b.description ? `: ${b.description}` : ""}`
    )
    .join("\n");

  const content = `# Loratone - Full Documentation

> Interactive children's books with AI-generated soundscapes and narration.

## About

Loratone is a platform where children read illustrated books enhanced with AI-generated audio. Each page features artwork with overlaid text, optional voice narration with word-by-word highlighting, and ambient soundscapes that match the scene.

## Available Books

${bookList}

## Features

- Illustrated pages with text overlay on artwork
- AI voice narration with synchronized word highlighting
- Ambient soundscapes (forest, ocean, city, etc.) per scene
- Two soundscape modes: one-shot intro or continuous loop
- Reading progress saved and synced across devices
- Mobile-first swipe navigation
- Light and dark mode support

## How It Works

1. Visit https://loratone.kids/library to browse the catalog
2. Tap any book to open the reader
3. Swipe up to turn pages — each page has an illustrated scene with overlaid text
4. Tap the "Read" button to hear AI-generated narration with word-by-word highlighting
5. Tap the music icon to play ambient soundscapes that match the scene
6. Progress is automatically saved so you can pick up where you left off

## Links

- Website: https://loratone.kids
- Library: https://loratone.kids/library
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

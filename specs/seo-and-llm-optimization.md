# SEO & LLM Search Optimization Plan for Storia

## Current State

- No `sitemap.xml`
- No `robots.txt`
- No Open Graph / Twitter Card meta tags
- No per-page metadata (only root layout has a generic title/description)
- No structured data (JSON-LD)
- No `llms.txt` for LLM crawlers
- Homepage is `"use client"` with no SSR — invisible to search engines
- Library page is `"use client"` with `force-dynamic` — no static content for crawlers
- Book reader pages are fully client-rendered

---

## Phase 1: Foundational SEO (high impact, low effort)

### 1.1 Add `robots.txt`

Create `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: "https://storia.kids/sitemap.xml",
  };
}
```

### 1.2 Add Dynamic `sitemap.xml`

Create `src/app/sitemap.ts` — fetches all published books from the DB:

```ts
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await prisma.books.findMany({
    where: { is_published: true },
    select: { id: true, updated_at: true },
  });

  const bookEntries = books.map((book) => ({
    url: `https://storia.kids/books/${book.id}/reader`,
    lastModified: book.updated_at ?? undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    { url: "https://storia.kids", changeFrequency: "weekly", priority: 1.0 },
    { url: "https://storia.kids/library", changeFrequency: "daily", priority: 0.9 },
    ...bookEntries,
  ];
}
```

### 1.3 Enhance Root Layout Metadata

Update `src/app/layout.tsx` with Open Graph, Twitter Cards, and canonical URL:

```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://storia.kids"),
  title: {
    default: "Storia - Books That Sound Amazing",
    template: "%s | Storia",
  },
  description:
    "Interactive children's books with AI-generated soundscapes and narration that adapt to every scene. Read, listen, and explore stories like never before.",
  keywords: ["children's books", "interactive books", "audio books", "AI soundscapes", "kids reading", "narrated stories"],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://storia.kids",
    siteName: "Storia",
    title: "Storia - Books That Sound Amazing",
    description:
      "Interactive children's books with AI-generated soundscapes and narration that adapt to every scene.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Storia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Storia - Books That Sound Amazing",
    description:
      "Interactive children's books with AI-generated soundscapes and narration.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

You'll need to create a `public/og-image.png` (1200x630) with Storia branding.

### 1.4 Per-Book Dynamic Metadata

Create a server layout or `generateMetadata` for book pages. Since the reader is `"use client"`, add a parent layout at `src/app/books/[id]/layout.tsx`:

```ts
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await prisma.books.findUnique({
    where: { id: BigInt(id) },
    select: { title: true, author: true, description: true, cover_url: true },
  });

  if (!book) return { title: "Book Not Found" };

  return {
    title: book.title,
    description: book.description || `Read "${book.title}" by ${book.author} with immersive AI soundscapes on Storia.`,
    openGraph: {
      title: `${book.title} by ${book.author}`,
      description: book.description || `Experience "${book.title}" with AI-generated narration and soundscapes.`,
      images: book.cover_url ? [{ url: book.cover_url, alt: book.title }] : [],
      type: "book",
    },
    twitter: {
      card: "summary_large_image",
      title: `${book.title} by ${book.author}`,
      description: book.description || `Experience "${book.title}" with AI-generated narration and soundscapes.`,
      images: book.cover_url ? [book.cover_url] : [],
    },
  };
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

---

## Phase 2: Structured Data (JSON-LD)

Add schema.org structured data so Google shows rich results (book cards, breadcrumbs, etc.).

### 2.1 Organization Schema (root layout)

Add to `src/app/layout.tsx` inside `<body>`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Storia",
      url: "https://storia.kids",
      description: "Interactive children's books with AI-generated soundscapes.",
    }),
  }}
/>
```

### 2.2 Book Schema (per-book layout)

Add to the book layout alongside metadata:

```tsx
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
      url: `https://storia.kids/books/${id}/reader`,
      publisher: { "@type": "Organization", name: "Storia" },
    }),
  }}
/>
```

---

## Phase 3: LLM Search Optimization

### 3.1 Add `llms.txt`

Create `public/llms.txt` — a standardized file that LLM crawlers (ChatGPT, Perplexity, Claude, etc.) look for to understand your site:

```
# Storia

> Interactive children's books with AI-generated soundscapes and narration.

Storia is a platform where children can read illustrated books enhanced with AI-generated audio narration and ambient soundscapes that adapt to every scene.

## What Storia Offers

- Illustrated children's books with text overlaid on artwork
- AI-generated voice narration with word-by-word highlighting
- Ambient soundscapes that match each scene (forest sounds, ocean waves, etc.)
- Reading progress tracking across devices
- Works on mobile and desktop browsers

## How It Works

1. Browse the library at storia.kids/library
2. Tap a book to start reading
3. Swipe through pages with illustrated scenes
4. Tap "Read" to hear AI narration with word highlighting
5. Tap the music icon to play ambient soundscapes

## Links

- Website: https://storia.kids
- Library: https://storia.kids/library
```

### 3.2 Add `llms-full.txt`

Create `public/llms-full.txt` with expanded content — a more detailed version that includes the book catalog. This can be generated dynamically via an API route at `src/app/llms-full.txt/route.ts`:

```ts
import { prisma } from "@/lib/prisma";

export async function GET() {
  const books = await prisma.books.findMany({
    where: { is_published: true },
    select: { title: true, author: true, description: true },
    orderBy: { title: "asc" },
  });

  const bookList = books
    .map((b) => `- "${b.title}" by ${b.author}${b.description ? `: ${b.description}` : ""}`)
    .join("\n");

  const content = `# Storia - Full Documentation

> Interactive children's books with AI-generated soundscapes and narration.

## About

Storia is a platform where children read illustrated books enhanced with AI-generated audio. Each page features artwork with overlaid text, optional voice narration with word-by-word highlighting, and ambient soundscapes that match the scene.

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

## Technical Details

- Built with Next.js and React
- Audio narration generated with AI text-to-speech
- Soundscapes generated with AI audio models
- Available at https://storia.kids
`;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

### 3.3 Reference `llms.txt` in HTML

Add a `<link>` tag in the root layout `<head>` (Next.js handles this via metadata):

```ts
// In layout.tsx metadata
other: {
  "llms.txt": "https://storia.kids/llms.txt",
},
```

---

## Phase 4: Crawlability Improvements

### 4.1 Server-Side Library Page

The library page (`/library`) is currently `"use client"` — crawlers see an empty shell. Options:

- **Quick win**: Add a server component wrapper that fetches published books and passes them as initial data. The client component hydrates on top.
- **Better**: Convert the book list to a server component and keep interactivity (search/filter) in a client child.

### 4.2 Homepage SSR Content

The homepage is fully client-rendered (Three.js hero). Add static text content below the hero that crawlers can index — a `<section>` describing Storia, its value prop, and links to the library.

---

## Priority Order

| Priority | Item | Impact |
|----------|------|--------|
| 1 | `robots.txt` + `sitemap.xml` | Crawlers can find your pages |
| 2 | Root metadata (OG, Twitter) | Social sharing + search snippets |
| 3 | Per-book `generateMetadata` | Book pages appear in search with titles/covers |
| 4 | `llms.txt` + `llms-full.txt` | LLM search engines understand your content |
| 5 | JSON-LD structured data | Rich results in Google |
| 6 | Library page SSR | Crawlers can index your book catalog |
| 7 | Homepage static content | Landing page indexed properly |

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

/** Everyone currently holding role="author", with their submission counts. */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const authors = await prisma.user.findMany({
      where: { role: "author" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
      take: 500,
    });

    const counts = await prisma.books.groupBy({
      by: ["owner_id", "review_status"],
      where: { owner_id: { in: authors.map((a) => a.id) } },
      _count: { _all: true },
    });

    const byAuthor = new Map<string, Record<string, number>>();
    for (const row of counts) {
      if (!row.owner_id) continue;
      const bucket = byAuthor.get(row.owner_id) ?? {};
      bucket[row.review_status] = row._count._all;
      byAuthor.set(row.owner_id, bucket);
    }

    return NextResponse.json({
      authors: authors.map((author) => {
        const bucket = byAuthor.get(author.id) ?? {};
        return {
          id: author.id,
          name: author.name,
          email: author.email,
          joinedAt: author.createdAt.toISOString(),
          books: {
            draft: bucket.draft ?? 0,
            submitted: bucket.submitted ?? 0,
            approved: bucket.approved ?? 0,
            rejected: bucket.rejected ?? 0,
          },
        };
      }),
    });
  } catch (error) {
    console.error("[authors] Failed to list:", error);
    return NextResponse.json(
      { error: "Failed to load authors." },
      { status: 500 }
    );
  }
}

// Disable prerendering for admin pages
export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportAgg } from "@/lib/reports/agg";

const REVIEW_ORDER = ["approved", "submitted", "rejected", "draft"] as const;

const REVIEW_LABEL: Record<string, string> = {
  approved: "Live",
  submitted: "In review",
  rejected: "Changes requested",
  draft: "Drafts",
};

const REVIEW_DOT: Record<string, string> = {
  approved: "var(--studio-live-ink)",
  submitted: "var(--studio-amber)",
  rejected: "var(--studio-changes-ink)",
  draft: "var(--studio-rule-strong)",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ago(date: Date | null): string {
  if (!date) return "just now";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function AdminDashboardPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const user = session?.user as { id: string; email: string; role?: string } | undefined;

  // The layout gate handles the redirect; render nothing rather than leaking a shell.
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const scope = isAdmin ? {} : { owner_id: user.id };

  // An author's shelf never includes the staff-created library.
  const [counts, queue, pendingInvites] = await Promise.all([
    prisma.books.groupBy({
      by: ["review_status"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.books.findMany({
      where: isAdmin
        ? { review_status: "submitted" }
        : { owner_id: user.id, review_status: { in: ["rejected", "draft"] } },
      orderBy: isAdmin ? { submitted_at: "asc" } : { updated_at: "desc" },
      take: 4,
      select: {
        id: true,
        title: true,
        author: true,
        total_pages: true,
        submitted_at: true,
        updated_at: true,
        review_status: true,
        review_note: true,
        owner: { select: { email: true } },
      },
    }),
    isAdmin
      ? prisma.author_invite.count({
          where: { accepted_at: null, revoked_at: null, expires_at: { gt: new Date() } },
        })
      : Promise.resolve(0),
  ]);

  // Reading metrics are library-wide, so they're an admin-only strip. The
  // aggregate runs raw SQL against mobile_analytics_events — never let a slow
  // or failing report take the whole dashboard down with it.
  let headline = null;
  if (isAdmin) {
    try {
      headline = await reportAgg.headline("30d");
    } catch (error) {
      console.error("[dashboard] headline unavailable:", error);
    }
  }

  const byStatus = new Map(counts.map((c) => [c.review_status, c._count._all]));
  const submitted = byStatus.get("submitted") ?? 0;

  return (
    <div className="max-w-[1180px] flex flex-col gap-7">
      <div className="flex items-end justify-between gap-8 border-b-2 border-[var(--studio-ink)] pb-[18px]">
        <div className="flex flex-col gap-[7px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--studio-ink-muted)]">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <h1 className="m-0 font-serif text-[44px] font-medium leading-none tracking-[-0.025em]">
            {greeting()}, {user.email.split("@")[0]}
          </h1>
        </div>
      </div>

      <section className="flex flex-col bg-[var(--studio-card)] border border-[var(--studio-rule)] border-l-[3px] border-l-[var(--studio-amber)]">
        <div className="flex items-baseline justify-between gap-5 px-6 pt-5 pb-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="m-0 font-serif text-[22px] font-medium">
              {isAdmin ? "Waiting on you" : "Your shelf"}
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--studio-review-ink)]">
              {isAdmin
                ? `${submitted} submitted for review`
                : `${queue.length} need${queue.length === 1 ? "s" : ""} your attention`}
            </span>
          </div>
          <Link
            href={isAdmin ? "/admin/books?reviewStatus=submitted" : "/admin/books"}
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--studio-coral-deep)] hover:underline whitespace-nowrap"
          >
            {isAdmin ? "Open queue" : "All books"}
          </Link>
        </div>

        {queue.length === 0 ? (
          <p className="m-0 border-t border-[var(--studio-rule)] px-6 py-8 text-center text-sm text-[var(--studio-ink-muted)]">
            {isAdmin
              ? "Nothing in the review queue. The library is up to date."
              : "Nothing needs your attention. Start a new book whenever you're ready."}
          </p>
        ) : (
          queue.map((book) => (
            <div
              key={book.id.toString()}
              className="flex items-center gap-4 border-t border-[var(--studio-rule)] px-6 py-4"
            >
              <div className="w-[38px] h-[50px] shrink-0 rounded-[3px] bg-[var(--studio-rule)]" />
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="font-serif text-[18px] font-medium truncate">
                  {book.title}
                </span>
                <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--studio-ink-muted)] truncate">
                  {book.owner?.email ?? book.author} &middot; {book.total_pages ?? 0} pages
                  {" "}&middot;{" "}
                  {ago(isAdmin ? book.submitted_at : book.updated_at)}
                </span>
                {!isAdmin && book.review_note && (
                  <span className="font-serif italic text-[13px] text-[var(--studio-changes-ink)]">
                    &ldquo;{book.review_note}&rdquo;
                  </span>
                )}
              </div>
              <Link
                href={`/admin/books/${book.id}/edit`}
                className="shrink-0 rounded-[5px] bg-[var(--studio-coral)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--studio-on-coral)] hover:brightness-95 transition"
              >
                {isAdmin ? "Review" : "Open"}
              </Link>
            </div>
          ))
        )}
      </section>

      <div className="flex flex-col lg:flex-row gap-10">
        {headline && (
          <section className="flex flex-col gap-[18px] flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--studio-rule)] pb-2.5">
              <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.13em]">
                Readers, last 30 days
              </h2>
              <Link
                href="/admin/reports"
                className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--studio-coral-deep)] hover:underline"
              >
                Full reports
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { v: headline.kidsActive.toLocaleString(), l: "Active kids" },
                { v: headline.totalReadingMinutes.toLocaleString(), l: "Reading minutes" },
                { v: headline.booksCompleted.toLocaleString(), l: "Books completed" },
                {
                  v: `${Math.round(headline.narrationAdoptionPercent)}%`,
                  l: "Used narration",
                },
              ].map((stat) => (
                <div key={stat.l} className="flex flex-col gap-[7px]">
                  <span className="font-serif text-[38px] font-medium leading-none">
                    {stat.v}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--studio-ink-muted)]">
                    {stat.l}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-[18px] w-full lg:w-[300px] shrink-0">
          <h2 className="m-0 border-b border-[var(--studio-rule)] pb-2.5 text-[11px] font-bold uppercase tracking-[0.13em]">
            {isAdmin ? "The library" : "My books"}
          </h2>
          <div className="flex flex-col">
            {REVIEW_ORDER.map((status) => (
              <div
                key={status}
                className="flex items-center gap-3 border-b border-[var(--studio-rule)] py-2.5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: REVIEW_DOT[status] }}
                />
                <span className="flex-1 text-xs uppercase tracking-[0.08em] text-[var(--studio-ink-2)]">
                  {REVIEW_LABEL[status]}
                </span>
                <span className="font-serif text-[17px] font-semibold">
                  {byStatus.get(status) ?? 0}
                </span>
              </div>
            ))}
            {isAdmin && (
              <div className="flex items-center gap-3 py-2.5">
                <span className="w-2 h-2 rounded-full shrink-0 bg-[var(--studio-coral-wash)]" />
                <span className="flex-1 text-xs uppercase tracking-[0.08em] text-[var(--studio-ink-2)]">
                  Invites pending
                </span>
                <span className="font-serif text-[17px] font-semibold">
                  {pendingInvites}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

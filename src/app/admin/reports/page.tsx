"use client";

// Disable prerendering for admin pages
export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  useAdminReportsHeadline,
  useAdminReportsTrend,
  useAdminReportsTopBooks,
  useAdminReportsFeedback,
  useAdminReportsTimeline,
} from "@/hooks/useAdminReports";
import type { ReportRange } from "@/lib/reports/agg";
import type { EventCategory } from "@/lib/reports/eventCatalog";

const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const CATEGORY_OPTIONS: Array<{ value: EventCategory | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "engagement", label: "Engagement" },
  { value: "comprehension", label: "Comprehension" },
  { value: "feedback", label: "Feedback" },
  { value: "system", label: "System" },
];

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminReportsPage() {
  const [range, setRange] = useState<ReportRange>("30d");
  const [timelineCategory, setTimelineCategory] = useState<EventCategory | "">("");

  const headline = useAdminReportsHeadline(range);
  const trend = useAdminReportsTrend(range);
  const topBooks = useAdminReportsTopBooks(range, 10);
  const feedback = useAdminReportsFeedback(range, 20);
  const timeline = useAdminReportsTimeline(range, {
    limit: 50,
    category: timelineCategory || null,
  });

  const isLoading =
    headline.isLoading ||
    trend.isLoading ||
    topBooks.isLoading ||
    feedback.isLoading ||
    timeline.isLoading;

  const headlineExportHref = `/api/admin/reports/headline?range=${range}&format=csv`;
  const trendExportHref = `/api/admin/reports/trend?range=${range}&format=csv`;
  const topBooksExportHref = `/api/admin/reports/top-books?range=${range}&limit=10&format=csv`;
  const feedbackExportHref = `/api/admin/reports/feedback?range=${range}&limit=20&format=csv`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="bg-[#101322] border border-[#232948] rounded-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black font-serif mb-2">Platform Reports</h1>
            <p className="text-[#929bc9] text-sm">
              Overview of reading activity, comprehension, narration adoption, and feedback across all users.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={headlineExportHref}
              download
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold bg-[#1337ec] text-white hover:bg-[#1337ec]/90 transition"
            >
              Export headline CSV
            </a>
            <a
              href={trendExportHref}
              download
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold border border-[#232948] text-white hover:bg-[#1a1f2e] transition"
            >
              Export trend CSV
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => {
            const active = range === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-zinc-950"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {isLoading ? (
        <LoadingPanel />
      ) : (
        <>
          {/* Headline Metrics */}
          {headline.data && (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <MetricCard
                label="Active kids"
                value={formatNumber(headline.data.kidsActive)}
                helper="Unique child profiles with sessions"
              />
              <MetricCard
                label="Active parents"
                value={formatNumber(headline.data.parentsActive)}
                helper="Unique parent accounts with sessions"
              />
              <MetricCard
                label="Total sessions"
                value={formatNumber(headline.data.totalSessions)}
                helper="Reading sessions started"
              />
              <MetricCard
                label="Reading minutes"
                value={formatNumber(headline.data.totalReadingMinutes)}
                helper="Total time spent reading"
              />
              <MetricCard
                label="Avg session"
                value={`${headline.data.averageSessionMinutes}m`}
                helper="Average session length"
              />
              <MetricCard
                label="Books completed"
                value={formatNumber(headline.data.booksCompleted)}
                helper="Books finished in period"
              />
              <MetricCard
                label="Comprehension"
                value={`${headline.data.averageComprehensionPercent}%`}
                helper={`${formatNumber(headline.data.comprehensionAttempts)} attempts`}
              />
              <MetricCard
                label="Narration adoption"
                value={`${headline.data.narrationAdoptionPercent}%`}
                helper="Sessions using narration"
              />
              <MetricCard
                label="Practice adoption"
                value={`${headline.data.practiceAdoptionPercent}%`}
                helper="Sessions using practice mode"
              />
            </section>
          )}

          {/* Intent Ratio + Trend */}
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            {headline.data && Object.keys(headline.data.intentRatio).length > 0 && (
              <Panel title="Entry intent">
                <div className="space-y-3">
                  {Object.entries(headline.data.intentRatio)
                    .sort((a, b) => b[1] - a[1])
                    .map(([intent, count]) => {
                      const total = Object.values(headline.data!.intentRatio).reduce(
                        (sum, c) => sum + c,
                        0
                      );
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={intent}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize text-white/80">{intent}</span>
                            <span className="text-white/60">
                              {formatNumber(count)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[#1337ec] transition-all"
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Panel>
            )}

            {trend.data && trend.data.series.length > 0 && (
              <Panel
                title="Daily activity"
                action={
                  <a
                    href={trendExportHref}
                    download
                    className="text-xs text-[#929bc9] hover:text-white transition"
                  >
                    Download CSV
                  </a>
                }
              >
                <DailyBars series={trend.data.series} />
              </Panel>
            )}
          </div>

          {/* Top Books */}
          {topBooks.data && topBooks.data.books.length > 0 && (
            <Panel
              title="Top books"
              action={
                <a
                  href={topBooksExportHref}
                  download
                  className="text-xs text-[#929bc9] hover:text-white transition"
                >
                  Download CSV
                </a>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[#929bc9]">
                    <tr>
                      <th className="pb-3 font-semibold">Book</th>
                      <th className="pb-3 font-semibold">Readers</th>
                      <th className="pb-3 font-semibold">Sessions</th>
                      <th className="pb-3 font-semibold">Minutes</th>
                      <th className="pb-3 font-semibold">Completions</th>
                      <th className="pb-3 font-semibold">Comp %</th>
                      <th className="pb-3 font-semibold">Narr %</th>
                      <th className="pb-3 font-semibold">Practice %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topBooks.data.books.map((book) => (
                      <tr key={book.bookId} className="text-white/80">
                        <td className="py-3 pr-4 font-medium text-white">
                          {book.title || `Book ${book.bookId}`}
                        </td>
                        <td className="py-3 pr-4">{formatNumber(book.uniqueReaders)}</td>
                        <td className="py-3 pr-4">{formatNumber(book.totalSessions)}</td>
                        <td className="py-3 pr-4">{formatNumber(book.totalMinutes)}</td>
                        <td className="py-3 pr-4">
                          {formatNumber(book.completions)}
                          <span className="text-white/40 ml-1">
                            ({book.completionRatePercent}%)
                          </span>
                        </td>
                        <td className="py-3 pr-4">{book.averageComprehensionPercent}%</td>
                        <td className="py-3 pr-4">{book.narrationSessionPercent}%</td>
                        <td className="py-3 pr-4">{book.practiceSessionPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* Feedback + Timeline */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
            {feedback.data && (
              <Panel
                title={`Feedback (${feedback.data.summary.count})`}
                action={
                  <a
                    href={feedbackExportHref}
                    download
                    className="text-xs text-[#929bc9] hover:text-white transition"
                  >
                    Download CSV
                  </a>
                }
              >
                {feedback.data.summary.averageRating != null && (
                  <div className="mb-4 text-sm text-white/70">
                    Average rating:{" "}
                    <span className="font-semibold text-white">
                      {feedback.data.summary.averageRating}★
                    </span>
                  </div>
                )}
                {feedback.data.items.length === 0 ? (
                  <p className="text-sm text-white/50">No feedback in this period.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {feedback.data.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/5 bg-[#0a0e1a] p-3"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-amber-300 font-semibold">
                            {"★".repeat(item.rating)}
                            <span className="text-white/20">
                              {"★".repeat(5 - item.rating)}
                            </span>
                          </span>
                          <span className="text-xs text-white/40">
                            {formatRelative(item.createdAt)}
                          </span>
                        </div>
                        {item.feedback && (
                          <p className="mt-2 text-sm text-white/70 leading-relaxed">
                            {item.feedback}
                          </p>
                        )}
                        {(item.parentName || item.parentEmail) && (
                          <p className="mt-2 text-xs text-white/40">
                            {item.parentName}
                            {item.parentName && item.parentEmail && " · "}
                            {item.parentEmail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {timeline.data && (
              <Panel
                title="Timeline"
                action={
                  <div className="flex gap-1">
                    {CATEGORY_OPTIONS.map((cat) => {
                      const active = timelineCategory === cat.value;
                      return (
                        <button
                          key={cat.value || "all"}
                          type="button"
                          onClick={() => setTimelineCategory(cat.value)}
                          className={`px-2 py-1 rounded-md text-xs transition ${
                            active
                              ? "bg-white text-zinc-950 font-semibold"
                              : "text-[#929bc9] hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                }
              >
                {timeline.data.events.length === 0 ? (
                  <p className="text-sm text-white/50">No events in this period.</p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {timeline.data.events.map((event) => (
                      <div
                        key={`${event.source}-${event.rawId}`}
                        className="rounded-xl border border-white/5 bg-[#0a0e1a] p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <CategoryBadge category={event.category} />
                          <span className="text-white/80 font-medium">
                            {event.label}
                          </span>
                          <span className="text-xs text-white/40 ml-auto">
                            {formatRelative(event.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-white/60">{event.summaryLine}</p>
                        {event.details.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {event.details.map((detail) => (
                              <span
                                key={detail.key}
                                className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/60"
                              >
                                {detail.key}: {String(detail.value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {timeline.data.pagination.truncated && (
                      <p className="text-center text-xs text-white/40 py-2">
                        Showing {timeline.data.pagination.returned} of many events
                      </p>
                    )}
                  </div>
                )}
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-[#101322] border border-[#232948] rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="bg-[#101322] border border-[#232948] rounded-2xl p-5">
      <p className="text-sm font-medium text-[#929bc9]">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-white/50">{helper}</p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="bg-[#101322] border border-[#232948] rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-center text-white/60">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      <p className="text-sm">Loading reports…</p>
    </div>
  );
}

function CategoryBadge({ category }: { category: EventCategory }) {
  const colors: Record<EventCategory, string> = {
    engagement: "bg-emerald-400/15 text-emerald-300",
    comprehension: "bg-sky-400/15 text-sky-300",
    feedback: "bg-amber-400/15 text-amber-300",
    system: "bg-white/10 text-white/60",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${colors[category]}`}
    >
      {category}
    </span>
  );
}

function DailyBars({
  series,
}: {
  series: Array<{ date: string; sessions: number; minutes: number; comprehensionAttempts: number }>;
}) {
  if (series.length === 0) {
    return <p className="text-sm text-white/50">No daily data.</p>;
  }
  const maxMinutes = Math.max(1, ...series.map((s) => s.minutes));
  const totalMinutes = series.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <div>
      <div
        role="img"
        aria-label={`Daily reading minutes for ${series.length} days, ${totalMinutes} minutes total`}
        className="flex h-28 items-end gap-[2px]"
      >
        {series.map((row) => {
          const heightPct = maxMinutes > 0 ? (row.minutes / maxMinutes) * 100 : 0;
          return (
            <div
              key={row.date}
              className="flex-1 rounded-t bg-[#1337ec]/60 hover:bg-[#1337ec] transition"
              style={{
                minHeight: row.minutes > 0 ? "2px" : "1px",
                height: `${Math.max(heightPct, row.minutes > 0 ? 4 : 1)}%`,
                opacity: row.minutes > 0 ? 1 : 0.25,
              }}
              title={`${row.date}: ${row.minutes}m · ${row.sessions} sessions · ${row.comprehensionAttempts} attempts`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/40">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

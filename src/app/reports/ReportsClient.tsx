"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth-client";

type ReportRange = "7d" | "30d" | "90d";

interface ChildProfile {
  id: string;
  displayName: string;
  ageBand?: string | null;
  isDefault?: boolean;
}

interface SourceBreakdownRow {
  source: string;
  sessions: number;
  minutes: number;
}

interface PerBookRow {
  bookId: string;
  title: string;
  sessions: number;
  minutes: number;
  lastReadAt: string;
  currentPage: number | null;
  totalPages: number | null;
  completed: boolean;
  completionCount: number;
}

interface DailySeriesRow {
  date: string;
  sessions: number;
  minutes: number;
  comprehensionAttempts: number;
}

interface ReportSummary {
  childProfileId: string;
  range: ReportRange;
  booksStarted: number;
  booksCompleted: number;
  totalSessions: number;
  totalReadingMinutes: number;
  averageSessionMinutes: number;
  comprehensionAttempts: number;
  averageComprehensionScore: number;
  practiceSessions: number;
  practiceMinutes: number;
  practiceSessionRatePercent: number;
  narrationSessions?: number;
  narrationMinutes?: number;
  narrationSessionRatePercent?: number;
  sourceBreakdown?: SourceBreakdownRow[];
  perBook?: PerBookRow[];
  dailySeries?: DailySeriesRow[];
}

interface EventByName {
  eventName: string;
  count: number;
  lastOccurredAt: string;
}

interface RecentEvent {
  id: string;
  childProfileId: string;
  bookId: string | null;
  sessionId: string | null;
  eventName: string;
  source: string;
  properties: Record<string, unknown>;
  occurredAt: string;
}

interface AnalyticsBlock {
  totalEvents: number;
  uniqueEventNames: number;
  eventsByName: EventByName[];
  recentEvents: RecentEvent[];
}

interface AnalyticsReport {
  childProfileId: string;
  range: ReportRange;
  generatedAt: string;
  summary: ReportSummary;
  analytics: AnalyticsBlock;
}

const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
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

export default function ReportsClient() {
  const { data: session, isPending } = useSession();
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [range, setRange] = useState<ReportRange>("30d");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const loadReport = useCallback(
    async (childId: string) => {
      if (!childId) {
        setReport(null);
        return;
      }

      setReportLoading(true);
      setReportError(null);

      try {
        const response = await fetch(
          `/api/reports/analytics?childProfileId=${childId}&range=${range}`,
          {
            cache: "no-store",
          },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error?.message || "Could not load report",
          );
        }

        setReport((data?.report || null) as AnalyticsReport | null);
      } catch (error: unknown) {
        setReport(null);
        setReportError(
          error instanceof Error ? error.message : "Could not load report",
        );
      } finally {
        setReportLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    const loadChildProfiles = async () => {
      setChildrenLoading(true);
      setChildrenError(null);

      try {
        const response = await fetch("/api/child-profiles", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error?.message || "Could not load child profiles",
          );
        }

        if (cancelled) return;

        const profiles = (data?.childProfiles || []) as ChildProfile[];
        setChildProfiles(profiles);
        setSelectedChildId((current) => {
          if (current && profiles.some((profile) => profile.id === current)) {
            return current;
          }
          return (
            profiles.find((profile) => profile.isDefault)?.id ||
            profiles[0]?.id ||
            ""
          );
        });
      } catch (error: unknown) {
        if (cancelled) return;
        setChildrenError(
          error instanceof Error
            ? error.message
            : "Could not load child profiles",
        );
      } finally {
        if (!cancelled) setChildrenLoading(false);
      }
    };

    void loadChildProfiles();

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user || !selectedChildId) return;
    void loadReport(selectedChildId);
  }, [loadReport, selectedChildId, session?.user]);

  const summaryExportHref = useMemo(() => {
    if (!selectedChildId) return "#";
    const params = new URLSearchParams({
      childProfileId: selectedChildId,
      range,
      format: "csv",
    });
    return `/api/reports/summary?${params.toString()}`;
  }, [range, selectedChildId]);

  const analyticsExportHref = useMemo(() => {
    if (!selectedChildId) return "#";
    const params = new URLSearchParams({
      childProfileId: selectedChildId,
      range,
      format: "csv",
    });
    return `/api/reports/analytics?${params.toString()}`;
  }, [range, selectedChildId]);

  const summary = report?.summary ?? null;
  const analytics = report?.analytics ?? null;

  if (isPending) {
    return (
      <FullscreenMessage
        title="Loading reports…"
        subtitle="Checking your session."
      />
    );
  }

  if (!session?.user) {
    return (
      <FullscreenMessage
        title="Sign in to view reports"
        subtitle="Reports are only available to the parent account that owns the child profile."
        action={
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:scale-[1.02]"
          >
            Go to sign in
          </Link>
        }
      />
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#2b1c44,transparent_35%),linear-gradient(180deg,#11111a_0%,#09090f_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/library"
                className="text-sm font-medium text-white/70 transition hover:text-white"
              >
                ← Back to library
              </Link>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Reading reports
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Review reading volume, comprehension, and practice mode habits
                for your child. Export a CSV anytime for sharing or record
                keeping.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={summaryExportHref}
                download
                aria-disabled={!selectedChildId}
                data-testid="export-summary-csv"
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${selectedChildId ? "bg-white text-zinc-900 hover:scale-[1.02]" : "cursor-not-allowed bg-white/10 text-white/50"}`}
              >
                Export summary CSV
              </a>
              <a
                href={analyticsExportHref}
                download
                aria-disabled={!selectedChildId}
                data-testid="export-analytics-csv"
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${selectedChildId ? "border border-white/20 bg-white/10 text-white hover:bg-white/20" : "cursor-not-allowed border border-white/10 bg-white/5 text-white/40"}`}
              >
                Export analytics CSV
              </a>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-white/80">
                Child profile
                <select
                  value={selectedChildId}
                  onChange={(event) => setSelectedChildId(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-white outline-none transition focus:border-white/40"
                  disabled={childrenLoading || childProfiles.length === 0}
                >
                  {childProfiles.length === 0 ? (
                    <option value="">No child profiles yet</option>
                  ) : (
                    childProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                        {profile.ageBand ? ` · ${profile.ageBand}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="flex flex-col gap-2 text-sm font-medium text-white/80">
                <span>Time range</span>
                <div className="flex flex-wrap gap-2">
                  {RANGE_OPTIONS.map((option) => {
                    const active = range === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRange(option.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-white text-zinc-950" : "bg-white/10 text-white hover:bg-white/20"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!selectedChildId) return;
                void loadReport(selectedChildId);
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Refresh
            </button>
          </section>

          {childrenError ? (
            <InlineAlert
              title="Could not load child profiles"
              message={childrenError}
            />
          ) : null}
        </header>

        {childrenLoading ? (
          <Panel>
            <LoadingState label="Loading child profiles…" />
          </Panel>
        ) : childProfiles.length === 0 ? (
          <Panel>
            <EmptyState
              title="No child profiles yet"
              subtitle="Create a child profile first, then come back here to review progress and export reports."
            />
          </Panel>
        ) : reportLoading ? (
          <Panel>
            <LoadingState label="Building report…" />
          </Panel>
        ) : reportError ? (
          <Panel>
            <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
              <InlineAlert
                title="Could not load report"
                message={reportError}
              />
              <button
                type="button"
                onClick={() => {
                  if (!selectedChildId) return;
                  void loadReport(selectedChildId);
                }}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Try again
              </button>
            </div>
          </Panel>
        ) : summary ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Reading minutes"
                value={`${summary.totalReadingMinutes}m`}
                helper={`${summary.totalSessions} sessions`}
              />
              <MetricCard
                label="Average session"
                value={`${summary.averageSessionMinutes}m`}
                helper={`${summary.booksCompleted} books completed`}
              />
              <MetricCard
                label="Comprehension score"
                value={`${summary.averageComprehensionScore}%`}
                helper={`${summary.comprehensionAttempts} attempts`}
              />
              <MetricCard
                label="Books started"
                value={`${summary.booksStarted}`}
                helper="Distinct books opened"
              />
              <MetricCard
                label="Practice rate"
                value={`${summary.practiceSessionRatePercent}%`}
                helper={`${summary.practiceSessions} sessions · ${summary.practiceMinutes}m`}
              />
              {summary.narrationSessionRatePercent != null ? (
                <MetricCard
                  label="Narration rate"
                  value={`${summary.narrationSessionRatePercent}%`}
                  helper={`${summary.narrationSessions ?? 0} sessions · ${summary.narrationMinutes ?? 0}m`}
                />
              ) : null}
            </section>

            {summary.dailySeries && summary.dailySeries.length > 0 ? (
              <Panel>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl font-bold">Daily activity</h2>
                  <span className="text-xs text-white/50">
                    Reading minutes per day
                  </span>
                </div>
                <Sparkline series={summary.dailySeries} />
              </Panel>
            ) : null}

            {summary.sourceBreakdown && summary.sourceBreakdown.length > 0 ? (
              <Panel>
                <h2 className="text-xl font-bold">Where reading happens</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {summary.sourceBreakdown.map((row) => (
                    <SourcePill key={row.source} row={row} />
                  ))}
                </div>
              </Panel>
            ) : null}

            {summary.perBook && summary.perBook.length > 0 ? (
              <Panel>
                <h2 className="text-xl font-bold">Books read this period</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-white/50">
                      <tr>
                        <th className="pb-3 font-semibold">Book</th>
                        <th className="pb-3 font-semibold">Sessions</th>
                        <th className="pb-3 font-semibold">Minutes</th>
                        <th className="pb-3 font-semibold">Last read</th>
                        <th className="pb-3 font-semibold">Progress</th>
                        <th className="pb-3 font-semibold">Re-reads</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {summary.perBook.map((book) => (
                        <tr key={book.bookId} className="text-white/80">
                          <td className="py-3 pr-4 font-medium text-white">
                            {book.title || `Book ${book.bookId}`}
                            {book.completed ? (
                              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                                Done
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4">{book.sessions}</td>
                          <td className="py-3 pr-4">{book.minutes}m</td>
                          <td className="py-3 pr-4">{formatRelative(book.lastReadAt)}</td>
                          <td className="py-3 pr-4">
                            <ProgressBar
                              currentPage={book.currentPage}
                              totalPages={book.totalPages}
                            />
                          </td>
                          <td className="py-3 pr-4">{book.completionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Panel>
                <h2 className="text-xl font-bold">Practice summary</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Practice mode was used in{" "}
                  <span className="font-semibold text-white">
                    {summary.practiceSessionRatePercent}%
                  </span>{" "}
                  of sessions during this period, adding up to{" "}
                  <span className="font-semibold text-white">
                    {summary.practiceMinutes} minutes
                  </span>{" "}
                  of guided spoken reading.
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300 transition-all"
                    style={{
                      width: `${Math.max(6, summary.practiceSessionRatePercent)}%`,
                    }}
                  />
                </div>
                <p className="mt-4 text-sm leading-6 text-white/70">
                  {summary.practiceSessions === 0
                    ? "Practice mode has not been used yet. Try it during read-aloud time to support confidence and fluency."
                    : "Practice mode is active in your routine. Pair it with comprehension prompts to reinforce understanding after reading."}
                </p>
              </Panel>

              <Panel>
                <h2 className="text-xl font-bold">What this period shows</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
                  <li>
                    • {summary.totalSessions} total reading sessions logged.
                  </li>
                  <li>
                    • {summary.booksCompleted} books completed and{" "}
                    {summary.booksStarted} started.
                  </li>
                  <li>
                    • {summary.comprehensionAttempts} comprehension answers
                    submitted.
                  </li>
                  <li>
                    • Average reading session length:{" "}
                    {summary.averageSessionMinutes} minutes.
                  </li>
                </ul>
              </Panel>
            </section>

            {analytics ? (
              <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <Panel>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xl font-bold">Events captured</h2>
                    <span className="text-xs text-white/50">
                      {analytics.totalEvents} total · {analytics.uniqueEventNames} unique
                    </span>
                  </div>
                  {analytics.eventsByName.length === 0 ? (
                    <p className="mt-4 text-sm text-white/60">
                      No analytics events captured yet.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase tracking-wide text-white/50">
                          <tr>
                            <th className="pb-3 font-semibold">Event</th>
                            <th className="pb-3 font-semibold">Count</th>
                            <th className="pb-3 font-semibold">Last seen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analytics.eventsByName.map((row) => (
                            <tr key={row.eventName} className="text-white/80">
                              <td className="py-3 pr-4 font-mono text-xs text-white">
                                {row.eventName}
                              </td>
                              <td className="py-3 pr-4">{row.count}</td>
                              <td className="py-3 pr-4">
                                {formatRelative(row.lastOccurredAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <h2 className="text-xl font-bold">Recent activity</h2>
                  {analytics.recentEvents.length === 0 ? (
                    <p className="mt-4 text-sm text-white/60">
                      No recent activity yet.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {analytics.recentEvents.slice(0, 25).map((event) => (
                        <li
                          key={event.id}
                          className="rounded-2xl border border-white/5 bg-zinc-950/40 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-mono text-xs text-white">
                              {event.eventName}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                              {event.source}
                            </span>
                            <span className="text-xs text-white/50">
                              {formatRelative(event.occurredAt)}
                            </span>
                          </div>
                          {event.properties &&
                          Object.keys(event.properties).length > 0 ? (
                            <details className="mt-2 text-xs text-white/65">
                              <summary className="cursor-pointer select-none">
                                Properties
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-2 font-mono text-xs">
                                {JSON.stringify(event.properties, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </section>
            ) : null}
          </>
        ) : (
          <Panel>
            <EmptyState
              title="No summary yet"
              subtitle="Read a story to start collecting progress insights."
            />
          </Panel>
        )}
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
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
    <section className="rounded-[1.75rem] border border-white/10 bg-zinc-950/60 p-5 shadow-xl">
      <p className="text-sm font-medium text-white/65">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-white/65">{helper}</p>
    </section>
  );
}

function InlineAlert({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-rose-100/80">{message}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-center text-white/75">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <p>{label}</p>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
        {subtitle}
      </p>
    </div>
  );
}

function FullscreenMessage({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">{subtitle}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </main>
  );
}

function SourcePill({ row }: { row: SourceBreakdownRow }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
      <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
      <span className="font-semibold capitalize text-white">{row.source}</span>
      <span>·</span>
      <span>{row.sessions} sessions</span>
      <span>·</span>
      <span>{row.minutes}m</span>
    </div>
  );
}

function ProgressBar({
  currentPage,
  totalPages,
}: {
  currentPage: number | null;
  totalPages: number | null;
}) {
  if (currentPage == null || totalPages == null || totalPages <= 0) {
    return <span className="text-xs text-white/40">—</span>;
  }
  const pct = Math.min(100, Math.max(0, (currentPage / totalPages) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-amber-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/60">
        {currentPage}/{totalPages}
      </span>
    </div>
  );
}

function Sparkline({ series }: { series: DailySeriesRow[] }) {
  if (series.length === 0) {
    return <p className="mt-4 text-sm text-white/60">No daily data.</p>;
  }
  const max = Math.max(1, ...series.map((row) => row.minutes));
  const totalMinutes = series.reduce((sum, row) => sum + row.minutes, 0);
  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={`Daily reading minutes for ${series.length} days, ${totalMinutes} minutes total`}
        className="flex h-24 items-end gap-1"
      >
        {series.map((row) => {
          const heightPct = max > 0 ? (row.minutes / max) * 100 : 0;
          return (
            <div
              key={row.date}
              className="flex-1 rounded-t bg-gradient-to-t from-fuchsia-500/40 to-amber-300/80"
              style={{
                minHeight: row.minutes > 0 ? "2px" : "1px",
                height: `${Math.max(heightPct, row.minutes > 0 ? 4 : 1)}%`,
                opacity: row.minutes > 0 ? 1 : 0.25,
              }}
              title={`${row.date}: ${row.minutes}m · ${row.sessions} sessions`}
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

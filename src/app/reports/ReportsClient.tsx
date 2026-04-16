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
}

const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export default function ReportsClient() {
  const { data: session, isPending } = useSession();
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [range, setRange] = useState<ReportRange>("30d");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (childId: string) => {
      if (!childId) {
        setSummary(null);
        return;
      }

      setSummaryLoading(true);
      setSummaryError(null);

      try {
        const response = await fetch(
          `/api/reports/summary?childProfileId=${childId}&range=${range}`,
          {
            cache: "no-store",
          },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error?.message || "Could not load report summary",
          );
        }

        setSummary((data?.summary || null) as ReportSummary | null);
      } catch (error: unknown) {
        setSummary(null);
        setSummaryError(
          error instanceof Error
            ? error.message
            : "Could not load report summary",
        );
      } finally {
        setSummaryLoading(false);
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
    void loadSummary(selectedChildId);
  }, [loadSummary, selectedChildId, session?.user]);

  const exportHref = useMemo(() => {
    if (!selectedChildId) return "#";
    const params = new URLSearchParams({
      childProfileId: selectedChildId,
      range,
      format: "csv",
    });
    return `/api/reports/summary?${params.toString()}`;
  }, [range, selectedChildId]);

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
            <a
              href={exportHref}
              download
              aria-disabled={!selectedChildId}
              className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${selectedChildId ? "bg-white text-zinc-900 hover:scale-[1.02]" : "cursor-not-allowed bg-white/10 text-white/50"}`}
            >
              Export CSV
            </a>
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
                void loadSummary(selectedChildId);
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Refresh summary
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
        ) : summaryLoading ? (
          <Panel>
            <LoadingState label="Building report summary…" />
          </Panel>
        ) : summaryError ? (
          <Panel>
            <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
              <InlineAlert
                title="Could not load report summary"
                message={summaryError}
              />
              <button
                type="button"
                onClick={() => {
                  if (!selectedChildId) return;
                  void loadSummary(selectedChildId);
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
                label="Practice sessions"
                value={`${summary.practiceSessions}`}
                helper={`${summary.practiceMinutes} minutes total`}
              />
              <MetricCard
                label="Practice rate"
                value={`${summary.practiceSessionRatePercent}%`}
                helper="Sessions that used practice mode"
              />
            </section>

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

"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Loader2,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  useGenerateBookPronunciations,
  usePronunciationCoverage,
  type PronunciationCoverageRow,
  type VoiceSettings,
} from "@/hooks/useBookData";

const statusStyles: Record<NonNullable<PronunciationCoverageRow["status"]>, string> = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  missing: "border-rose-200 bg-rose-50 text-rose-700",
  empty: "border-slate-200 bg-slate-100 text-slate-500",
};

const statusLabels: Record<NonNullable<PronunciationCoverageRow["status"]>, string> = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
  empty: "No text",
};

export function PronunciationPanel({
  bookId,
  selectedVoiceId,
  voiceSettings,
}: {
  bookId: string;
  selectedVoiceId: string;
  voiceSettings: VoiceSettings;
}) {
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const coverageQuery = usePronunciationCoverage(bookId);
  const generateMutation = useGenerateBookPronunciations(bookId);

  const latestRun = generateMutation.data;
  const displayCoverage = latestRun?.coverage ?? coverageQuery.data?.coverage;
  const displaySummary = latestRun?.summary ?? coverageQuery.data?.summary;

  const pagesNeedingReview = useMemo(() => {
    return (displayCoverage?.perPage ?? [])
      .filter((page) => page.status !== "complete" && page.status !== "empty")
      .sort((left, right) => {
        if (right.missing !== left.missing) return right.missing - left.missing;
        return left.pageNumber - right.pageNumber;
      })
      .slice(0, 3);
  }, [displayCoverage]);

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({
      voice: selectedVoiceId || undefined,
      voiceSettings,
      force: forceRegenerate,
    });
  };

  const statusTone = generateMutation.isError
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : latestRun
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : coverageQuery.isError
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-violet-200 bg-white/70 text-slate-600";

  const coveragePercent = displaySummary
    ? `${Math.round(displaySummary.ratio * 100)}%`
    : "—";

  return (
    <section className="space-y-3" aria-labelledby="pronunciation-panel-heading">
      <h4
        id="pronunciation-panel-heading"
        className="text-xs font-bold uppercase tracking-wider text-slate-400"
      >
        Word Pronunciations
      </h4>

      <div className="space-y-4 rounded-xl border border-violet-200 bg-linear-to-br from-violet-50 to-fuchsia-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-violet-700">
              <Wand2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Generate pronunciation help</span>
            </div>
            <p className="text-xs leading-5 text-slate-600">
              Build or refresh whole-word and breakdown clips for this book using the
              current narration voice selection.
            </p>
          </div>
          <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">
            Book-wide
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MetricCard
            label="Coverage"
            value={coveragePercent}
            helper={
              displaySummary
                ? `${displaySummary.coveredBookWide}/${displaySummary.uniqueBookTokens} words ready`
                : "Loading report"
            }
          />
          <MetricCard
            label="Pages ready"
            value={displaySummary ? String(displaySummary.pagesComplete) : "—"}
            helper={
              displaySummary
                ? `${displaySummary.pagesWithMissing} still need review`
                : "Loading report"
            }
          />
          <MetricCard
            label={latestRun ? "Generated" : "Book status"}
            value={
              latestRun
                ? String(latestRun.stats.generated)
                : displaySummary?.fullCoverage
                  ? "Ready"
                  : "Open"
            }
            helper={
              latestRun
                ? `${latestRun.stats.withBreakdown} with breakdown`
                : displaySummary?.fullCoverage
                  ? "All book tokens covered"
                  : displaySummary
                    ? `${displaySummary.missingBookWide} words still missing`
                    : "Loading report"
            }
          />
        </div>

        {pagesNeedingReview.length > 0 ? (
          <div className="rounded-lg border border-violet-200/80 bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              Top pages to review
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              {pagesNeedingReview.map((page) => (
                <div
                  key={page.pageId}
                  className="rounded-md border border-violet-100 bg-white px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">Page {page.pageNumber}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusStyles[page.status ?? "partial"]}`}
                    >
                      {statusLabels[page.status ?? "partial"]}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {page.missing > 0
                      ? `${page.missing} missing · ${page.fullWordOnly ?? 0} full-word only`
                      : `${page.fullWordOnly ?? 0} words still need breakdown audio`}
                  </div>
                  {page.missingWords && page.missingWords.length > 0 ? (
                    <div className="mt-1.5 line-clamp-2 text-[11px] text-slate-500">
                      Missing: {page.missingWords.slice(0, 4).join(", ")}
                      {page.missingWords.length > 4 ? "…" : ""}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : displaySummary?.fullCoverage ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800">
            All currently tokenized words have both whole-word and breakdown pronunciation coverage.
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-lg border border-violet-200/80 bg-white/80 p-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={forceRegenerate}
            onChange={(event) => setForceRegenerate(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="space-y-1">
            <span className="block font-medium text-slate-800">Regenerate existing pronunciations</span>
            <span className="block text-slate-500">
              Off = only fill missing words. On = rebuild all current pronunciation entries for this book.
            </span>
          </span>
        </label>

        <div aria-live="polite" className={`rounded-lg border p-3 text-xs ${statusTone}`}>
          {generateMutation.isPending ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {forceRegenerate
                  ? "Regenerating pronunciation assets for the whole book…"
                  : "Generating missing pronunciation assets…"}
              </span>
            </div>
          ) : generateMutation.isError ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{generateMutation.error.message}</span>
            </div>
          ) : latestRun ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {latestRun.summary.fullCoverage
                    ? "Pronunciation coverage is now complete for this book."
                    : latestRun.force
                      ? "Full pronunciation regeneration complete."
                      : "Missing pronunciations generated."}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <RunMetric label="Generated" value={latestRun.stats.generated} />
                <RunMetric label="Failed" value={latestRun.stats.failed} />
                <RunMetric label="Skipped" value={latestRun.stats.skippedExisting} />
              </div>
              <div className="rounded-md border border-emerald-200/80 bg-white/80 px-2.5 py-2 text-[11px] text-emerald-900">
                <div>
                  {latestRun.summary.coveredBookWide}/{latestRun.summary.uniqueBookTokens} words covered across the book.
                  {latestRun.summary.remainingTokensAfterRun > 0
                    ? ` ${latestRun.summary.remainingTokensAfterRun} still missing.`
                    : " No missing words remain."}
                </div>
                {latestRun.summary.limitedByMaxWords ? (
                  <div className="mt-1 font-medium text-emerald-800">
                    This run was capped at {latestRun.request.maxWords} words.
                  </div>
                ) : null}
              </div>
            </div>
          ) : coverageQuery.isError ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{coverageQuery.error.message}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CircleDot className="h-4 w-4" />
              <span>
                {displaySummary
                  ? displaySummary.fullCoverage
                    ? "Coverage report loaded. Pronunciation help is complete for this book."
                    : `${displaySummary.missingBookWide} book-wide words are still missing pronunciation help.`
                  : "Loading pronunciation coverage report…"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => coverageQuery.refetch()}
            disabled={coverageQuery.isFetching || generateMutation.isPending}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${coverageQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh report
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateMutation.isPending || coverageQuery.isLoading}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {forceRegenerate ? "Regenerate all pronunciations" : "Generate missing pronunciations"}
          </button>
        </div>
      </div>
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
    <div className="rounded-lg border border-violet-200/80 bg-white/80 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-800">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{helper}</div>
    </div>
  );
}

function RunMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-white/80 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-emerald-900">{value}</div>
    </div>
  );
}

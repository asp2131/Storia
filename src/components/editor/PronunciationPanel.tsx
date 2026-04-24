"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  useGenerateBookPronunciations,
  usePronunciationCoverage,
  usePronunciationReview,
  type PronunciationCoverageRow,
  type PronunciationReviewCoverageStatus,
  type PronunciationReviewRow,
  type PronunciationReviewStatus,
  type VoiceSettings,
} from "@/hooks/useBookData";

type ReviewFilter = "all" | PronunciationReviewStatus;
type CoverageFilter = "all" | PronunciationReviewCoverageStatus;

const pageStatusDot: Record<NonNullable<PronunciationCoverageRow["status"]>, string> = {
  complete: "bg-emerald-500",
  partial: "bg-amber-500",
  missing: "bg-rose-500",
  empty: "bg-slate-300",
};

const pageStatusText: Record<NonNullable<PronunciationCoverageRow["status"]>, string> = {
  complete: "text-emerald-700",
  partial: "text-amber-700",
  missing: "text-rose-700",
  empty: "text-slate-500",
};

const statusLabels: Record<NonNullable<PronunciationCoverageRow["status"]>, string> = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
  empty: "No text",
};

const reviewStatusLabel: Record<PronunciationReviewStatus, string> = {
  missing: "Missing",
  failed: "Failed",
  generated: "Generated",
  reviewed: "Reviewed",
};

const reviewStatusDot: Record<PronunciationReviewStatus, string> = {
  missing: "bg-rose-500",
  failed: "bg-amber-500",
  generated: "bg-indigo-500",
  reviewed: "bg-emerald-500",
};

const coverageLabel: Record<PronunciationReviewCoverageStatus, string> = {
  missing: "Missing audio",
  "full-word-only": "Full word only",
  covered: "Covered",
};

const coverageBadge: Record<PronunciationReviewCoverageStatus, string> = {
  missing: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  "full-word-only": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  covered: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
};

function formatGeneratedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

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
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageNumberFilter, setPageNumberFilter] = useState("");
  const [previewingUrl, setPreviewingUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const coverageQuery = usePronunciationCoverage(bookId);
  const generateMutation = useGenerateBookPronunciations(bookId);
  const reviewQuery = usePronunciationReview(bookId, {
    search: searchQuery.trim() || undefined,
    pageNumber:
      pageNumberFilter.trim().length > 0 ? Number(pageNumberFilter.trim()) || undefined : undefined,
    coverageStatus: coverageFilter === "all" ? undefined : coverageFilter,
    reviewStatus: reviewFilter === "all" ? undefined : reviewFilter,
    limit: 100,
    offset: 0,
  });
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const latestRun = generateMutation.data;
  const displayCoverage = latestRun?.coverage ?? coverageQuery.data?.coverage;
  const displaySummary = latestRun?.summary ?? coverageQuery.data?.summary;
  const reviewItems = reviewQuery.data?.review.items ?? [];
  const reviewSummary = reviewQuery.data?.review.summary;

  const pagesNeedingReview = useMemo(() => {
    return (displayCoverage?.perPage ?? [])
      .filter((page) => page.status !== "complete" && page.status !== "empty")
      .sort((left, right) => {
        if (right.missing !== left.missing) return right.missing - left.missing;
        return left.pageNumber - right.pageNumber;
      })
      .slice(0, 3);
  }, [displayCoverage]);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
    };
  }, []);

  const handlePreviewAudio = async (url: string) => {
    if (previewingUrl === url && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setPreviewingUrl(null);
      return;
    }

    previewAudioRef.current?.pause();
    setPreviewError(null);

    const audio = new Audio(url);
    audio.onended = () => setPreviewingUrl((current) => (current === url ? null : current));
    audio.onerror = () => {
      setPreviewingUrl(null);
      setPreviewError(`Preview failed for ${url}`);
    };
    previewAudioRef.current = audio;
    setPreviewingUrl(url);

    try {
      await audio.play();
    } catch {
      setPreviewingUrl(null);
      setPreviewError(`Preview failed for ${url}`);
    }
  };

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({
      voice: selectedVoiceId || undefined,
      voiceSettings,
      force: forceRegenerate,
    });
  };

  const coveragePct = displaySummary ? Math.round(displaySummary.ratio * 100) : null;
  const isFetching = coverageQuery.isFetching || reviewQuery.isFetching;

  const reviewCounts = useMemo(() => {
    const total = reviewSummary?.totalWords ?? 0;
    return [
      { id: "all" as const, label: "All", count: total },
      { id: "missing" as const, label: "Missing", count: reviewSummary?.missingWords ?? 0 },
      { id: "failed" as const, label: "Failed", count: reviewSummary?.failedWords ?? 0 },
      { id: "generated" as const, label: "Generated", count: reviewSummary?.generatedWords ?? 0 },
      { id: "reviewed" as const, label: "Reviewed", count: reviewSummary?.reviewedWords ?? 0 },
    ];
  }, [reviewSummary]);

  return (
    <section className="space-y-3" aria-labelledby="pronunciation-panel-heading">
      <div className="flex items-center justify-between">
        <h4
          id="pronunciation-panel-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
        >
          Word Pronunciations
        </h4>
        <button
          type="button"
          onClick={() => {
            coverageQuery.refetch();
            reviewQuery.refetch();
          }}
          disabled={isFetching || generateMutation.isPending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh report"
        >
          <RefreshCcw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh report
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Hero: coverage */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-4 py-4">
          <CoverageRing percent={coveragePct} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
              <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
              Generate pronunciation help
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Build whole-word and breakdown clips using the current narration voice.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <span>
                <span className="font-semibold text-slate-900">
                  {displaySummary
                    ? `${displaySummary.coveredBookWide}/${displaySummary.uniqueBookTokens}`
                    : "—"}
                </span>{" "}
                words ready
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <span className="font-semibold text-slate-900">
                  {displaySummary?.pagesComplete ?? "—"}
                </span>{" "}
                pages ready
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">
                {displaySummary ? `${displaySummary.pagesWithMissing} still need review` : "Loading"}
              </span>
            </div>
          </div>
        </div>

        {/* Status banner — single source */}
        <StatusBanner
          state={
            generateMutation.isPending
              ? {
                  kind: "loading",
                  message: forceRegenerate
                    ? "Regenerating pronunciation assets for the whole book…"
                    : "Generating missing pronunciation assets…",
                }
              : generateMutation.isError
                ? { kind: "error", message: generateMutation.error.message }
                : latestRun
                  ? {
                      kind: "success",
                      message: latestRun.summary.fullCoverage
                        ? "Pronunciation coverage is now complete for this book."
                        : latestRun.force
                          ? "Full pronunciation regeneration complete."
                          : "Missing pronunciations generated.",
                      detail: `${latestRun.summary.coveredBookWide}/${latestRun.summary.uniqueBookTokens} words covered across the book.${
                        latestRun.summary.remainingTokensAfterRun > 0
                          ? ` ${latestRun.summary.remainingTokensAfterRun} still missing.`
                          : " No missing words remain."
                      }`,
                      capped: latestRun.summary.limitedByMaxWords
                        ? `This run was capped at ${latestRun.request.maxWords} words.`
                        : null,
                      stats: [
                        { label: "Generated", value: latestRun.stats.generated },
                        { label: "Failed", value: latestRun.stats.failed },
                        { label: "Skipped", value: latestRun.stats.skippedExisting },
                      ],
                    }
                  : coverageQuery.isError
                    ? { kind: "error", message: coverageQuery.error.message }
                    : displaySummary
                      ? displaySummary.fullCoverage
                        ? { kind: "idle-ok", message: "Pronunciation help is complete for this book." }
                        : { kind: "idle-warn", message: `${displaySummary.missingBookWide} words still missing` }
                      : { kind: "idle", message: "Loading pronunciation coverage report…" }
          }
        />

        {/* Top pages to review */}
        {pagesNeedingReview.length > 0 ? (
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              Top pages to review
            </div>
            <ul className="space-y-1.5">
              {pagesNeedingReview.map((page) => (
                <li
                  key={page.pageId}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${pageStatusDot[page.status ?? "partial"]}`}
                      />
                      <span className="font-medium text-slate-800">Page {page.pageNumber}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${pageStatusText[page.status ?? "partial"]}`}
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
                    <div className="mt-1 truncate text-[11px] text-slate-400">
                      Missing: {page.missingWords.slice(0, 4).join(", ")}
                      {page.missingWords.length > 4 ? "…" : ""}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Force regenerate toggle */}
        <label className="flex cursor-pointer items-start gap-2.5 border-b border-slate-100 px-4 py-3 text-xs text-slate-700 transition hover:bg-slate-50/70">
          <input
            type="checkbox"
            checked={forceRegenerate}
            onChange={(event) => setForceRegenerate(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="space-y-0.5">
            <span className="block font-medium text-slate-800">
              Regenerate existing pronunciations
            </span>
            <span className="block text-[11px] leading-snug text-slate-500">
              Off = only fill missing words. On = rebuild every entry for this book.
            </span>
          </span>
        </label>

        {/* Per-word review */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h5 className="text-[13px] font-semibold text-slate-900">Per-word review</h5>
            <span className="text-[11px] text-slate-500">
              {reviewQuery.isLoading
                ? "Loading…"
                : `${reviewItems.length} of ${reviewQuery.data?.review.filteredTotal ?? 0}`}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Search words, inspect review metadata, and preview full-word or breakdown clips.
          </p>

          {/* Filters */}
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search a word"
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
                aria-label="Search pronunciation words"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
                <span className="font-medium text-slate-700">Page</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pageNumberFilter}
                  onChange={(event) =>
                    setPageNumberFilter(event.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Any"
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  aria-label="Filter pronunciation review by page"
                />
              </label>
              <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
                <span className="font-medium text-slate-700">Coverage</span>
                <select
                  value={coverageFilter}
                  onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}
                  className="w-full cursor-pointer bg-transparent outline-none"
                  aria-label="Filter pronunciation review by coverage"
                >
                  <option value="all">All</option>
                  <option value="covered">Covered</option>
                  <option value="full-word-only">Full word only</option>
                  <option value="missing">Missing</option>
                </select>
              </label>
            </div>

            {/* Review status segmented chips */}
            <div className="flex flex-wrap gap-1" role="group" aria-label="Review status quick filter">
              {reviewCounts.map((chip) => {
                const active = reviewFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setReviewFilter(chip.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {chip.label}
                    <span
                      className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                        active ? "bg-white/20" : "bg-white text-slate-600"
                      }`}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hidden native select to keep filter-by-status accessible by label for tests/AT */}
            <select
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}
              aria-label="Filter pronunciation review by status"
              className="sr-only"
              tabIndex={-1}
            >
              <option value="all">All</option>
              <option value="reviewed">Reviewed</option>
              <option value="generated">Generated</option>
              <option value="failed">Failed</option>
              <option value="missing">Missing</option>
            </select>
          </div>

          {/* Word rows */}
          <div className="mt-3 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {reviewQuery.isLoading ? (
              <EmptyState message="Loading pronunciation review words…" />
            ) : reviewQuery.isError ? (
              <EmptyState tone="error" message={reviewQuery.error.message} />
            ) : reviewItems.length === 0 ? (
              <EmptyState message="No words match the current search/filter." />
            ) : (
              reviewItems.map((row) => (
                <ReviewRow
                  key={row.normalizedWord}
                  row={row}
                  previewingUrl={previewingUrl}
                  onPreview={handlePreviewAudio}
                />
              ))
            )}
          </div>

          {previewError ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 ring-1 ring-inset ring-amber-200">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{previewError}</span>
            </div>
          ) : null}
        </div>

        {/* Sticky CTA */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateMutation.isPending || coverageQuery.isLoading}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
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

function CoverageRing({ percent }: { percent: number | null }) {
  const value = percent ?? 0;
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  const tone =
    percent === null
      ? "stroke-slate-300"
      : value === 100
        ? "stroke-emerald-500"
        : value >= 60
          ? "stroke-indigo-500"
          : "stroke-amber-500";

  return (
    <div className="relative shrink-0" aria-hidden>
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle
          cx="28"
          cy="28"
          r={radius}
          strokeWidth="5"
          className="fill-none stroke-slate-100"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={`fill-none transition-[stroke-dashoffset] duration-500 ${tone}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums text-slate-900">
        {percent === null ? "—" : `${percent}%`}
      </div>
    </div>
  );
}

type BannerState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "idle"; message: string }
  | { kind: "idle-ok"; message: string }
  | { kind: "idle-warn"; message: string }
  | {
      kind: "success";
      message: string;
      detail: string;
      capped: string | null;
      stats: { label: string; value: number }[];
    };

function StatusBanner({ state }: { state: BannerState }) {
  const tone =
    state.kind === "error"
      ? "bg-rose-50 text-rose-800 ring-rose-200"
      : state.kind === "success"
        ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
        : state.kind === "idle-warn"
          ? "bg-amber-50 text-amber-800 ring-amber-200"
          : state.kind === "idle-ok"
            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
            : "bg-slate-50 text-slate-700 ring-slate-200";

  const Icon =
    state.kind === "loading"
      ? Loader2
      : state.kind === "error"
        ? AlertCircle
        : state.kind === "success" || state.kind === "idle-ok"
          ? CheckCircle2
          : AlertCircle;

  return (
    <div
      aria-live="polite"
      className={`mx-4 my-3 rounded-lg px-3 py-2.5 text-xs ring-1 ring-inset ${tone}`}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${state.kind === "loading" ? "animate-spin" : ""}`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="font-medium leading-snug">{state.message}</div>
          {state.kind === "success" ? (
            <>
              <div className="text-[11px] leading-snug text-emerald-800/90">{state.detail}</div>
              {state.capped ? (
                <div className="text-[11px] font-medium text-emerald-800">{state.capped}</div>
              ) : null}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {state.stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-md bg-white/70 px-2 py-1 ring-1 ring-inset ring-emerald-200"
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
                      {s.label}
                    </div>
                    <div className="text-sm font-bold tabular-nums text-emerald-900">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  row,
  previewingUrl,
  onPreview,
}: {
  row: PronunciationReviewRow;
  previewingUrl: string | null;
  onPreview: (url: string) => Promise<void>;
}) {
  const generatedAtLabel = formatGeneratedAt(row.generatedAt);
  const fullPlaying = previewingUrl === row.audio.fullWord;
  const breakPlaying = previewingUrl === row.audio.breakdown;

  return (
    <article className="px-3 py-2.5 transition hover:bg-slate-50/70">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900">
              {row.displayWord}
            </span>
            <span className="text-[10px] tabular-nums text-slate-400">×{row.occurrences}</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${coverageBadge[row.coverageStatus]}`}
            >
              {coverageLabel[row.coverageStatus]}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${reviewStatusDot[row.reviewStatus]}`} />
              {reviewStatusLabel[row.reviewStatus]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-500">
            <span>Pages {row.pageNumbers.join(", ")}</span>
            {row.source ? (
              <>
                <Sep />
                <span>Source {row.source}</span>
              </>
            ) : null}
            {typeof row.confidence === "number" ? (
              <>
                <Sep />
                <span>Confidence {Math.round(row.confidence * 100)}%</span>
              </>
            ) : null}
            {row.status ? (
              <>
                <Sep />
                <span>Entry {row.status}</span>
              </>
            ) : null}
            {generatedAtLabel ? (
              <>
                <Sep />
                <span>Generated {generatedAtLabel}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <PreviewButton
            label="Whole word"
            ariaLabel={`Preview whole word ${row.displayWord}`}
            url={row.audio.fullWord}
            playing={fullPlaying}
            onPreview={onPreview}
          />
          <PreviewButton
            label="Breakdown"
            ariaLabel={`Preview breakdown ${row.displayWord}`}
            url={row.audio.breakdown}
            playing={breakPlaying}
            onPreview={onPreview}
          />
        </div>
      </div>

      <span className="sr-only">Normalized {row.normalizedWord}</span>
    </article>
  );
}

function PreviewButton({
  label,
  ariaLabel,
  url,
  playing,
  onPreview,
}: {
  label: string;
  ariaLabel: string;
  url?: string;
  playing: boolean;
  onPreview: (url: string) => Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onPreview(url)}
      className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        playing
          ? "bg-indigo-600 text-white hover:bg-indigo-700"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
      aria-label={ariaLabel}
      title={label}
    >
      {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-slate-300">
      ·
    </span>
  );
}

function EmptyState({ message, tone }: { message: string; tone?: "error" }) {
  return (
    <div
      className={`px-3 py-8 text-center text-[11px] ${
        tone === "error" ? "text-rose-700" : "text-slate-500"
      }`}
    >
      {message}
    </div>
  );
}

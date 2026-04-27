import {
  normalizePronunciationToken,
  type PronunciationBreakdownSegment,
  type PronunciationSource,
  type PronunciationStatus,
} from "@/lib/pronunciation";

export type PronunciationReviewCoverageStatus =
  | "missing"
  | "full-word-only"
  | "covered";

export type PronunciationReviewStatus =
  | "missing"
  | "generated"
  | "failed"
  | "reviewed";

export interface PronunciationReviewItem {
  normalizedWord: string;
  displayWord: string;
  occurrences: number;
  pageIds: string[];
  pageNumbers: number[];
  coverageStatus: PronunciationReviewCoverageStatus;
  reviewStatus: PronunciationReviewStatus;
  humanReviewed: boolean;
  audio: {
    fullWord?: string;
    breakdown?: string;
  };
  source?: PronunciationSource;
  confidence?: number;
  generatedAt?: string;
  status?: PronunciationStatus;
  phoneticDisplay?: string;
  syllables?: string[];
  breakdownSegments?: PronunciationBreakdownSegment[];
}

export interface PronunciationReviewSummary {
  totalWords: number;
  coveredWords: number;
  fullWordOnlyWords: number;
  missingWords: number;
  generatedWords: number;
  reviewedWords: number;
  failedWords: number;
}

export interface PronunciationReviewFilters {
  search?: string;
  pageNumber?: number;
  coverageStatus?: PronunciationReviewCoverageStatus;
  reviewStatus?: PronunciationReviewStatus;
  limit?: number;
  offset?: number;
}

export interface PronunciationReviewResult {
  items: PronunciationReviewItem[];
  filteredTotal: number;
  summary: PronunciationReviewSummary;
}

export interface PronunciationReviewPageInput {
  id: string | bigint;
  pageNumber: number;
  textContent: string | null;
}

/**
 * Shape of a row returned from `prisma.book_pronunciations.findMany` (subset of
 * fields required for review aggregation). Kept as a structural type so tests
 * can seed plain objects.
 */
export interface PronunciationReviewEntryRow {
  normalized_word: string;
  display_word?: string | null;
  full_word_url?: string | null;
  breakdown_url?: string | null;
  source?: string | null;
  status?: string | null;
  confidence?: number | null;
  human_reviewed?: boolean | null;
  generated_at?: Date | string | null;
  updated_at?: Date | string | null;
  phonetic_display?: string | null;
  syllables?: unknown;
  breakdown_segments?: unknown;
}

export interface PronunciationReviewInput {
  pages: PronunciationReviewPageInput[];
  pronunciations: PronunciationReviewEntryRow[];
}

const EDGE_PUNCTUATION_REGEX = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function toDisplayToken(token: string): string {
  return token.normalize("NFKC").trim().replace(EDGE_PUNCTUATION_REGEX, "");
}

function extractDisplayTokens(text: string): Array<{
  normalizedWord: string;
  displayWord: string;
}> {
  return text
    .split(/\s+/)
    .map((rawToken) => {
      const normalizedWord = normalizePronunciationToken(rawToken);
      const displayWord = toDisplayToken(rawToken);
      return {
        normalizedWord,
        displayWord,
      };
    })
    .filter(
      (token): token is { normalizedWord: string; displayWord: string } =>
        token.normalizedWord.length > 0 && token.displayWord.length > 0
    );
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getCoverageStatus(
  row: PronunciationReviewEntryRow | undefined
): PronunciationReviewCoverageStatus {
  if (!row) return "missing";
  const hasFull = nonEmptyString(row.full_word_url) !== undefined;
  const hasBreak = nonEmptyString(row.breakdown_url) !== undefined;
  if (hasFull && hasBreak) return "covered";
  if (hasFull || hasBreak) return "full-word-only";
  return "missing";
}

function getReviewStatus(
  row: PronunciationReviewEntryRow | undefined
): PronunciationReviewStatus {
  if (!row) return "missing";

  if (row.status === "failed") {
    return "failed";
  }

  if (
    row.human_reviewed === true ||
    row.status === "reviewed" ||
    row.source === "override"
  ) {
    return "reviewed";
  }

  const hasAudio =
    nonEmptyString(row.full_word_url) !== undefined ||
    nonEmptyString(row.breakdown_url) !== undefined;
  if (hasAudio) return "generated";

  return "missing";
}

function getReviewPriority(status: PronunciationReviewStatus): number {
  switch (status) {
    case "missing":
      return 0;
    case "failed":
      return 1;
    case "generated":
      return 2;
    case "reviewed":
      return 3;
  }
}

function getCoveragePriority(status: PronunciationReviewCoverageStatus): number {
  switch (status) {
    case "missing":
      return 0;
    case "full-word-only":
      return 1;
    case "covered":
      return 2;
  }
}

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function toReviewItem(
  normalizedWord: string,
  aggregate: {
    displayWord: string;
    occurrences: number;
    pageIds: Set<string>;
    pageNumbers: Set<number>;
    row?: PronunciationReviewEntryRow;
  }
): PronunciationReviewItem {
  const row = aggregate.row;
  const coverageStatus = getCoverageStatus(row);
  const reviewStatus = getReviewStatus(row);

  const fullWordUrl = nonEmptyString(row?.full_word_url);
  const breakdownUrl = nonEmptyString(row?.breakdown_url);

  const displayWord =
    nonEmptyString(row?.display_word) ?? aggregate.displayWord;

  const humanReviewed = row?.human_reviewed === true;

  const generatedAt =
    toIsoString(row?.generated_at) ?? toIsoString(row?.updated_at);

  const source = nonEmptyString(row?.source) as
    | PronunciationSource
    | undefined;
  const status = nonEmptyString(row?.status) as
    | PronunciationStatus
    | undefined;

  const phoneticDisplay = nonEmptyString(row?.phonetic_display);
  const syllables = Array.isArray(row?.syllables)
    ? (row?.syllables as unknown[]).map((s) => String(s)).filter((s) => s.length > 0)
    : undefined;
  const breakdownSegments = Array.isArray(row?.breakdown_segments)
    ? (row?.breakdown_segments as unknown[])
        .map((item) => {
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            const chunk = typeof obj.chunk === "string" ? obj.chunk : undefined;
            const spoken =
              typeof obj.spoken === "string" ? obj.spoken : chunk;
            if (!chunk || spoken === undefined) return null;
            const seg: PronunciationBreakdownSegment = {
              index: typeof obj.index === "number" ? obj.index : 0,
              chunk,
              spoken,
            };
            if (typeof obj.startMs === "number") seg.startMs = obj.startMs;
            if (typeof obj.endMs === "number") seg.endMs = obj.endMs;
            return seg;
          }
          if (typeof item === "string" && item.length > 0) {
            return { index: 0, chunk: item, spoken: item } as PronunciationBreakdownSegment;
          }
          return null;
        })
        .filter((s): s is PronunciationBreakdownSegment => s !== null)
        .map((seg, i) => ({ ...seg, index: typeof seg.index === "number" ? seg.index : i }))
    : undefined;

  return {
    normalizedWord,
    displayWord,
    occurrences: aggregate.occurrences,
    pageIds: Array.from(aggregate.pageIds),
    pageNumbers: Array.from(aggregate.pageNumbers).sort((a, b) => a - b),
    coverageStatus,
    reviewStatus,
    humanReviewed,
    audio: {
      ...(fullWordUrl ? { fullWord: fullWordUrl } : {}),
      ...(breakdownUrl ? { breakdown: breakdownUrl } : {}),
    },
    ...(source ? { source } : {}),
    ...(typeof row?.confidence === "number"
      ? { confidence: row.confidence }
      : {}),
    ...(generatedAt ? { generatedAt } : {}),
    ...(status ? { status } : {}),
    ...(phoneticDisplay ? { phoneticDisplay } : {}),
    ...(syllables && syllables.length > 0 ? { syllables } : {}),
    ...(breakdownSegments && breakdownSegments.length > 0
      ? { breakdownSegments }
      : {}),
  };
}

function buildSummary(items: PronunciationReviewItem[]): PronunciationReviewSummary {
  return {
    totalWords: items.length,
    coveredWords: items.filter((item) => item.coverageStatus === "covered").length,
    fullWordOnlyWords: items.filter(
      (item) => item.coverageStatus === "full-word-only"
    ).length,
    missingWords: items.filter((item) => item.coverageStatus === "missing").length,
    generatedWords: items.filter((item) => item.reviewStatus === "generated").length,
    reviewedWords: items.filter((item) => item.reviewStatus === "reviewed").length,
    failedWords: items.filter((item) => item.reviewStatus === "failed").length,
  };
}

function matchesFilters(
  item: PronunciationReviewItem,
  filters: PronunciationReviewFilters
): boolean {
  if (
    typeof filters.pageNumber === "number" &&
    !item.pageNumbers.includes(filters.pageNumber)
  ) {
    return false;
  }

  if (
    filters.coverageStatus !== undefined &&
    item.coverageStatus !== filters.coverageStatus
  ) {
    return false;
  }

  if (filters.reviewStatus !== undefined && item.reviewStatus !== filters.reviewStatus) {
    return false;
  }

  if (filters.search) {
    const query = filters.search.trim().toLowerCase();
    if (query.length > 0) {
      const haystack = `${item.normalizedWord} ${item.displayWord}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
  }

  return true;
}

function sortItems(left: PronunciationReviewItem, right: PronunciationReviewItem): number {
  const reviewDelta =
    getReviewPriority(left.reviewStatus) - getReviewPriority(right.reviewStatus);
  if (reviewDelta !== 0) return reviewDelta;

  const coverageDelta =
    getCoveragePriority(left.coverageStatus) - getCoveragePriority(right.coverageStatus);
  if (coverageDelta !== 0) return coverageDelta;

  const leftPage = left.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
  const rightPage = right.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
  if (leftPage !== rightPage) return leftPage - rightPage;

  return left.normalizedWord.localeCompare(right.normalizedWord);
}

export function buildPronunciationReviewData(
  input: PronunciationReviewInput,
  filters: PronunciationReviewFilters = {}
): PronunciationReviewResult {
  const { pages, pronunciations } = input;

  // Build a lookup of stored pronunciation rows keyed by normalized_word. If
  // duplicates exist (shouldn't — unique index), last write wins.
  const rowByNormalized = new Map<string, PronunciationReviewEntryRow>();
  for (const row of pronunciations) {
    const key = normalizePronunciationToken(row.normalized_word ?? "");
    if (!key) continue;
    rowByNormalized.set(key, row);
  }

  const aggregates = new Map<
    string,
    {
      displayWord: string;
      occurrences: number;
      pageIds: Set<string>;
      pageNumbers: Set<number>;
      row?: PronunciationReviewEntryRow;
    }
  >();

  for (const page of pages) {
    const pageId = String(page.id);
    const displayTokens = extractDisplayTokens(page.textContent ?? "");

    for (const token of displayTokens) {
      const existing = aggregates.get(token.normalizedWord) ?? {
        displayWord: token.displayWord,
        occurrences: 0,
        pageIds: new Set<string>(),
        pageNumbers: new Set<number>(),
        row: rowByNormalized.get(token.normalizedWord),
      };

      existing.occurrences += 1;
      existing.pageIds.add(pageId);
      existing.pageNumbers.add(page.pageNumber);
      if (!existing.displayWord) {
        existing.displayWord = token.displayWord;
      }

      aggregates.set(token.normalizedWord, existing);
    }
  }

  const allItems = Array.from(aggregates.entries())
    .map(([normalizedWord, aggregate]) => toReviewItem(normalizedWord, aggregate))
    .sort(sortItems);

  const filteredItems = allItems.filter((item) => matchesFilters(item, filters));
  const offset = Math.max(0, filters.offset ?? 0);
  const limit =
    typeof filters.limit === "number" && filters.limit > 0
      ? filters.limit
      : filteredItems.length;

  return {
    items: filteredItems.slice(offset, offset + limit),
    filteredTotal: filteredItems.length,
    summary: buildSummary(allItems),
  };
}

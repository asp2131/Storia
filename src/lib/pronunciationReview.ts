import {
  entryHasAudio,
  normalizePronunciationToken,
  type PronunciationSource,
  type PronunciationStatus,
  type WordPronunciationEntry,
  type WordPronunciationMap,
} from "@/lib/pronunciation";
import { entryCoverageStatus } from "@/lib/pronunciationGeneration";

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
  entries: WordPronunciationMap;
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

function getCoverageStatus(
  entry: WordPronunciationEntry | undefined
): PronunciationReviewCoverageStatus {
  return entryCoverageStatus(entry);
}

function getReviewStatus(
  entry: WordPronunciationEntry | undefined
): PronunciationReviewStatus {
  if (typeof entry === "object" && entry?.status === "failed") {
    return "failed";
  }

  if (
    typeof entry === "object" &&
    (entry.status === "reviewed" || entry.source === "override")
  ) {
    return "reviewed";
  }

  if (entryHasAudio(entry)) {
    return "generated";
  }

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

function entryRichnessScore(entry: WordPronunciationEntry | undefined): number {
  if (!entry) return 0;
  if (typeof entry === "string") return entry.trim().length > 0 ? 2 : 0;

  let score = 0;
  if (typeof entry.fullWord === "string" && entry.fullWord.trim().length > 0) {
    score += 2;
  }
  if (typeof entry.breakdown === "string" && entry.breakdown.trim().length > 0) {
    score += 3;
  }
  if (entry.status === "reviewed" || entry.source === "override") {
    score += 4;
  } else if (entry.status === "generated") {
    score += 1;
  }
  if (typeof entry.confidence === "number") {
    score += entry.confidence;
  }

  return score;
}

function preferEntry(
  current: WordPronunciationEntry | undefined,
  candidate: WordPronunciationEntry | undefined
): WordPronunciationEntry | undefined {
  if (!candidate) return current;
  if (!current) return candidate;

  const currentScore = entryRichnessScore(current);
  const candidateScore = entryRichnessScore(candidate);

  if (candidateScore > currentScore) {
    return candidate;
  }

  if (candidateScore < currentScore) {
    return current;
  }

  if (
    typeof candidate === "object" &&
    typeof current === "object" &&
    (candidate.generatedAt ?? "") > (current.generatedAt ?? "")
  ) {
    return candidate;
  }

  return current;
}

function toReviewItem(
  normalizedWord: string,
  aggregate: {
    displayWord: string;
    occurrences: number;
    pageIds: Set<string>;
    pageNumbers: Set<number>;
    entry?: WordPronunciationEntry;
  }
): PronunciationReviewItem {
  const entry = aggregate.entry;
  const coverageStatus = getCoverageStatus(entry);
  const reviewStatus = getReviewStatus(entry);

  if (typeof entry === "string") {
    return {
      normalizedWord,
      displayWord: aggregate.displayWord,
      occurrences: aggregate.occurrences,
      pageIds: Array.from(aggregate.pageIds),
      pageNumbers: Array.from(aggregate.pageNumbers).sort((a, b) => a - b),
      coverageStatus,
      reviewStatus,
      humanReviewed: false,
      audio: {
        fullWord: entry,
      },
    };
  }

  return {
    normalizedWord,
    displayWord: aggregate.displayWord,
    occurrences: aggregate.occurrences,
    pageIds: Array.from(aggregate.pageIds),
    pageNumbers: Array.from(aggregate.pageNumbers).sort((a, b) => a - b),
    coverageStatus,
    reviewStatus,
    humanReviewed: reviewStatus === "reviewed",
    audio: {
      ...(typeof entry?.fullWord === "string" && entry.fullWord.trim().length > 0
        ? { fullWord: entry.fullWord }
        : {}),
      ...(typeof entry?.breakdown === "string" && entry.breakdown.trim().length > 0
        ? { breakdown: entry.breakdown }
        : {}),
    },
    ...(entry?.source ? { source: entry.source } : {}),
    ...(typeof entry?.confidence === "number"
      ? { confidence: entry.confidence }
      : {}),
    ...(entry?.generatedAt ? { generatedAt: entry.generatedAt } : {}),
    ...(entry?.status ? { status: entry.status } : {}),
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
  pages: PronunciationReviewPageInput[],
  filters: PronunciationReviewFilters = {}
): PronunciationReviewResult {
  const aggregates = new Map<
    string,
    {
      displayWord: string;
      occurrences: number;
      pageIds: Set<string>;
      pageNumbers: Set<number>;
      entry?: WordPronunciationEntry;
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
      };

      existing.occurrences += 1;
      existing.pageIds.add(pageId);
      existing.pageNumbers.add(page.pageNumber);
      if (!existing.displayWord) {
        existing.displayWord = token.displayWord;
      }

      const pageEntry = page.entries[token.normalizedWord];
      existing.entry = preferEntry(existing.entry, pageEntry);
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

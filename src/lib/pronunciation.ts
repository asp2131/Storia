export type PronunciationSource = "override" | "lexicon" | "tts";

export type PronunciationStatus = "generated" | "failed" | "reviewed";

export type PublishedPronunciationPlaybackMode =
  | "whole_word"
  | "breakdown_then_word";

export interface PronunciationAudioAsset {
  url: string;
  durationMs?: number;
  checksum?: string;
}

export interface PronunciationBreakdownSegment {
  index: number;
  chunk: string;
  spoken: string;
  startMs?: number;
  endMs?: number;
}

export interface PronunciationEntryObject {
  breakdown?: string;
  fullWord?: string;
  source?: PronunciationSource;
  confidence?: number;
  status?: PronunciationStatus;
  generatedAt?: string;
  phoneticDisplay?: string;
  syllables?: string[];
  breakdownSegments?: PronunciationBreakdownSegment[];
}

export type WordPronunciationEntry = string | PronunciationEntryObject;

export type WordPronunciationMap = Record<string, WordPronunciationEntry>;

export type PronunciationPlaybackMode = "whole-word" | "breakdown";

export interface PublishedWordPronunciation {
  id: string;
  normalizedWord: string;
  displayWord?: string;
  phoneticDisplay?: string | null;
  ipa?: string | null;
  syllables?: string[];
  breakdownSegments?: PronunciationBreakdownSegment[];
  source?: PronunciationSource;
  confidence?: number | null;
  humanReviewed: boolean;
  status?: PronunciationStatus;
  audio?: {
    breakdown?: PronunciationAudioAsset;
    fullWord?: PronunciationAudioAsset;
    segments?: PronunciationAudioAsset[];
  };
  updatedAt: string;
}

export interface BookPronunciationManifest {
  version: 1;
  bookId: string;
  locale: string;
  defaultPlaybackMode?: PublishedPronunciationPlaybackMode;
  entries: Record<string, PublishedWordPronunciation>;
}

export interface LegacyPublishedWordPronunciation {
  word: string;
  fullWord?: string;
  breakdown?: string;
}

export interface LegacyBookPronunciationManifest {
  version: 1;
  bookId: string;
  entries: Record<string, LegacyPublishedWordPronunciation>;
}

export type ReaderPronunciationManifest =
  | BookPronunciationManifest
  | LegacyBookPronunciationManifest;

export function resolvePronunciationUrl(
  entry: WordPronunciationEntry | undefined,
  mode: PronunciationPlaybackMode
): string | undefined {
  if (entry === undefined) return undefined;
  if (typeof entry === "string") return entry;
  if (mode === "breakdown") {
    return entry.breakdown ?? entry.fullWord;
  }
  return entry.fullWord ?? entry.breakdown;
}

export function resolvePublishedPronunciationUrl(
  entry: PublishedWordPronunciation | undefined,
  mode: PronunciationPlaybackMode
): string | undefined {
  if (!entry?.audio) return undefined;
  const urls = normalizePronunciationUrlPair({
    fullWord: entry.audio.fullWord?.url,
    breakdown: entry.audio.breakdown?.url,
  });
  if (mode === "breakdown") {
    return urls.breakdown ?? urls.fullWord;
  }
  return urls.fullWord ?? urls.breakdown;
}

export type PronunciationAudioRole = "fullWord" | "breakdown" | "unknown";

export function inferPronunciationAudioRole(
  url: string | null | undefined
): PronunciationAudioRole {
  if (!url) return "unknown";
  let value = url.toLowerCase();
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original lowercase value if URL decoding fails.
  }

  if (value.includes("/pronunciations/full-word/")) return "fullWord";
  if (value.includes("/pronunciations/breakdown/")) return "breakdown";
  return "unknown";
}

export function normalizePronunciationUrlPair(pair: {
  fullWord?: string | null;
  breakdown?: string | null;
}): { fullWord?: string; breakdown?: string; corrected: boolean } {
  const fullWord = pair.fullWord?.trim() || undefined;
  const breakdown = pair.breakdown?.trim() || undefined;
  const fullRole = inferPronunciationAudioRole(fullWord);
  const breakdownRole = inferPronunciationAudioRole(breakdown);

  if (fullRole === "breakdown" && breakdownRole === "fullWord") {
    return { fullWord: breakdown, breakdown: fullWord, corrected: true };
  }

  if (fullRole === "breakdown" && !breakdown) {
    return { breakdown: fullWord, corrected: true };
  }

  if (breakdownRole === "fullWord" && !fullWord) {
    return { fullWord: breakdown, corrected: true };
  }

  return { fullWord, breakdown, corrected: false };
}

export function manifestEntryToWordPronunciationEntry(
  entry: PublishedWordPronunciation | LegacyPublishedWordPronunciation
): PronunciationEntryObject {
  if ("audio" in entry || "normalizedWord" in entry) {
    const urls = normalizePronunciationUrlPair({
      fullWord: entry.audio?.fullWord?.url,
      breakdown: entry.audio?.breakdown?.url,
    });
    return {
      ...(urls.fullWord ? { fullWord: urls.fullWord } : {}),
      ...(urls.breakdown ? { breakdown: urls.breakdown } : {}),
      ...(entry.source ? { source: entry.source } : {}),
      ...(typeof entry.confidence === "number" ? { confidence: entry.confidence } : {}),
      ...(entry.status ? { status: entry.status } : {}),
      ...(entry.updatedAt ? { generatedAt: entry.updatedAt } : {}),
    };
  }

  const urls = normalizePronunciationUrlPair({
    fullWord: entry.fullWord,
    breakdown: entry.breakdown,
  });
  return {
    ...(urls.fullWord ? { fullWord: urls.fullWord } : {}),
    ...(urls.breakdown ? { breakdown: urls.breakdown } : {}),
  };
}

export function manifestToWordPronunciationMap(
  manifest: ReaderPronunciationManifest
): WordPronunciationMap {
  const out: WordPronunciationMap = {};

  for (const [key, entry] of Object.entries(manifest.entries)) {
    out[key] = manifestEntryToWordPronunciationEntry(entry);
  }

  return out;
}

export function normalizePronunciationToken(token: string): string {
  return token
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function extractUniquePronunciationTokens(text: string): string[] {
  const seen = new Set<string>();

  for (const rawToken of text.split(/\s+/)) {
    const normalizedToken = normalizePronunciationToken(rawToken);
    if (!normalizedToken || seen.has(normalizedToken)) {
      continue;
    }
    seen.add(normalizedToken);
  }

  return Array.from(seen);
}

export function createStoredPronunciationEntry(
  fullWord: string,
  breakdown?: string,
  metadata?: {
    source?: PronunciationSource;
    confidence?: number;
    status?: PronunciationStatus;
    generatedAt?: string;
  }
): PronunciationEntryObject {
  return {
    fullWord,
    ...(breakdown ? { breakdown } : {}),
    ...(metadata?.source ? { source: metadata.source } : {}),
    ...(typeof metadata?.confidence === "number"
      ? { confidence: metadata.confidence }
      : {}),
    ...(metadata?.status ? { status: metadata.status } : {}),
    ...(metadata?.generatedAt ? { generatedAt: metadata.generatedAt } : {}),
  };
}

/**
 * True if the entry has at least one usable audio URL.
 * Covers legacy string entries and object entries.
 */
export function entryHasAudio(entry: WordPronunciationEntry | undefined): boolean {
  if (entry === undefined) return false;
  if (typeof entry === "string") return entry.trim().length > 0;
  const hasFull =
    typeof entry.fullWord === "string" && entry.fullWord.trim().length > 0;
  const hasBreak =
    typeof entry.breakdown === "string" && entry.breakdown.trim().length > 0;
  return hasFull || hasBreak;
}

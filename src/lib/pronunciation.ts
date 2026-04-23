export type PronunciationSource = "override" | "lexicon" | "tts";

export type PronunciationStatus = "generated" | "failed" | "reviewed";

export interface PronunciationEntryObject {
  breakdown?: string;
  fullWord?: string;
  source?: PronunciationSource;
  confidence?: number;
  status?: PronunciationStatus;
  generatedAt?: string;
}

export type WordPronunciationEntry = string | PronunciationEntryObject;

export type WordPronunciationMap = Record<string, WordPronunciationEntry>;

export type PronunciationPlaybackMode = "whole-word" | "breakdown";

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

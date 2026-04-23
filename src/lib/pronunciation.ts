export type WordPronunciationEntry =
  | string
  | { breakdown?: string; fullWord?: string };

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
  breakdown?: string
): Exclude<WordPronunciationEntry, string> {
  return {
    fullWord,
    ...(breakdown ? { breakdown } : {}),
  };
}

/**
 * Shared word normalization for pronunciation lookup.
 * Used by both web reader and backend generation pipeline.
 */
export function normalizePronunciationWord(word: string): string {
  return word
    .normalize("NFKC")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

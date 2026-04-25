/**
 * Publish-time pronunciation manifest validator (Ticket 1.3).
 *
 * Three validation categories:
 *  1. Orphan entries  — keys present in the manifest that do not match any
 *     normalized token from `pageText`.
 *  2. Duplicate normalized keys — two display words collapsing to the same
 *     normalized key with conflicting audio URLs.
 *  3. Missing audio  — entries where neither `fullWord` nor `breakdown` URL
 *     is set, or the URL is whitespace-only.
 *
 * Reuses `normalizePronunciationToken` and `extractUniquePronunciationTokens`
 * from `src/lib/pronunciation.ts` for shared normalization contract.
 * Does NOT mutate `WordPronunciationEntry` type or the storage shape.
 */

import {
  normalizePronunciationToken,
  extractUniquePronunciationTokens,
  resolvePronunciationUrl,
  type WordPronunciationEntry,
  type WordPronunciationMap,
} from "@/lib/pronunciation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationIssueKind =
  | "orphan"
  | "duplicate-normalized-key"
  | "missing-audio";

export interface ValidationIssue {
  kind: ValidationIssueKind;
  /** The key in the original pronunciation map. */
  key: string;
  /** Human-readable description of the problem. */
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /** Subset of entries that passed all validation checks. */
  validEntries: WordPronunciationMap;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAudio(entry: WordPronunciationEntry): boolean {
  if (typeof entry === "string") {
    return entry.trim().length > 0;
  }
  const fullWordOk =
    typeof entry.fullWord === "string" && entry.fullWord.trim().length > 0;
  const breakdownOk =
    typeof entry.breakdown === "string" && entry.breakdown.trim().length > 0;
  return fullWordOk || breakdownOk;
}

function fullWordUrl(entry: WordPronunciationEntry): string | undefined {
  return resolvePronunciationUrl(entry, "whole-word");
}

function breakdownUrl(entry: WordPronunciationEntry): string | undefined {
  return resolvePronunciationUrl(entry, "breakdown");
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a pronunciation manifest against the page text it came from.
 *
 * @param pageText   - The page text content used to generate the manifest.
 * @param entries    - The `wordPronunciations` map to validate.
 * @returns          `{ ok, issues, validEntries }` where `validEntries`
 *                   contains only the entries that passed all checks.
 */
export function validatePronunciationManifest(
  pageText: string,
  entries: WordPronunciationMap
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Build the set of normalized tokens present in page text.
  const pageTokens = new Set(extractUniquePronunciationTokens(pageText));

  // Build an inverse map: normalized key → all original display keys mapping to it.
  // This is needed for duplicate detection.
  const normalizedToKeys = new Map<string, string[]>();
  for (const key of Object.keys(entries)) {
    const normalizedKey = normalizePronunciationToken(key);
    if (!normalizedToKeys.has(normalizedKey)) {
      normalizedToKeys.set(normalizedKey, []);
    }
    normalizedToKeys.get(normalizedKey)!.push(key);
  }

  // Track which keys are invalid so we can exclude them from validEntries.
  const invalidKeys = new Set<string>();

  // ── Check 1: Orphan entries ──────────────────────────────────────────────
  for (const key of Object.keys(entries)) {
    const normalizedKey = normalizePronunciationToken(key);
    if (!pageTokens.has(normalizedKey)) {
      issues.push({
        kind: "orphan",
        key,
        message: `Key "${key}" (normalized: "${normalizedKey}") has no matching token in page text.`,
      });
      invalidKeys.add(key);
    }
  }

  // ── Check 2: Duplicate normalized keys with conflicting URLs ────────────
  for (const [normalizedKey, keys] of normalizedToKeys.entries()) {
    if (keys.length <= 1) continue;

    // Gather unique fullWord and breakdown URL sets across all duplicate keys.
    const fullWordUrls = new Set<string | undefined>();
    const breakdownUrls = new Set<string | undefined>();

    for (const key of keys) {
      const entry = entries[key];
      fullWordUrls.add(fullWordUrl(entry));
      breakdownUrls.add(breakdownUrl(entry));
    }

    // Conflict if more than one distinct URL (counting undefined as a value).
    const fullWordConflict = fullWordUrls.size > 1;
    const breakdownConflict = breakdownUrls.size > 1;

    if (fullWordConflict || breakdownConflict) {
      for (const key of keys) {
        issues.push({
          kind: "duplicate-normalized-key",
          key,
          message:
            `Key "${key}" shares normalized form "${normalizedKey}" with ${keys
              .filter((k) => k !== key)
              .map((k) => `"${k}"`)
              .join(", ")} but has conflicting ` +
            [
              fullWordConflict ? "fullWord URL" : null,
              breakdownConflict ? "breakdown URL" : null,
            ]
              .filter(Boolean)
              .join(" and ") +
            ".",
        });
        invalidKeys.add(key);
      }
    }
  }

  // ── Check 3: Missing audio ───────────────────────────────────────────────
  for (const [key, entry] of Object.entries(entries)) {
    if (!hasAudio(entry)) {
      issues.push({
        kind: "missing-audio",
        key,
        message: `Entry for "${key}" has no usable audio URL (fullWord and breakdown are both absent or whitespace-only).`,
      });
      invalidKeys.add(key);
    }
  }

  // ── Build validEntries — original entries minus invalid keys ─────────────
  const validEntries: WordPronunciationMap = {};
  for (const [key, entry] of Object.entries(entries)) {
    if (!invalidKeys.has(key)) {
      validEntries[key] = entry;
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    validEntries,
  };
}

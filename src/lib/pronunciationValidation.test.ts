import { describe, expect, it } from "vitest";
import {
  validatePronunciationManifest,
  type ValidationResult,
} from "@/lib/pronunciationValidation";
import {
  createStoredPronunciationEntry,
  type WordPronunciationMap,
} from "@/lib/pronunciation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pageText = "The quick brown fox jumps over the lazy dog.";

function mapOf(pairs: [string, WordPronunciationMap[string]][]) {
  return Object.fromEntries(pairs) as WordPronunciationMap;
}

// ---------------------------------------------------------------------------
// Category 1: Orphan entries
// ---------------------------------------------------------------------------

describe("validatePronunciationManifest — orphan entries", () => {
  it("reports no issues when all keys match page tokens", () => {
    const entries = mapOf([
      ["quick", createStoredPronunciationEntry("/quick-full.mp3")],
      ["fox", createStoredPronunciationEntry("/fox-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.validEntries).toEqual(entries);
  });

  it("flags a key that is not present in page text", () => {
    const entries = mapOf([
      ["quick", createStoredPronunciationEntry("/quick-full.mp3")],
      ["elephant", createStoredPronunciationEntry("/elephant-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const orphanIssues = result.issues.filter((i) => i.kind === "orphan");
    expect(orphanIssues).toHaveLength(1);
    expect(orphanIssues[0].key).toBe("elephant");
  });

  it("orphan key is excluded from validEntries", () => {
    const entries = mapOf([
      ["fox", createStoredPronunciationEntry("/fox-full.mp3")],
      ["unicorn", createStoredPronunciationEntry("/unicorn-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(Object.keys(result.validEntries)).toContain("fox");
    expect(Object.keys(result.validEntries)).not.toContain("unicorn");
  });

  it("handles case-insensitive normalization — uppercase key matches lowercase page token", () => {
    const entries = mapOf([
      // 'The' normalizes to 'the', which IS in pageText
      ["The", createStoredPronunciationEntry("/the-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("handles punctuation-stripped keys matching page tokens", () => {
    // 'dog.' as key normalizes to 'dog', which is in pageText
    const entries = mapOf([
      ["dog.", createStoredPronunciationEntry("/dog-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags a purely punctuation key as an orphan", () => {
    const entries = mapOf([
      ["!!!", createStoredPronunciationEntry("/bang-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const orphanIssues = result.issues.filter((i) => i.kind === "orphan");
    expect(orphanIssues).toHaveLength(1);
    expect(orphanIssues[0].key).toBe("!!!");
  });

  it("returns validEntries = {} when all entries are orphans", () => {
    const entries = mapOf([
      ["banana", createStoredPronunciationEntry("/banana-full.mp3")],
      ["mango", createStoredPronunciationEntry("/mango-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    expect(Object.keys(result.validEntries)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category 2: Duplicate normalized keys
// ---------------------------------------------------------------------------

describe("validatePronunciationManifest — duplicate normalized keys", () => {
  it("accepts identical URLs for two keys with the same normalized form", () => {
    // 'The' and 'the' both normalize to 'the'.
    // If they share the same URL there is no conflict.
    const entries = mapOf([
      ["The", createStoredPronunciationEntry("/the-full.mp3")],
      ["the", createStoredPronunciationEntry("/the-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    // No duplicate-normalized-key issue because URLs are identical
    const dupIssues = result.issues.filter(
      (i) => i.kind === "duplicate-normalized-key"
    );
    expect(dupIssues).toHaveLength(0);
  });

  it("flags conflicting fullWord URLs for same normalized key", () => {
    const entries = mapOf([
      ["The", createStoredPronunciationEntry("/the-v1.mp3")],
      ["the", createStoredPronunciationEntry("/the-v2.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const dupIssues = result.issues.filter(
      (i) => i.kind === "duplicate-normalized-key"
    );
    // Both colliding keys should be flagged
    expect(dupIssues.length).toBeGreaterThanOrEqual(2);
    const keys = dupIssues.map((i) => i.key);
    expect(keys).toContain("The");
    expect(keys).toContain("the");
  });

  it("flags conflicting breakdown URLs for same normalized key", () => {
    const entries = mapOf([
      [
        "The",
        createStoredPronunciationEntry("/the-full.mp3", "/the-break-v1.mp3"),
      ],
      [
        "the",
        createStoredPronunciationEntry("/the-full.mp3", "/the-break-v2.mp3"),
      ],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const dupIssues = result.issues.filter(
      (i) => i.kind === "duplicate-normalized-key"
    );
    expect(dupIssues.length).toBeGreaterThanOrEqual(2);
  });

  it("excludes duplicate-conflict keys from validEntries", () => {
    const entries = mapOf([
      ["The", createStoredPronunciationEntry("/the-v1.mp3")],
      ["the", createStoredPronunciationEntry("/the-v2.mp3")],
      ["fox", createStoredPronunciationEntry("/fox-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(Object.keys(result.validEntries)).toContain("fox");
    expect(Object.keys(result.validEntries)).not.toContain("The");
    expect(Object.keys(result.validEntries)).not.toContain("the");
  });

  it("does not flag duplicates that have no URL conflict", () => {
    // Same fullWord URL on both, no breakdown — no conflict.
    const entries = mapOf([
      ["The", { fullWord: "/the-full.mp3" }],
      ["the", { fullWord: "/the-full.mp3" }],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    const dupIssues = result.issues.filter(
      (i) => i.kind === "duplicate-normalized-key"
    );
    expect(dupIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category 3: Missing audio
// ---------------------------------------------------------------------------

describe("validatePronunciationManifest — missing audio", () => {
  it("flags an entry with neither fullWord nor breakdown", () => {
    const entries = mapOf([
      ["fox", {} as WordPronunciationMap[string]],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const missingIssues = result.issues.filter(
      (i) => i.kind === "missing-audio"
    );
    expect(missingIssues).toHaveLength(1);
    expect(missingIssues[0].key).toBe("fox");
  });

  it("flags an entry with whitespace-only fullWord", () => {
    const entries = mapOf([
      ["fox", { fullWord: "   " }],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const missingIssues = result.issues.filter(
      (i) => i.kind === "missing-audio"
    );
    expect(missingIssues).toHaveLength(1);
  });

  it("does not flag an entry with only fullWord (no breakdown required)", () => {
    const entries = mapOf([
      ["fox", createStoredPronunciationEntry("/fox-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(true);
  });

  it("does not flag an entry with only breakdown and no fullWord", () => {
    const entries = mapOf([
      ["fox", { breakdown: "/fox-break.mp3" }],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    const missingIssues = result.issues.filter(
      (i) => i.kind === "missing-audio"
    );
    expect(missingIssues).toHaveLength(0);
  });

  it("flags legacy string entry with empty string URL", () => {
    const entries = mapOf([["fox", ""]]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);
    const missingIssues = result.issues.filter(
      (i) => i.kind === "missing-audio"
    );
    expect(missingIssues).toHaveLength(1);
  });

  it("accepts a valid legacy string URL", () => {
    const entries = mapOf([["fox", "/fox.mp3"]]);
    const result = validatePronunciationManifest(pageText, entries);
    const missingIssues = result.issues.filter(
      (i) => i.kind === "missing-audio"
    );
    expect(missingIssues).toHaveLength(0);
  });

  it("excludes missing-audio entries from validEntries", () => {
    const entries = mapOf([
      ["fox", {}],
      ["dog", createStoredPronunciationEntry("/dog-full.mp3")],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(Object.keys(result.validEntries)).toContain("dog");
    expect(Object.keys(result.validEntries)).not.toContain("fox");
  });
});

// ---------------------------------------------------------------------------
// Combined / edge-case scenarios
// ---------------------------------------------------------------------------

describe("validatePronunciationManifest — combined and edge cases", () => {
  it("returns ok:true and all entries in validEntries for a clean manifest", () => {
    const entries = mapOf([
      ["quick", createStoredPronunciationEntry("/quick-full.mp3", "/quick-break.mp3")],
      ["brown", createStoredPronunciationEntry("/brown-full.mp3")],
      ["fox", createStoredPronunciationEntry("/fox-full.mp3", "/fox-break.mp3")],
    ]);
    const result: ValidationResult = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(Object.keys(result.validEntries)).toHaveLength(3);
  });

  it("handles empty entries map — ok:true with empty validEntries", () => {
    const result = validatePronunciationManifest(pageText, {});
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(Object.keys(result.validEntries)).toHaveLength(0);
  });

  it("handles empty page text — all entries become orphans", () => {
    const entries = mapOf([
      ["fox", createStoredPronunciationEntry("/fox-full.mp3")],
    ]);
    const result = validatePronunciationManifest("", entries);
    expect(result.ok).toBe(false);
    const orphanIssues = result.issues.filter((i) => i.kind === "orphan");
    expect(orphanIssues).toHaveLength(1);
    expect(Object.keys(result.validEntries)).toHaveLength(0);
  });

  it("accumulates issues across all three categories simultaneously", () => {
    const entries = mapOf([
      // Category 1: orphan
      ["elephant", createStoredPronunciationEntry("/elephant-full.mp3")],
      // Category 2: duplicate with conflict
      ["The", createStoredPronunciationEntry("/the-v1.mp3")],
      ["the", createStoredPronunciationEntry("/the-v2.mp3")],
      // Category 3: missing audio
      ["fox", {}],
    ]);
    const result = validatePronunciationManifest(pageText, entries);
    expect(result.ok).toBe(false);

    const orphans = result.issues.filter((i) => i.kind === "orphan");
    const dups = result.issues.filter(
      (i) => i.kind === "duplicate-normalized-key"
    );
    const missing = result.issues.filter((i) => i.kind === "missing-audio");

    expect(orphans.length).toBeGreaterThanOrEqual(1);
    expect(dups.length).toBeGreaterThanOrEqual(2);
    expect(missing.length).toBeGreaterThanOrEqual(1);

    // validEntries should be empty since all entries are invalid
    expect(Object.keys(result.validEntries)).toHaveLength(0);
  });

  it("does not mutate the input entries object", () => {
    const entries = mapOf([
      ["fox", createStoredPronunciationEntry("/fox-full.mp3")],
    ]);
    const copy = JSON.stringify(entries);
    validatePronunciationManifest(pageText, entries);
    expect(JSON.stringify(entries)).toBe(copy);
  });
});

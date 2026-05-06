import { extractUniquePronunciationTokens } from "@/lib/pronunciation";

export type OverlayTextBBox = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
} | null;

export type OverlayTextEntry = {
  id: string;
  text: string;
  includeInNarration: boolean;
  sortOrder: number;
  bbox: OverlayTextBBox;
  confidence: number | null;
  source?: string;
};

export type OverlayNarrationTextSource = {
  text?: string | null;
  includeInNarration?: boolean | null;
  sortOrder?: number | null;
};

const NO_TEXT_PATTERNS = [
  /\bno\s+(?:visible\s+)?text\b/i,
  /\bdoes(?:\s+not|n't)\s+(?:contain|have|show)\s+(?:any\s+)?text\b/i,
  /\bunable\s+to\s+(?:detect|read)\s+(?:any\s+)?text\b/i,
  /\bno\s+readable\s+text\b/i,
  /\bthere\s+is\s+no\s+text\b/i,
];

export function normalizeOcrText(value: string): string {
  return value
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function splitQuotedSegment(segment: string): string[] {
  return segment
    .split("\n")
    .map((line) => normalizeOcrText(line))
    .filter(Boolean);
}

export function parseReplicateOcrOutput(output: unknown): string[] {
  const raw = Array.isArray(output) ? output.join("\n") : typeof output === "string" ? output : "";
  const normalized = normalizeOcrText(raw);
  if (!normalized) return [];

  if (NO_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return [];
  }

  const quoted: string[] = [];
  const quoteRegex = /"([^"\n]*(?:\n[^"\n]*)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = quoteRegex.exec(normalized)) !== null) {
    quoted.push(...splitQuotedSegment(match[1] || ""));
  }

  if (quoted.length > 0) {
    return dedupePreserveOrder(quoted);
  }

  const stripped = normalized
    .replace(/^\s*(?:the\s+)?text\s+(?:on|in)\s+(?:the\s+)?image\s+(?:reads|says|is)\s*:?\s*/i, "")
    .replace(/^\s*(?:it\s+)?(?:reads|says)\s*:?\s*/i, "")
    .trim();

  if (!stripped || NO_TEXT_PATTERNS.some((pattern) => pattern.test(stripped))) {
    return [];
  }

  return dedupePreserveOrder(
    stripped
      .split("\n")
      .map((line) => normalizeOcrText(line))
      .filter(Boolean)
  );
}

export function includedOverlayText(entries?: OverlayNarrationTextSource[] | null): string[] {
  if (!Array.isArray(entries)) return [];
  return [...entries]
    .filter((entry) => entry.includeInNarration !== false && !!entry.text?.trim())
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((entry) => entry.text?.trim() || "")
    .filter(Boolean);
}

export function assemblePageNarrationText(
  pageText?: string | null,
  overlayEntries?: OverlayNarrationTextSource[] | null
): string {
  return [pageText?.trim() || "", ...includedOverlayText(overlayEntries)]
    .filter(Boolean)
    .join("\n");
}

export function extractPageNarrationTokens(
  pageText?: string | null,
  overlayEntries?: OverlayNarrationTextSource[] | null
): string[] {
  return extractUniquePronunciationTokens(
    assemblePageNarrationText(pageText, overlayEntries)
  );
}

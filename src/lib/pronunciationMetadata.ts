/**
 * Pure helpers for pronunciation metadata: chunk segmentation, syllabification,
 * ARPABET→IPA, and aligning ElevenLabs character timings back to chunks.
 *
 * Server-only — pulls in the CMU dictionary (~2.5 MB JSON). Do NOT import from
 * client components or edge routes.
 */

// @ts-expect-error - hypher ships no type defs
import Hypher from "hypher";
// @ts-expect-error - hyphenation.en-us ships no type defs
import english from "hyphenation.en-us";
import { dictionary as cmuDictionary } from "cmu-pronouncing-dictionary";
import { normalizePronunciationToken } from "@/lib/pronunciation";

// Default leftmin=2/rightmin=3 refuses to split common kid words like "hello"
// or "lo-go". Tighten both to 2 so phonetic teaching breakdowns work.
const hypher = new Hypher({ ...english, leftmin: 2, rightmin: 2 });

export interface BreakdownSegment {
  index: number;
  chunk: string;
  spoken: string;
  startMs?: number;
  endMs?: number;
}

export interface CharacterAlignment {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

/**
 * Split a word into orthographic syllable chunks for breakdown audio.
 *
 * Uses the same Liang-Knuth hyphenation engine as `syllabify`, so chunks
 * align 1:1 with what the reader UI displays as syllables. Words hypher
 * cannot split (e.g. "rhythm", "world") return a single chunk and yield
 * no breakdown audio — that is the right call: forcing a fake split would
 * produce misleading per-syllable highlighting.
 */
export function splitIntoBreakdownChunks(word: string): string[] {
  return syllabify(word);
}

export function spokenBreakdownChunk(chunk: string): string {
  // Isolated "tion" gets read by TTS as letters/"tee-on". Kids expect "shun".
  if (chunk === "tion") return "shun";
  return chunk;
}

export function buildBreakdownSegments(word: string): BreakdownSegment[] {
  const chunks = splitIntoBreakdownChunks(word);
  return chunks.map((chunk, index) => ({
    index,
    chunk,
    spoken: spokenBreakdownChunk(chunk),
  }));
}

export const BREAKDOWN_SEGMENT_SEPARATOR = ' <break time="0.4s" /> ';

export function buildBreakdownSpeechTextFromSegments(
  segments: BreakdownSegment[]
): string | null {
  if (segments.length < 2) return null;
  return segments.map((s) => s.spoken).join(BREAKDOWN_SEGMENT_SEPARATOR);
}

export function syllabify(word: string): string[] {
  const normalized = normalizePronunciationToken(word);
  if (!normalized) return [];
  if (normalized.length <= 3) return [normalized];
  try {
    const result = hypher.hyphenate(normalized) as unknown;
    if (Array.isArray(result) && result.length > 0) {
      return result.map((s) => String(s));
    }
  } catch {
    // fall through to single-token fallback
  }
  return [normalized];
}

// ARPABET → IPA. Stress digits (0,1,2) attach to vowels and are stripped here.
const ARPABET_TO_IPA: Record<string, string> = {
  AA: "ɑ",
  AE: "æ",
  AH: "ʌ",
  AO: "ɔ",
  AW: "aʊ",
  AY: "aɪ",
  B: "b",
  CH: "tʃ",
  D: "d",
  DH: "ð",
  EH: "ɛ",
  ER: "ɝ",
  EY: "eɪ",
  F: "f",
  G: "ɡ",
  HH: "h",
  IH: "ɪ",
  IY: "i",
  JH: "dʒ",
  K: "k",
  L: "l",
  M: "m",
  N: "n",
  NG: "ŋ",
  OW: "oʊ",
  OY: "ɔɪ",
  P: "p",
  R: "ɹ",
  S: "s",
  SH: "ʃ",
  T: "t",
  TH: "θ",
  UH: "ʊ",
  UW: "u",
  V: "v",
  W: "w",
  Y: "j",
  Z: "z",
  ZH: "ʒ",
};

const VOWEL_PHONEMES = new Set([
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "EH",
  "ER",
  "EY",
  "IH",
  "IY",
  "OW",
  "OY",
  "UH",
  "UW",
]);

function arpabetToIpa(arpabet: string): string {
  const tokens = arpabet.split(/\s+/).filter(Boolean);
  let out = "";
  for (const token of tokens) {
    const stressMatch = token.match(/[012]$/);
    const stress = stressMatch ? stressMatch[0] : null;
    const phoneme = stress ? token.slice(0, -1) : token;
    const ipa = ARPABET_TO_IPA[phoneme];
    if (!ipa) continue;
    if (stress === "1" && VOWEL_PHONEMES.has(phoneme)) {
      out += "ˈ" + ipa;
    } else if (stress === "2" && VOWEL_PHONEMES.has(phoneme)) {
      out += "ˌ" + ipa;
    } else {
      out += ipa;
    }
  }
  return out;
}

/**
 * Wrap a word in an SSML phoneme tag so ElevenLabs pronounces it from IPA
 * instead of guessing. Strips the leading/trailing slashes from
 * `phoneticDisplay()` output. When `phonetic` is null, returns the bare word
 * unchanged. Escapes the visible word so embedded quotes don't break SSML.
 *
 * NOTE: phoneme tags are reliable on `eleven_turbo_v2_5` / multilingual_v2.
 * `eleven_v3` SSML semantics differ — only use this on the full-word path.
 */
export function wrapWithPhoneme(
  word: string,
  phonetic: string | null | undefined
): string {
  if (!phonetic) return word;
  const ipa = phonetic.replace(/^\/+|\/+$/g, "").trim();
  if (!ipa) return word;
  const safeIpa = ipa.replace(/"/g, "&quot;");
  const safeWord = word
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<phoneme alphabet="ipa" ph="${safeIpa}">${safeWord}</phoneme>`;
}

export function phoneticDisplay(word: string): string | null {
  const normalized = normalizePronunciationToken(word);
  if (!normalized) return null;
  const arpabet = (cmuDictionary as Record<string, string | undefined>)[
    normalized
  ];
  if (!arpabet) return null;
  // Some dict entries pack multiple pronunciations — first one wins.
  const first = arpabet.split(/[|\n]/)[0]?.trim();
  if (!first) return null;
  const ipa = arpabetToIpa(first);
  return ipa.length > 0 ? `/${ipa}/` : null;
}

/**
 * Walk an ElevenLabs character alignment and stamp `startMs`/`endMs` onto each
 * segment. Tries two strategies:
 *
 *   1. **Exact:** alignment chars match the input text length 1:1 — we know
 *      each segment's char offsets in `breakdownText`, so we look them up.
 *   2. **Substring:** alignment is normalized (SSML stripped) — substring-search
 *      each segment's `spoken` text greedily from the previous match's end.
 *
 * Segments that fail to match are returned without timing fields. Never throws.
 */
export function attachTimingsToSegments(
  segments: BreakdownSegment[],
  alignment: CharacterAlignment | undefined | null,
  breakdownText: string
): BreakdownSegment[] {
  if (!alignment?.characters?.length) return segments;
  const starts = alignment.character_start_times_seconds ?? [];
  const ends = alignment.character_end_times_seconds ?? [];
  const chars = alignment.characters;

  // Strategy 1: alignment is over the raw input text.
  if (chars.length === breakdownText.length) {
    let cursor = 0;
    return segments.map((seg, i) => {
      if (i > 0) cursor += BREAKDOWN_SEGMENT_SEPARATOR.length;
      const startIdx = cursor;
      const endIdx = cursor + seg.spoken.length;
      cursor = endIdx;
      const startSec = starts[startIdx];
      const endSec = ends[endIdx - 1];
      if (typeof startSec !== "number" || typeof endSec !== "number") return seg;
      return {
        ...seg,
        startMs: Math.round(startSec * 1000),
        endMs: Math.round(endSec * 1000),
      };
    });
  }

  // Strategy 2: normalized alignment — substring search.
  const normalizedText = chars.join("");
  const lower = normalizedText.toLowerCase();
  let searchFrom = 0;
  return segments.map((seg) => {
    const target = seg.spoken.toLowerCase();
    if (!target) return seg;
    const idx = lower.indexOf(target, searchFrom);
    if (idx === -1) return seg;
    const startSec = starts[idx];
    const endSec = ends[idx + target.length - 1];
    searchFrom = idx + target.length;
    if (typeof startSec !== "number" || typeof endSec !== "number") return seg;
    return {
      ...seg,
      startMs: Math.round(startSec * 1000),
      endMs: Math.round(endSec * 1000),
    };
  });
}

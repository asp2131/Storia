/**
 * Canonical render-order tokenizer for a page's words.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PARITY CONTRACT — read before changing anything in this file.
 *
 * The mobile reader highlights words by POSITION: `OverlayLayoutEngine`
 * (storia-mobile `lib/src/features/reader/overlay/overlay_layout_engine.dart`)
 * walks `text_overlay.elements` in stored order, splits each element's text on
 * whitespace, and assigns each token an incrementing `globalWordIndex`.
 * `computeActiveWordIndex(narrationTimestamps, position)` then returns an index
 * into the timestamp array, which is matched against that `globalWordIndex`.
 *
 * Therefore: the tokens produced here MUST match the mobile client's rendered
 * tokens 1:1, in order. A different length or ordering silently misaligns every
 * highlight after the first divergence.
 *
 * Two rules that are easy to get wrong:
 *   1. Do NOT normalize/strip punctuation. `page_words_indexer.dart` normalizes
 *      tokens via `normalizeWordToken` for *word-help lookups* — that is a
 *      different concern. Reference tokens are raw display tokens.
 *   2. Do NOT reorder, dedupe, or filter elements. Stored order is render order.
 *
 * The parity fixture in `referenceWords.test.ts` mirrors a Dart test of the same
 * fixture; if you change tokenization here, change it there too.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface PageTextSource {
  text_overlay?: unknown;
  text_content?: string | null;
}

export interface ReferenceWords {
  /** Raw display tokens, in render order. */
  tokens: string[];
  /** Whitespace-joined tokens — the reference text handed to the aligner. */
  text: string;
}

/** Split exactly the way the Dart overlay engine does. */
function splitTokens(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Read `elements[].text` out of a stored overlay without validating the whole
 * config. Older rows predate the current overlay version and must still yield
 * words — a strict parse would reject them and fall through to `text_content`,
 * which can be a *different* word sequence than what the client renders.
 */
function overlayElementTexts(overlay: unknown): string[] | null {
  if (!overlay || typeof overlay !== "object") return null;

  const elements = (overlay as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return null;

  const texts: string[] = [];
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    const text = (element as { text?: unknown }).text;
    if (typeof text === "string" && text.trim().length > 0) {
      texts.push(text);
    }
  }

  return texts.length > 0 ? texts : null;
}

/**
 * Build the reference word list for a page.
 *
 * Precedence mirrors the mobile renderer: overlay elements when present,
 * otherwise the plain `text_content` fallback.
 */
export function buildPageReferenceWords(page: PageTextSource): ReferenceWords {
  const overlayTexts = overlayElementTexts(page.text_overlay);

  const tokens = overlayTexts
    ? overlayTexts.flatMap(splitTokens)
    : splitTokens(page.text_content ?? "");

  return { tokens, text: tokens.join(" ") };
}

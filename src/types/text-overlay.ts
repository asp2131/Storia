// ─── Text Overlay Types ──────────────────────────────────────────
// This is the SINGLE source of truth for all overlay-related types.
// Used by: editor, API routes, image compositing, reader component.
// DO NOT duplicate these types elsewhere.

export const TEXT_OVERLAY_VERSION = 1;

/** Fonts self-hosted through next/font in src/app/layout.tsx. */
const CORE_FONT_CSS_FAMILY = {
  Inter: "var(--font-sans), Inter, sans-serif",
  Lora: "var(--font-serif), Lora, serif",
  "Playfair Display": "var(--font-playfair), 'Playfair Display', serif",
  "JetBrains Mono": "var(--font-mono), 'JetBrains Mono', monospace",
  Gaegu: "var(--font-gaegu), Gaegu, cursive",
  Nunito: "var(--font-nunito), Nunito, sans-serif",
  "Hanken Grotesk": "var(--font-editor), 'Hanken Grotesk', sans-serif",
  "Space Grotesk": "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
} as const;

/**
 * Extra author fonts, loaded from the Google Fonts CDN via EXTRA_FONTS_HREF.
 * Browsers only download a family once text on the page uses it.
 * `wght` is the Google Fonts CSS2 weight spec. One weight a family doesn't
 * have makes Google reject the WHOLE stylesheet, so check the family on
 * fonts.google.com first. Also add new names to
 * specs/mobile-compat-contract.json `fonts.builtinSupported`.
 */
// ponytail: CDN, not self-hosted; move a font to next/font if that matters
const EXTRA_FONTS = {
  // Readability
  Andika: { fallback: "sans-serif", wght: "400;700" },
  Lexend: { fallback: "sans-serif", wght: "300..700" },
  "Atkinson Hyperlegible": { fallback: "sans-serif", wght: "400;700" },
  // Playful
  Fredoka: { fallback: "sans-serif", wght: "300..700" },
  "Baloo 2": { fallback: "sans-serif", wght: "400..700" },
  Grandstander: { fallback: "sans-serif", wght: "300..700" },
  Sniglet: { fallback: "sans-serif", wght: "400;800" },
  Chewy: { fallback: "cursive", wght: "400" },
  "Bubblegum Sans": { fallback: "cursive", wght: "400" },
  // Handwritten
  "Patrick Hand": { fallback: "cursive", wght: "400" },
  Schoolbell: { fallback: "cursive", wght: "400" },
  Caveat: { fallback: "cursive", wght: "400..700" },
  "Comic Neue": { fallback: "cursive", wght: "300;400;700" },
  // Storybook serif
  Literata: { fallback: "serif", wght: "300..700" },
  Fraunces: { fallback: "serif", wght: "300..700" },
  Merriweather: { fallback: "serif", wght: "300..700" },
} as const;

export type OverlayFont = keyof typeof CORE_FONT_CSS_FAMILY | keyof typeof EXTRA_FONTS;

export const AVAILABLE_FONTS = [
  ...Object.keys(CORE_FONT_CSS_FAMILY),
  ...Object.keys(EXTRA_FONTS),
] as readonly OverlayFont[];

export const OVERLAY_FONT_CSS_FAMILY = {
  ...CORE_FONT_CSS_FAMILY,
  ...Object.fromEntries(
    Object.entries(EXTRA_FONTS).map(([name, { fallback }]) => [name, `'${name}', ${fallback}`])
  ),
} as Record<OverlayFont, string>;

export const EXTRA_FONTS_HREF = `https://fonts.googleapis.com/css2?${Object.entries(EXTRA_FONTS)
  .map(([name, { wght }]) => `family=${name.replace(/ /g, "+")}:wght@${wght}`)
  .join("&")}&display=swap`;

export const FONT_WEIGHT_OPTIONS = [300, 400, 500, 600, 700] as const;
export type FontWeight = (typeof FONT_WEIGHT_OPTIONS)[number];

export const TEXT_ALIGN_OPTIONS = ["left", "center", "right"] as const;
export type TextAlign = (typeof TEXT_ALIGN_OPTIONS)[number];

/**
 * A single text element positioned on an illustration.
 *
 * ALL coordinates use **percentage** values (0-100) so overlays
 * are resolution-independent. The editor stores percentages; the
 * compositing engine converts to pixels at render time.
 */
export interface TextElement {
  /** Unique id within the page (uuid v4). */
  id: string;

  /** The text content to render. */
  text: string;

  /** X position as percentage of image width (0-100). */
  x: number;

  /** Y position as percentage of image height (0-100). */
  y: number;

  /** Width as percentage of image width (0-100). */
  width: number;

  /** Font family name -- must be one of AVAILABLE_FONTS. */
  fontFamily: OverlayFont;

  /** Font size in percentage of image height (0-100). Typical range: 2-10. */
  fontSize: number;

  /** Font weight. */
  fontWeight: FontWeight;

  /** CSS color string (hex or rgba). */
  color: string;

  /** Text alignment within the bounding box. */
  textAlign: TextAlign;

  /** Rotation in degrees (-180 to 180). */
  rotation: number;

  /** Optional text shadow. */
  shadow?: TextShadow;

  /** Optional background box behind text. */
  background?: TextBackground;

  /** Optional ElevenLabs voice id used for this overlay text block narration. */
  voiceId?: string;

  /** Optional human-readable voice name snapshot for editor display. */
  voiceName?: string;
}

export interface TextShadow {
  /** Shadow color (hex or rgba). */
  color: string;
  /** Horizontal offset as percentage of image width. */
  offsetX: number;
  /** Vertical offset as percentage of image height. */
  offsetY: number;
  /** Blur radius as percentage of image width. */
  blur: number;
}

export interface TextBackground {
  /** Background fill color (hex or rgba). */
  color: string;
  /** Padding as percentage of image width. */
  padding: number;
  /** Border radius as percentage of image width. */
  borderRadius: number;
}

/**
 * Top-level overlay config stored in the JSONB column.
 * Version field allows future schema migration.
 */
export interface TextOverlayConfig {
  version: typeof TEXT_OVERLAY_VERSION;
  elements: TextElement[];
}

// ─── Book Text Style ─────────────────────────────────────────────
// Per-book reusable text style. Seeds new text blocks and drives the
// "Apply to all pages" bulk restyle. Stored in books.default_text_style.
// Materialized into concrete TextElement fields at save/apply time —
// never referenced at render time.

/**
 * Style-only subset of TextElement. Geometry (x/y/width/rotation) and
 * text content are deliberately excluded — they stay per-element.
 */
export interface BookTextStyle {
  fontFamily: OverlayFont;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  textAlign: TextAlign;
  shadow?: TextShadow;
  background?: TextBackground;
  voiceId?: string;
  voiceName?: string;
}

/** Used when a book has no saved style — matches the historical editor defaults. */
export const DEFAULT_BOOK_TEXT_STYLE: BookTextStyle = {
  fontFamily: "Inter",
  fontSize: 5,
  fontWeight: 400,
  color: "#000000",
  textAlign: "left",
};

/**
 * Compositing status tracked in the `pages` row.
 * null = never composited.
 */
export interface CompositingMeta {
  compositedImageUrl: string | null;
  compositedImagePath: string | null;
  compositedAt: string | null;       // ISO 8601
  compositedBy: string | null;       // user id who triggered it
}

// ─── Validation helpers ──────────────────────────────────────────

/** Clamp a number to [min, max]. */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/** Validate and normalise a single TextElement. Throws on invalid data. */
export function validateTextElement(el: unknown): TextElement {
  const e = el as Record<string, unknown>;

  if (typeof e.id !== "string" || e.id.length === 0) {
    throw new Error("TextElement.id must be a non-empty string");
  }
  if (typeof e.text !== "string") {
    throw new Error("TextElement.text must be a string");
  }
  if (!AVAILABLE_FONTS.includes(e.fontFamily as OverlayFont)) {
    throw new Error(
      `TextElement.fontFamily must be one of: ${AVAILABLE_FONTS.join(", ")}`
    );
  }
  if (!FONT_WEIGHT_OPTIONS.includes(e.fontWeight as FontWeight)) {
    throw new Error(
      `TextElement.fontWeight must be one of: ${FONT_WEIGHT_OPTIONS.join(", ")}`
    );
  }
  if (!TEXT_ALIGN_OPTIONS.includes(e.textAlign as TextAlign)) {
    throw new Error(
      `TextElement.textAlign must be one of: ${TEXT_ALIGN_OPTIONS.join(", ")}`
    );
  }

  return {
    id: e.id as string,
    text: e.text as string,
    x: clamp(Number(e.x) || 0, 0, 100),
    y: clamp(Number(e.y) || 0, 0, 100),
    width: clamp(Number(e.width) || 30, 1, 100),
    fontFamily: e.fontFamily as OverlayFont,
    fontSize: clamp(Number(e.fontSize) || 4, 0.5, 50),
    fontWeight: e.fontWeight as FontWeight,
    color: String(e.color || "#000000"),
    textAlign: e.textAlign as TextAlign,
    rotation: clamp(Number(e.rotation) || 0, -180, 180),
    ...(e.shadow ? { shadow: e.shadow as TextShadow } : {}),
    ...(e.background ? { background: e.background as TextBackground } : {}),
    ...(typeof e.voiceId === "string" && e.voiceId.length > 0
      ? { voiceId: e.voiceId }
      : {}),
    ...(typeof e.voiceName === "string" && e.voiceName.length > 0
      ? { voiceName: e.voiceName }
      : {}),
  };
}

/** Validate a full overlay config payload. */
export function validateOverlayConfig(raw: unknown): TextOverlayConfig {
  const obj = raw as Record<string, unknown>;

  if (obj.version !== TEXT_OVERLAY_VERSION) {
    throw new Error(`Unsupported overlay version: ${obj.version}`);
  }

  if (!Array.isArray(obj.elements)) {
    throw new Error("TextOverlayConfig.elements must be an array");
  }

  return {
    version: TEXT_OVERLAY_VERSION,
    elements: obj.elements.map(validateTextElement),
  };
}

/** Create an empty overlay config for new pages. */
export function emptyOverlayConfig(): TextOverlayConfig {
  return { version: TEXT_OVERLAY_VERSION, elements: [] };
}

// ─── Book text style helpers ─────────────────────────────────────

/** Validate and normalise a BookTextStyle. Throws on invalid data. */
export function validateBookTextStyle(raw: unknown): BookTextStyle {
  const s = raw as Record<string, unknown>;

  if (!AVAILABLE_FONTS.includes(s.fontFamily as OverlayFont)) {
    throw new Error(
      `BookTextStyle.fontFamily must be one of: ${AVAILABLE_FONTS.join(", ")}`
    );
  }
  if (!FONT_WEIGHT_OPTIONS.includes(s.fontWeight as FontWeight)) {
    throw new Error(
      `BookTextStyle.fontWeight must be one of: ${FONT_WEIGHT_OPTIONS.join(", ")}`
    );
  }
  if (!TEXT_ALIGN_OPTIONS.includes(s.textAlign as TextAlign)) {
    throw new Error(
      `BookTextStyle.textAlign must be one of: ${TEXT_ALIGN_OPTIONS.join(", ")}`
    );
  }

  return {
    fontFamily: s.fontFamily as OverlayFont,
    fontSize: clamp(Number(s.fontSize) || 5, 0.5, 50),
    fontWeight: s.fontWeight as FontWeight,
    color: String(s.color || "#000000"),
    textAlign: s.textAlign as TextAlign,
    ...(s.shadow ? { shadow: s.shadow as TextShadow } : {}),
    ...(s.background ? { background: s.background as TextBackground } : {}),
    ...(typeof s.voiceId === "string" && s.voiceId.length > 0
      ? { voiceId: s.voiceId }
      : {}),
    ...(typeof s.voiceName === "string" && s.voiceName.length > 0
      ? { voiceName: s.voiceName }
      : {}),
  };
}

/**
 * Non-throwing variant of validateBookTextStyle — falls back to
 * DEFAULT_BOOK_TEXT_STYLE when raw is null/invalid. For read paths
 * (GET responses, apply-all resolution), never for writes.
 */
export function coerceBookTextStyle(raw: unknown): BookTextStyle {
  try {
    return validateBookTextStyle(raw);
  } catch {
    return DEFAULT_BOOK_TEXT_STYLE;
  }
}

/** Style-only fields of a TextElement, taken from a BookTextStyle. */
export function seedTextElement(
  style: BookTextStyle
): Pick<
  TextElement,
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "color"
  | "textAlign"
  | "shadow"
  | "background"
  | "voiceId"
  | "voiceName"
> {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    textAlign: style.textAlign,
    ...(style.shadow ? { shadow: style.shadow } : {}),
    ...(style.background ? { background: style.background } : {}),
    ...(style.voiceId ? { voiceId: style.voiceId } : {}),
    ...(style.voiceName ? { voiceName: style.voiceName } : {}),
  };
}

/**
 * Voice is the only setting remembered automatically from a text block.
 * Style defaults change only through "Use style for new text boxes"
 * (Creator Space handoff, 2026-11-23): editing one box must not silently
 * change what the next box looks like.
 */
export type RememberedTextSettings = {
  voiceId?: string | null;
  voiceName?: string | null;
};

/** The voice change between two versions of a text block, or {} when the voice is unchanged. */
export function changedRememberedTextSettings(
  previous: TextElement,
  next: TextElement
): RememberedTextSettings {
  if (previous.voiceId === next.voiceId && previous.voiceName === next.voiceName) {
    return {};
  }
  return { voiceId: next.voiceId ?? null, voiceName: next.voiceName ?? null };
}

/** Remember the voice the user just picked so the next block uses it. */
export function rememberTextSettings(
  style: BookTextStyle,
  settings: RememberedTextSettings
): BookTextStyle {
  const next: BookTextStyle = { ...style };

  if ("voiceId" in settings || "voiceName" in settings) {
    delete next.voiceId;
    delete next.voiceName;
    if (settings.voiceId) next.voiceId = settings.voiceId;
    if (settings.voiceId && settings.voiceName) {
      next.voiceName = settings.voiceName;
    }
  }

  return next;
}

// ─── Creator text style ──────────────────────────────────────────
// Saved per creator (user.default_text_style) by "Use style for new text
// boxes". Seeds new boxes in every book. Voice stays per book, so it is
// never part of the creator style.

export type CreatorTextStyle = Omit<BookTextStyle, "voiceId" | "voiceName">;

/** Snapshot the style of a box (or style) — font, size, weight, color, alignment, shadow, fill + padding. */
export function creatorTextStyleFrom(
  source: TextElement | BookTextStyle
): CreatorTextStyle {
  return {
    fontFamily: source.fontFamily,
    fontSize: source.fontSize,
    fontWeight: source.fontWeight,
    color: source.color,
    textAlign: source.textAlign,
    ...(source.shadow ? { shadow: source.shadow } : {}),
    ...(source.background ? { background: source.background } : {}),
  };
}

/** Style for a new box: the creator's saved style when there is one, keeping the book's narration voice. */
export function newTextBoxStyle(
  book: BookTextStyle,
  creator: CreatorTextStyle | null | undefined
): BookTextStyle {
  if (!creator) return book;
  return {
    ...creatorTextStyleFrom(creator),
    ...(book.voiceId ? { voiceId: book.voiceId } : {}),
    ...(book.voiceName ? { voiceName: book.voiceName } : {}),
  };
}

/**
 * Build a new TextElement seeded from a book text style.
 * Geometry defaults match the historical editor behaviour.
 */
export function buildNewTextElement(
  style: BookTextStyle,
  overrides: Partial<TextElement> = {}
): TextElement {
  return {
    id: crypto.randomUUID(),
    text: "New Text",
    x: 10,
    y: 10,
    width: 30,
    rotation: 0,
    ...seedTextElement(style),
    ...overrides,
  };
}

/**
 * Return a new config with every element's style fields replaced by the
 * book style. Content, geometry, ids and each box's narration voice are
 * preserved (a voice is who reads the box, not how it looks). Shadow and
 * background are REMOVED when the style omits them — the style is the source
 * of truth for look.
 */
export function applyBookTextStyle(
  config: TextOverlayConfig,
  style: BookTextStyle
): TextOverlayConfig {
  return {
    version: config.version,
    elements: config.elements.map((el) => {
      const next: TextElement = {
        id: el.id,
        text: el.text,
        x: el.x,
        y: el.y,
        width: el.width,
        rotation: el.rotation,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        textAlign: style.textAlign,
      };
      if (style.shadow) next.shadow = style.shadow;
      if (style.background) next.background = style.background;
      if (el.voiceId) next.voiceId = el.voiceId;
      if (el.voiceName) next.voiceName = el.voiceName;
      return next;
    }),
  };
}

/**
 * Derive plain text content from overlay elements.
 * Concatenates all element text in array order, separated by newlines.
 * Used to mirror overlay text into the `text_content` column
 * for narration generation, search, and accessibility.
 */
export function deriveTextContent(config: TextOverlayConfig): string {
  if (!config.elements || config.elements.length === 0) return "";
  return config.elements
    .map((el) => el.text.trim())
    .filter((t) => t.length > 0)
    .join("\n");
}

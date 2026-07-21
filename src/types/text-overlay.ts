// ─── Text Overlay Types ──────────────────────────────────────────
// This is the SINGLE source of truth for all overlay-related types.
// Used by: editor, API routes, image compositing, reader component.
// DO NOT duplicate these types elsewhere.

export const TEXT_OVERLAY_VERSION = 1;

export const AVAILABLE_FONTS = [
  "Inter",
  "Lora",
  "Playfair Display",
  "JetBrains Mono",
  "Gaegu",
] as const;

export type OverlayFont = (typeof AVAILABLE_FONTS)[number];

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

export type RememberedTextSettings = Partial<
  Pick<BookTextStyle, "fontFamily" | "fontSize">
> & {
  voiceId?: string | null;
  voiceName?: string | null;
};

/** Remember only the settings the user just changed. */
export function rememberTextSettings(
  style: BookTextStyle,
  settings: RememberedTextSettings
): BookTextStyle {
  const next: BookTextStyle = {
    ...style,
    ...(settings.fontFamily !== undefined
      ? { fontFamily: settings.fontFamily }
      : {}),
    ...(settings.fontSize !== undefined ? { fontSize: settings.fontSize } : {}),
  };

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
 * book style. Content, geometry, and ids are preserved. Optional style
 * fields (shadow/background/voice) are REMOVED from elements when the
 * style omits them — the style is the source of truth for style fields.
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
      if (style.voiceId) next.voiceId = style.voiceId;
      if (style.voiceName) next.voiceName = style.voiceName;
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

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

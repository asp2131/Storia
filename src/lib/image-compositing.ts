import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCanvas, loadImage, registerFont } from "canvas";
import sharp from "sharp";
import type { TextOverlayConfig, TextElement } from "@/types/text-overlay";

// Map font family names to canvas-compatible font strings.
// The `canvas` package needs fonts registered or uses system fallbacks.
const FONT_FALLBACK_MAP: Record<string, string> = {
  Inter: "Inter, sans-serif",
  Lora: "Lora, serif",
  "Playfair Display": "'Playfair Display', serif",
  "JetBrains Mono": "'JetBrains Mono', monospace",
  Gaegu: "Gaegu, cursive",
  Nunito: "Nunito, sans-serif",
  "Hanken Grotesk": "'Hanken Grotesk', sans-serif",
  "Space Grotesk": "'Space Grotesk', sans-serif",
};

// ─── Font registration ────────────────────────────────────────────────────────
//
// node-canvas resolves families through fontconfig, and none of the overlay
// families are installed on the serverless runtime — every composite silently
// fell back to the generic sans/serif, so the flattened PNG did not match what
// the editor and the Flutter reader show. Fetch the TTF Google serves for the
// exact family+weight, cache it on disk, and register it before drawing.

const FONT_CACHE_DIR = path.join(tmpdir(), "storia-overlay-fonts");
// Google Fonts serves woff2 to modern UAs and plain TTF to old ones; node-canvas
// (FreeType) wants the TTF.
const TTF_USER_AGENT = "Mozilla/4.0";
const FONT_FETCH_TIMEOUT_MS = 5000;

/** family+weight -> in-flight or settled registration. One attempt per process. */
const fontRegistrations = new Map<string, Promise<void>>();

/** Pull the first truetype `src` URL out of a Google Fonts CSS2 response. */
export function parseTruetypeUrl(css: string): string | null {
  return css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/)?.[1] ?? null;
}

async function fetchCss(family: string, weight: number | null): Promise<string | null> {
  const spec = `${family.replace(/ /g, "+")}${weight === null ? "" : `:wght@${weight}`}`;
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${spec}`, {
    headers: { "User-Agent": TTF_USER_AGENT },
    signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS),
  });
  return res.ok ? res.text() : null;
}

async function registerOverlayFont(family: string, weight: number): Promise<void> {
  const file = path.join(
    FONT_CACHE_DIR,
    `${family.replace(/[^a-z0-9]/gi, "")}-${weight}.ttf`
  );

  let cached = await readFile(file).catch(() => null);
  if (!cached) {
    // Not every family ships every weight (Lora has no 300); fall back to the
    // family default so at least the typeface is right.
    const css = (await fetchCss(family, weight)) ?? (await fetchCss(family, null));
    const url = css && parseTruetypeUrl(css);
    if (!url) throw new Error(`no truetype source for ${family} ${weight}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`font download failed: ${res.status}`);
    cached = Buffer.from(await res.arrayBuffer());

    await mkdir(FONT_CACHE_DIR, { recursive: true });
    await writeFile(file, cached);
  }

  registerFont(file, { family, weight: String(weight) });
}

/**
 * Register every family/weight the overlay uses. Never throws: a font that
 * cannot be fetched keeps the previous behaviour (generic system fallback).
 */
export async function ensureOverlayFontsRegistered(
  elements: readonly TextElement[]
): Promise<void> {
  const pairs = new Set(
    elements
      .filter((el) => el.fontFamily in FONT_FALLBACK_MAP)
      .map((el) => `${el.fontFamily}|${el.fontWeight}`)
  );

  await Promise.all(
    [...pairs].map((pair) => {
      let registration = fontRegistrations.get(pair);
      if (!registration) {
        const [family, weight] = pair.split("|");
        registration = registerOverlayFont(family, Number(weight)).catch((error) => {
          console.warn(`[compositing] font unavailable, using fallback: ${pair}`, error);
        });
        fontRegistrations.set(pair, registration);
      }
      return registration;
    })
  );
}

export interface CompositeResult {
  /** PNG buffer of the composited image. */
  buffer: Buffer;
  /** MIME type. */
  contentType: "image/png";
  /** Width of the output image in pixels. */
  width: number;
  /** Height of the output image in pixels. */
  height: number;
}

/**
 * Render text overlay elements onto a base illustration.
 *
 * 1. Fetch the base image (from URL).
 * 2. Create a canvas at the base image dimensions.
 * 3. Draw the base image.
 * 4. For each TextElement, convert percentage coords to pixels and draw.
 * 5. Export as PNG buffer via sharp (for optimization).
 *
 * Does NOT mutate the input config.
 */
export async function compositePageImage(
  baseImageUrl: string,
  overlay: TextOverlayConfig
): Promise<CompositeResult> {
  // 1. Load base image (and the fonts the overlay needs, in parallel)
  const [baseImage] = await Promise.all([
    loadImage(baseImageUrl),
    ensureOverlayFontsRegistered(overlay.elements),
  ]);
  const width = baseImage.width;
  const height = baseImage.height;

  // 2. Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 3. Draw base image
  ctx.drawImage(baseImage, 0, 0, width, height);

  // 4. Draw each text element (iterate over a copy to avoid mutation)
  for (const element of overlay.elements) {
    drawTextElement(ctx, element, width, height);
  }

  // 5. Export via sharp for optimization
  const rawPng = canvas.toBuffer("image/png");
  const optimized = await sharp(rawPng)
    .png({ compressionLevel: 6 })
    .toBuffer();

  return {
    buffer: optimized,
    contentType: "image/png",
    width,
    height,
  };
}

/**
 * Draw a single TextElement on the canvas.
 * Converts percentage-based coordinates to pixel values.
 */
function drawTextElement(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  el: TextElement,
  imgWidth: number,
  imgHeight: number
): void {
  // Convert percentages to pixels
  const px = (el.x / 100) * imgWidth;
  const py = (el.y / 100) * imgHeight;
  const pWidth = (el.width / 100) * imgWidth;
  const pFontSize = (el.fontSize / 100) * imgHeight;

  ctx.save();

  // Apply rotation around the element's position
  if (el.rotation !== 0) {
    ctx.translate(px, py);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-px, -py);
  }

  // Build font string
  const fontFamily = FONT_FALLBACK_MAP[el.fontFamily] || "sans-serif";
  ctx.font = `${el.fontWeight} ${pFontSize}px ${fontFamily}`;
  ctx.textAlign = el.textAlign;
  ctx.textBaseline = "top";

  // Determine draw X based on textAlign
  let drawX = px;
  if (el.textAlign === "center") {
    drawX = px + pWidth / 2;
  } else if (el.textAlign === "right") {
    drawX = px + pWidth;
  }

  // Word-wrap text within pWidth
  const lines = wrapText(ctx, el.text, pWidth);
  const lineHeight = pFontSize * 1.3;

  // Draw background box if specified
  if (el.background) {
    const bg = el.background;
    const bgPadding = (bg.padding / 100) * imgWidth;
    const bgRadius = (bg.borderRadius / 100) * imgWidth;
    const totalTextHeight = lines.length * lineHeight;

    ctx.fillStyle = bg.color;
    roundRect(
      ctx,
      px - bgPadding,
      py - bgPadding,
      pWidth + bgPadding * 2,
      totalTextHeight + bgPadding * 2,
      bgRadius
    );
    ctx.fill();
  }

  // Draw shadow if specified
  if (el.shadow) {
    ctx.shadowColor = el.shadow.color;
    ctx.shadowOffsetX = (el.shadow.offsetX / 100) * imgWidth;
    ctx.shadowOffsetY = (el.shadow.offsetY / 100) * imgHeight;
    ctx.shadowBlur = (el.shadow.blur / 100) * imgWidth;
  }

  // Draw text lines
  ctx.fillStyle = el.color;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], drawX, py + i * lineHeight);
  }

  ctx.restore();
}

/** Simple word-wrap: split text into lines that fit within maxWidth. */
function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/** Draw a rounded rectangle path. */
function roundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

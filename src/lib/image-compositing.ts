import { createCanvas, loadImage } from "canvas";
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
};

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
  // 1. Load base image
  const baseImage = await loadImage(baseImageUrl);
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

# Text Overlay v2 -- Implementation Spec

> Feature: Position styled text directly on page illustrations (inspired by Taro Gomi's _Hi, Butterfly!_ picture books), with server-side compositing that bakes text into images for the reader.

---

## Table of Contents

1. [Unified Type System](#1-unified-type-system)
2. [Database Schema Changes](#2-database-schema-changes)
3. [Admin Auth Middleware](#3-admin-auth-middleware)
4. [API Route Contracts](#4-api-route-contracts)
5. [Server-Side Image Compositing](#5-server-side-image-compositing)
6. [Storage Utility](#6-storage-utility)
7. [Admin Editor Component](#7-admin-editor-component)
8. [Reader Component](#8-reader-component)
9. [Reader API Modifications](#9-reader-api-modifications)
10. [File Tree](#10-file-tree)
11. [V1 Mistake Checklist](#11-v1-mistake-checklist)

---

## 1. Unified Type System

**ONE file. ONE source of truth.** Every layer (editor, API, renderer, reader) imports from here.

### File: `src/types/text-overlay.ts`

```typescript
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
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| Single file for all types | v1 had 3 competing type files -- never again |
| Percentage coordinates (0-100) | Resolution-independent; editor and renderer both use % |
| `version` field in config | Allows future migration without breaking existing data |
| Validation functions co-located | API routes and editor both import the same validators |
| `clamp()` on all numeric fields | Prevents out-of-range values at the type boundary |

---

## 2. Database Schema Changes

### Prisma Schema Additions

Add these fields to the existing `pages` model in `prisma/schema.prisma`:

```prisma
model pages {
  id                    BigInt   @id @default(autoincrement())
  book_id               BigInt
  page_number           Int
  text_content          String?
  inserted_at           DateTime @db.Timestamp(0)
  updated_at            DateTime @db.Timestamp(0)
  scene_id              BigInt?
  image_url             String?  @db.VarChar(255)
  narration_url         String?  @db.VarChar(255)
  narration_timestamps  Json?
  word_pronunciations   Json?
  illustration_prompt   String?

  // ── Text Overlay v2 additions ──
  text_overlay            Json?      // JSONB: stores TextOverlayConfig
  composited_image_url    String?    @db.VarChar(500)
  composited_image_path   String?    @db.VarChar(500)
  composited_at           DateTime?  @db.Timestamp(0)
  composited_by           String?    @db.VarChar(255)  // Better Auth user.id (cuid)

  books                  books    @relation(fields: [book_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  scenes                 scenes?  @relation(fields: [scene_id], references: [id], onUpdate: NoAction)
  page_audio_assignments page_audio_assignments[]

  @@unique([book_id, page_number], map: "pages_book_id_page_number_index")
  @@index([book_id], map: "pages_book_id_index")
  @@index([scene_id], map: "pages_scene_id_index")
}
```

### SQL Migration

File: `prisma/migrations/<timestamp>_add_text_overlay_columns/migration.sql`

```sql
-- Text Overlay v2: Add overlay config and compositing columns to pages
ALTER TABLE "pages"
  ADD COLUMN "text_overlay"           JSONB,
  ADD COLUMN "composited_image_url"   VARCHAR(500),
  ADD COLUMN "composited_image_path"  VARCHAR(500),
  ADD COLUMN "composited_at"          TIMESTAMP(0),
  ADD COLUMN "composited_by"          VARCHAR(255);
```

**Notes:**
- VARCHAR(500) -- not 255. Supabase storage public URLs regularly exceed 255 chars.
- ALTER TABLE only -- no CREATE TABLE. The `pages` table already exists.
- No default values needed -- all columns are nullable.
- Run via `npx prisma migrate dev --name add_text_overlay_columns`.

---

## 3. Admin Auth Middleware

### File: `src/lib/admin-auth.ts`

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AdminAuthResult {
  user: AdminUser;
}

/**
 * Verify the current request is from an authenticated admin.
 *
 * Usage in a route handler:
 *   const authResult = await requireAdmin();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { user } = authResult;
 *
 * Uses Better Auth (NOT NextAuth). Reads session from cookies
 * via the Better Auth `api.getSession()` method.
 */
export async function requireAdmin(): Promise<AdminAuthResult | NextResponse> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      },
    };
  } catch (error) {
    console.error("[admin-auth] Session verification failed:", error);
    return NextResponse.json(
      { error: "Authentication failed." },
      { status: 401 }
    );
  }
}
```

### Usage pattern (every admin route)

```typescript
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  // ... route logic using user.id, etc.
}
```

---

## 4. API Route Contracts

### 4.1 Overlay CRUD

**File:** `src/app/api/admin/books/[id]/pages/[pageNumber]/overlay/route.ts`

#### GET -- Fetch overlay config

```
GET /api/admin/books/:id/pages/:pageNumber/overlay

Response 200:
{
  "overlay": TextOverlayConfig | null,
  "imageUrl": string | null,
  "compositedImageUrl": string | null
}
```

#### POST -- Create or replace full overlay config

```
POST /api/admin/books/:id/pages/:pageNumber/overlay

Request body:
{
  "overlay": TextOverlayConfig   // full config with version + elements
}

Response 200:
{
  "overlay": TextOverlayConfig,
  "updatedAt": string            // ISO 8601
}
```

#### PATCH -- Partial update (add/update/remove individual elements)

```
PATCH /api/admin/books/:id/pages/:pageNumber/overlay

Request body:
{
  "overlay": TextOverlayConfig   // replacement config
}

Response 200:
{
  "overlay": TextOverlayConfig,
  "updatedAt": string
}
```

**Implementation notes:**
- All three handlers call `requireAdmin()` first.
- POST and PATCH validate the payload using `validateOverlayConfig()`.
- On save, clear `composited_image_url`, `composited_at`, and `composited_by` to signal stale compositing.
- Use `prisma.pages.update()` with the `book_id_page_number` unique constraint.

### 4.2 Compositing Trigger

**File:** `src/app/api/admin/books/[id]/pages/[pageNumber]/composite/route.ts`

#### POST -- Trigger compositing

```
POST /api/admin/books/:id/pages/:pageNumber/composite

Request body: (none)

Response 200:
{
  "compositedImageUrl": string,
  "compositedImagePath": string,
  "compositedAt": string
}

Response 400 (no overlay or no base image):
{
  "error": "Page has no text overlay config."
}
```

#### GET -- Check compositing status

```
GET /api/admin/books/:id/pages/:pageNumber/composite

Response 200:
{
  "hasOverlay": boolean,
  "hasBaseImage": boolean,
  "compositedImageUrl": string | null,
  "compositedAt": string | null,
  "isStale": boolean              // true if overlay was edited after last composite
}
```

**Implementation notes:**
- POST calls `requireAdmin()`, then calls `compositePageImage()` from `src/lib/image-compositing.ts`.
- POST uploads the result via `src/lib/storage.ts` and updates the `pages` row.
- `isStale` is computed by comparing `updated_at > composited_at`.

### Route Parameters Type

All routes under `/api/admin/books/[id]/pages/[pageNumber]/` use:

```typescript
type Params = {
  params: Promise<{
    id: string;
    pageNumber: string;
  }>;
};
```

---

## 5. Server-Side Image Compositing

### File: `src/lib/image-compositing.ts`

```typescript
import { createCanvas, registerFont, loadImage, type Canvas } from "canvas";
import sharp from "sharp";
import type {
  TextOverlayConfig,
  TextElement,
} from "@/types/text-overlay";

// Map font family names to the font files loaded via @font-face.
// The `canvas` package needs fonts registered. On Vercel/server we
// rely on system fonts or register them explicitly. For local dev
// the Google Fonts CDN handles the web side, but canvas needs local
// .ttf/.woff2 files. We use system-available fallbacks at runtime.
const FONT_FALLBACK_MAP: Record<string, string> = {
  "Inter": "Inter, sans-serif",
  "Lora": "Lora, serif",
  "Playfair Display": "Playfair Display, serif",
  "JetBrains Mono": "JetBrains Mono, monospace",
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

  // 4. Draw each text element
  for (const element of overlay.elements) {
    drawTextElement(ctx, element, width, height);
  }

  // 5. Export via sharp for optimization
  const rawPng = canvas.toBuffer("image/png");
  const optimized = await sharp(rawPng)
    .png({ quality: 90, compressionLevel: 6 })
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
  ctx: CanvasRenderingContext2D,
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
  ctx: CanvasRenderingContext2D,
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
  ctx: CanvasRenderingContext2D,
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
```

---

## 6. Storage Utility

### File: `src/lib/storage.ts`

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role key.
 *
 * IMPORTANT: Uses SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix).
 * This key grants full storage access and must NEVER be exposed to
 * the browser. Only import this module in server-side code (API routes,
 * server components, lib modules).
 */
let storageClient: SupabaseClient | null = null;

function getStorageClient(): SupabaseClient {
  if (storageClient) return storageClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
      "These must be set as server-only env vars (no NEXT_PUBLIC_ prefix)."
    );
  }

  storageClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return storageClient;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "storia-storage";

/**
 * Upload a composited image to Supabase storage.
 * Returns the public URL and storage path.
 */
export async function uploadCompositedImage(
  bookId: string | bigint,
  pageNumber: number,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; path: string }> {
  const client = getStorageClient();
  const timestamp = Date.now();
  const path = `books/${bookId}/composited/${pageNumber}_${timestamp}.png`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);

  return { url: data.publicUrl, path };
}

/**
 * Delete a previously composited image from storage.
 * Silently ignores errors (image may already be deleted).
 */
export async function deleteCompositedImage(path: string): Promise<void> {
  try {
    const client = getStorageClient();
    await client.storage.from(BUCKET).remove([path]);
  } catch (error) {
    console.warn("[storage] Failed to delete composited image:", error);
  }
}
```

### Environment Variables Required

```env
# Server-only (NO NEXT_PUBLIC_ prefix)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Optional override
SUPABASE_STORAGE_BUCKET=storia-storage
```

---

## 7. Admin Editor Component

### File: `src/components/text-overlay/DraggableTextOverlayEditor.tsx`

This is the most complex UI component. It provides a WYSIWYG editor for placing text on illustrations.

### Props

```typescript
import type {
  TextOverlayConfig,
  TextElement,
  OverlayFont,
  FontWeight,
  TextAlign,
} from "@/types/text-overlay";

interface DraggableTextOverlayEditorProps {
  /** The base illustration URL. */
  imageUrl: string;
  /** Current overlay config (from API). */
  overlay: TextOverlayConfig | null;
  /** Called when the user saves changes. */
  onSave: (overlay: TextOverlayConfig) => Promise<void>;
  /** Called when the user triggers compositing. */
  onComposite: () => Promise<void>;
  /** Whether a save is in progress. */
  isSaving?: boolean;
  /** Whether compositing is in progress. */
  isCompositing?: boolean;
}
```

### Architecture

```
DraggableTextOverlayEditor
├── ImageCanvas                 -- The illustration with overlay preview
│   ├── <img>                   -- Base illustration
│   └── DraggableTextElement[]  -- Positioned text divs (one per element)
├── ToolBar                     -- Add element, undo/redo, save, composite
└── PropertyPanel               -- Edit selected element's properties
    ├── TextInput               -- Edit text content
    ├── FontSelector            -- Dropdown of AVAILABLE_FONTS
    ├── FontSizeSlider          -- Range input (0.5-50 %)
    ├── FontWeightSelector      -- Dropdown of FONT_WEIGHT_OPTIONS
    ├── ColorPicker             -- Hex color input
    ├── TextAlignSelector       -- Left / Center / Right buttons
    ├── RotationSlider          -- Range input (-180 to 180)
    ├── ShadowControls          -- Toggle + shadow sub-properties
    └── BackgroundControls      -- Toggle + background sub-properties
```

### Key implementation details

1. **All coordinates are percentages.** The `ImageCanvas` wrapper uses `position: relative` on the image container. Each `DraggableTextElement` uses `style={{ left: '${el.x}%', top: '${el.y}%', width: '${el.width}%' }}`. No pixel math ever escapes to the config.

2. **Drag to move.** Use `onPointerDown` / `onPointerMove` / `onPointerUp` on each element. On move, compute delta as percentage of the container's `getBoundingClientRect()` dimensions. Update `x` and `y` in local state.

3. **Resize handle.** A small handle at the bottom-right of the selected element. Dragging it changes `width` (also in percentage).

4. **No dynamically constructed Tailwind classes.** All dynamic styles use inline `style={{}}`. Static classes like layout and spacing use Tailwind utility classes defined at build time.

5. **Font preview.** The editor text uses the same Google Fonts loaded in `globals.css`. The `fontFamily` style is applied inline: `style={{ fontFamily: element.fontFamily }}`.

6. **State management.** Local `useState` for the elements array plus `selectedElementId`. No Zustand needed for this isolated editor.

7. **Save and composite are separate actions.** "Save" persists the overlay config via the POST API. "Composite" calls the composite API endpoint. The UI shows a warning badge if the overlay was modified since last composite.

### CSS approach

```tsx
// CORRECT: Static Tailwind classes + dynamic inline styles
<div
  className="absolute cursor-move select-none"
  style={{
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    fontSize: `${(element.fontSize / 100) * containerHeight}px`,
    fontFamily: element.fontFamily,
    fontWeight: element.fontWeight,
    color: element.color,
    textAlign: element.textAlign,
    transform: `rotate(${element.rotation}deg)`,
  }}
>
  {element.text}
</div>

// WRONG: Dynamically constructed Tailwind classes (JIT cannot detect these)
// <div className={`text-[${size}px] font-[${weight}]`}> -- NEVER DO THIS
```

---

## 8. Reader Component

### File: `src/components/IntegratedIllustration.tsx`

The reader-side component that displays the illustration with text overlay.

### Props

```typescript
import type { TextOverlayConfig } from "@/types/text-overlay";

interface IntegratedIllustrationProps {
  /** Original base illustration URL. */
  imageUrl: string;
  /** Server-composited image URL (text baked in). */
  compositedImageUrl: string | null;
  /** Overlay config for dynamic fallback rendering. */
  overlay: TextOverlayConfig | null;
  /** Alt text for accessibility. */
  alt: string;
}
```

### Display modes (priority order)

1. **Composited image** (default): If `compositedImageUrl` is non-null, render a single `<img>` tag pointing to the composited image. This is the primary mode -- text is baked into the image server-side, so it looks identical on all devices.

2. **Dynamic overlay** (fallback): If `compositedImageUrl` is null but `overlay` has elements, render the base image with CSS-positioned text divs on top (same approach as the editor, but read-only). This covers the case where an admin has saved overlay config but hasn't composited yet.

3. **Image only**: If both `compositedImageUrl` and `overlay` are null/empty, render just the base `imageUrl`.

### Image preloading

```typescript
import { useState, useEffect } from "react";

function usePreloadImage(src: string | null): {
  loaded: boolean;
  error: boolean;
} {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoaded(false);
      setError(false);
      return;
    }

    setLoaded(false);
    setError(false);

    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { loaded, error };
}
```

**Note:** `usePreloadImage` is wrapped in `useEffect` -- not called directly in render. This was a bug in v1.

### Key implementation details

- The component NEVER overwrites `imageUrl`. Both `imageUrl` (original) and `compositedImageUrl` (with text baked in) are available. The reader API returns both.
- Dynamic overlay text uses inline `style={{}}` for positioning -- no dynamically constructed Tailwind classes.
- The same `TextOverlayConfig` type from `src/types/text-overlay.ts` is used. No separate reader-specific types.

---

## 9. Reader API Modifications

### File: `src/app/api/books/[id]/reader/route.ts`

Add overlay and compositing data to the existing page response. The reader API is public (no auth required) -- it serves reader data.

### Changes to the page mapping

Add these fields to each page object in the response:

```typescript
// Inside pages.map((page) => { ... })
return {
  // ... existing fields ...
  id: page.id.toString(),
  pageNumber: page.page_number,
  textContent: page.text_content,
  imageUrl: page.image_url,                          // KEEP original
  compositedImageUrl: page.composited_image_url,     // NEW: composited version
  overlay: page.text_overlay as TextOverlayConfig | null, // NEW: for dynamic fallback
  narrationUrl: page.narration_url,
  narrationTimestamps: page.narration_timestamps,
  wordPronunciations: page.word_pronunciations,
  assignments: applicableAssignments.map(/* ... */),
};
```

**Critical:** `imageUrl` remains the original illustration. `compositedImageUrl` is the text-baked version. The reader component chooses which to display. This avoids the v1 bug where `imageUrl` was overwritten.

---

## 10. File Tree

All new and modified files:

```
src/
├── types/
│   └── text-overlay.ts                          # NEW: Unified type system
├── lib/
│   ├── admin-auth.ts                            # NEW: Admin auth middleware
│   ├── image-compositing.ts                     # NEW: Canvas + Sharp compositing
│   └── storage.ts                               # NEW: Supabase storage utility
├── components/
│   ├── text-overlay/
│   │   └── DraggableTextOverlayEditor.tsx       # NEW: Admin editor
│   └── IntegratedIllustration.tsx               # NEW: Reader component
├── app/
│   └── api/
│       ├── admin/
│       │   └── books/
│       │       └── [id]/
│       │           └── pages/
│       │               └── [pageNumber]/
│       │                   ├── overlay/
│       │                   │   └── route.ts     # NEW: GET/POST/PATCH overlay
│       │                   └── composite/
│       │                       └── route.ts     # NEW: POST trigger / GET status
│       └── books/
│           └── [id]/
│               └── reader/
│                   └── route.ts                 # MODIFIED: Add overlay fields
prisma/
├── schema.prisma                                # MODIFIED: Add overlay columns to pages
└── migrations/
    └── <timestamp>_add_text_overlay_columns/
        └── migration.sql                        # NEW: ALTER TABLE migration
```

---

## 11. V1 Mistake Checklist

Every v1 issue and where it is addressed in this spec:

| # | V1 Mistake | Fix in v2 | Section |
|---|-----------|-----------|---------|
| 1 | Three incompatible TextOverlayConfig types | Single `src/types/text-overlay.ts` imported everywhere | [1](#1-unified-type-system) |
| 2 | Missing auth on admin routes | `requireAdmin()` middleware on ALL admin route handlers | [3](#3-admin-auth-middleware) |
| 3 | Pixel coordinates in editor, percentage expected by renderer | Percentage-based throughout; `clamp(0-100)` validation | [1](#1-unified-type-system) |
| 4 | NEXT_PUBLIC_ prefix on service role key | `storage.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_) | [6](#6-storage-utility) |
| 5 | VARCHAR(255) too short for Supabase URLs | `@db.VarChar(500)` for URL columns | [2](#2-database-schema-changes) |
| 6 | usePreloadImage not wrapped in useEffect | Image preload logic inside `useEffect` with cleanup | [8](#8-reader-component) |
| 7 | Dynamically constructed Tailwind classes | All dynamic values via inline `style={{}}`; only static Tailwind | [7](#7-admin-editor-component), [8](#8-reader-component) |
| 8 | Dead orphaned migration creating unused table | ALTER TABLE only; no new tables | [2](#2-database-schema-changes) |
| 9 | contentEditable not syncing with React state | Text editing via controlled `<textarea>` in PropertyPanel, not contentEditable | [7](#7-admin-editor-component) |
| 10 | Reader API overwriting imageUrl | Both `imageUrl` (original) and `compositedImageUrl` (composited) returned | [9](#9-reader-api-modifications) |

---

## Implementation Order

1. **Types** (`src/types/text-overlay.ts`) -- zero dependencies, everything else imports from here
2. **Schema + Migration** -- Prisma schema update, run migration
3. **Admin Auth** (`src/lib/admin-auth.ts`) -- needed by all admin routes
4. **Storage** (`src/lib/storage.ts`) -- needed by compositing
5. **Image Compositing** (`src/lib/image-compositing.ts`) -- needs storage
6. **API Routes** (overlay + composite) -- needs types, auth, compositing, storage
7. **Reader API modification** -- needs schema to be migrated
8. **Editor Component** (`DraggableTextOverlayEditor.tsx`) -- needs API routes
9. **Reader Component** (`IntegratedIllustration.tsx`) -- needs reader API changes
10. **Integration testing** -- verify build, end-to-end flow

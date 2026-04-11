# Public Book Editor — Required Improvements

> Audit of `src/app/admin/(editor)/books/[id]/edit/` and all supporting routes, hooks, stores, and components before opening the editor to public book submissions.

## Current State

The book editor is a fully-featured admin tool with page management, image uploads, text overlays, AI narration (ElevenLabs), soundscape assignment, and one-click publishing. It was built for a single trusted admin — **not** for untrusted public users.

### Architecture Overview

```
/admin/(editor)/books/[id]/edit/page.tsx
  └── BookEditorProvider (contexts/BookEditorContext.tsx — 1,588 lines)
        ├── PageManagerPanel      (drag-drop page thumbnails, reorder, delete)
        ├── OverlayEditorPanel    (image upload, WYSIWYG text overlay, compositing)
        ├── AudioLibraryPanel     (narration, soundscapes, AI generation, uploads)
        └── BookMetaPanel         (title, author, save/publish controls)

State: React Context + Zustand stores (per-page overlay) + React Query (server data)
Backend: 12+ API routes under /api/admin/*, Prisma + Supabase storage
```

---

## 1. Auth & Authorization Gap — CRITICAL

**Problem:** Only 4 of 12+ admin API routes call `requireAdmin()`. The following are **completely unprotected**:

| Unprotected Route | Risk |
|---|---|
| `POST /api/admin/books` | Anyone can create books |
| `GET/PATCH/DELETE /api/admin/books/[id]` | Anyone can read/edit/delete any book |
| `GET/POST/PATCH /api/admin/books/[id]/pages` | Anyone can manipulate any book's pages |
| `POST/GET/DELETE /api/admin/audio-assignments` | Anyone can assign/delete audio |
| `POST /api/admin/audio-uploads` | Anyone can upload audio files |
| `POST /api/admin/uploads` | Anyone can upload images |
| `POST /api/admin/generate-narration` | Anyone can burn ElevenLabs credits |
| `POST /api/admin/generate-overlay-narration` | Anyone can burn ElevenLabs credits |

**Protected (have `requireAdmin()`):**
- `GET/POST /api/admin/books/[id]/pages/[pageNumber]/composite`
- `GET/POST /api/admin/books/[id]/pages/[pageNumber]/overlay`

**Fix:** Add auth middleware to every `/api/admin/*` route. Two levels needed:
1. **Authentication** — reject unauthenticated requests (401)
2. **Authorization** — verify the user owns the resource OR is admin (403)

**Recommendation:** Create a shared `withAuth(handler, { ownershipCheck? })` wrapper or use Next.js middleware on the `/api/admin` path prefix.

---

## 2. Multi-Tenant Isolation — CRITICAL

**Problem:** Zero `userId` / `organizationId` filtering in any Prisma query. The data model has no ownership concept — every query returns global results.

**Impact:**
- `useEditorPages(bookId)` returns pages regardless of who created the book
- `useBookDetails(bookId)` returns any book by ID
- Audio assignments, uploads, and narration are globally accessible

**Fix:**
1. Add `userId` (or `authorId`) column to the `Book` table
2. Add `where: { userId: session.user.id }` to every query that touches user data
3. For public reads (reader API), filter to `isPublished: true` only
4. Admin role bypasses ownership checks

**Migration:** Add column, backfill existing books to current admin user, add NOT NULL constraint.

---

## 3. Rate Limiting & Abuse Prevention — HIGH

**Problem:** No rate limiting on any endpoint. Critical cost vectors:

| Endpoint | Cost Risk |
|---|---|
| `POST /api/admin/generate-narration` | ElevenLabs API — ~$0.30/1000 chars |
| `POST /api/admin/generate-overlay-narration` | ElevenLabs API — multi-voice, higher cost |
| `POST /api/admin/uploads` | Supabase storage (10MB/upload, no per-user quota) |
| `POST /api/admin/audio-uploads` | Supabase storage (no size limit visible) |

**Fix:**
1. Per-user rate limits on generation endpoints (e.g., 10 narrations/hour for free tier)
2. Per-user storage quotas (e.g., 500MB total, 50 books max)
3. Global rate limiting on all API routes (e.g., 100 req/min per IP)
4. Consider a credits/quota system for ElevenLabs usage

**Recommendation:** Use `upstash/ratelimit` with Redis, or a simple in-memory limiter for MVP.

---

## 4. BookEditorContext God Object — HIGH

**Problem:** `BookEditorContext.tsx` is 1,588 lines managing 5 unrelated domains in a single file:
- Page management (add, delete, reorder, navigation)
- Narration (voice selection, generation, playback)
- Audio library (soundscapes, uploads, assignments)
- Overlay editor (text elements, compositing)
- Book metadata (title, author, save, publish)

**Impact:**
- Untestable — any test requires mocking the entire context
- High bug surface — changes to narration logic can break page management
- Slow iteration — every edit requires understanding 1,588 lines of coupled state

**Fix:** Split into 5 independent providers, each with its own file:

```
contexts/
  book-editor/
    PageManagerProvider.tsx    (~300 lines)
    NarrationProvider.tsx      (~350 lines)
    AudioLibraryProvider.tsx   (~300 lines)
    OverlayEditorProvider.tsx  (~250 lines)
    BookMetaProvider.tsx       (~200 lines)
    BookEditorProvider.tsx     (~100 lines — composes the above)
```

Each provider owns its React Query hooks, local state, and actions. The composition root nests them. Panels consume only the provider they need.

---

## 5. Input Validation & Content Moderation — HIGH

**Problem:**
- Book title and author fields have **no validation** (unlimited length, any characters)
- Text overlay content has no moderation
- Uploaded images have MIME check but no content scanning
- No profanity filter or NSFW detection

**What's already validated (good):**
- Image uploads: file type whitelist (JPG, PNG, GIF, WebP), max 10MB
- Text overlay: `validateOverlayConfig()` validates structure, clamps coordinates 0-100
- Narration text: max 5,000 chars, empty check
- Voice settings: speed (0.7-1.2), style (0-1)

**Fix:**
1. Title: max 200 chars, strip HTML
2. Author: max 100 chars, strip HTML
3. Text content: max 10,000 chars per page
4. Image moderation: integrate a service (AWS Rekognition, Google Vision, or OpenAI moderation) for NSFW detection on upload
5. Text moderation: basic profanity filter + optional AI moderation on publish

---

## 6. File Upload Security Hardening — MEDIUM

**Problem:**
- Storage paths are predictable (`{bookId}/{filename}`) — enumerable
- No virus/malware scanning on uploads
- MIME type checked via header only (spoofable)
- No filename sanitization visible (path traversal risk)

**Fix:**
1. Use UUIDs for storage filenames (not user-supplied names)
2. Validate file content (magic bytes) not just MIME header
3. Sanitize or replace filenames before storage
4. Consider virus scanning for uploaded files (ClamAV or cloud service)
5. Scope Supabase storage policies to authenticated users + their own book paths

---

## 7. Publish/Review Workflow — MEDIUM

**Problem:** Publishing is a single boolean toggle (`isPublished`) with no review step. Any user could publish directly to the public reader.

**Fix:** Introduce a submission workflow:

```
draft → submitted → under_review → published
                  → rejected (with reason)
```

1. Add `status` enum column to Book (replaces `isPublished` boolean)
2. Public users can only move `draft → submitted`
3. Admin reviews and moves `submitted → published` or `submitted → rejected`
4. Reader API only serves `status: 'published'` books
5. User dashboard shows status badges and rejection reasons

---

## Priority Order

| # | Improvement | Priority | Effort | Blocking? |
|---|---|---|---|---|
| 1 | Auth on all API routes | CRITICAL | Small | Yes — without this, nothing else matters |
| 2 | Multi-tenant isolation | CRITICAL | Medium | Yes — users would see each other's books |
| 3 | Rate limiting | HIGH | Small | Yes — cost exposure without it |
| 5 | Input validation | HIGH | Small | Yes — spam/abuse vector |
| 7 | Publish/review workflow | MEDIUM | Medium | Yes — can't let users self-publish |
| 6 | Upload security | MEDIUM | Small | Recommended before launch |
| 4 | Context refactor | HIGH | Large | No — tech debt, not a blocker |

---

## Out of Scope (Future)

- Collaborative editing (multiple users on same book)
- Version history / undo
- Book templates / starter content
- Analytics for authors (views, reads, completion rate)
- Monetization (paid books, author payouts)
- Mobile editor (current editor is desktop-only)

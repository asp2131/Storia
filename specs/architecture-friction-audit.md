# Architecture Friction Audit

> Exploratory audit of Storia's codebase architecture, surfacing integration risks,
> shallow modules, and opportunities for deepening. Conducted 2026-03-21.

---

## Summary

Seven friction clusters were identified. Each is ranked by integration risk — the
likelihood that a bug in the seam between modules causes data loss, silent failure,
or incorrect rendering that's hard to trace.

| # | Area | Risk | Dependency Category |
|---|------|------|---------------------|
| 1 | Narration Generation Pipeline | High | True external (ElevenLabs) + Remote owned (Supabase) |
| 2 | BookEditor Mega-Component | High | In-process |
| 3 | Text Overlay Coordinate System | Medium | In-process |
| 4 | Audio Assignment Cascade Deletes | Medium | Remote owned (Supabase + DB) |
| 5 | Word Alignment Hidden Quality | Medium | In-process |
| 6 | Multi-Voice Narration Stitching | Medium | True external + In-process |
| 7 | Overlay Editor State Fragmentation | Low | In-process |

---

## 1. Narration Generation Pipeline

**Files:**
- `src/app/api/admin/generate-narration/route.ts` (~376 lines)
- `src/lib/wordAlignment.ts`
- `src/lib/elevenlabs.ts`

**What it does:**
A single POST handler orchestrates the entire narration creation flow:
1. Input validation (7 checks)
2. Voice resolution (hint → name match → env default → first voice)
3. ElevenLabs TTS synthesis + word timestamp alignment
4. Supabase storage upload (audio file + timestamps)
5. Pronunciation generation for all unique words (~5–50 additional TTS calls)
6. Prisma DB upsert (pages table: `narration_url`, `narration_timestamps`, `word_pronunciations`)
7. Partial-success error handling (pronunciation failure is swallowed)

**Friction:**
- Route handler is simultaneously orchestrator and domain logic — HTTP concerns
  are mixed with ElevenLabs API calls, Supabase uploads, and DB writes.
- Pronunciation generation is tightly coupled to narration: you cannot generate
  narration without also generating pronunciations.
- Alignment quality warnings are `console.warn`'d but never surfaced to the caller
  or the UI. Poor alignment silently falls back to raw ElevenLabs timestamps.
- No timeout on Supabase uploads. A slow storage response hangs the entire request.
- Retry logic does not exist. A transient ElevenLabs error requires the user to
  regenerate from scratch.

**Integration risk:**
If any of the 6 phases fail mid-way, partial state is written: audio may be
uploaded to Supabase but the DB row never updated, or pronunciations are generated
but never saved. The editor has no way to detect or recover from partial success.

**Dependency category:** True external (ElevenLabs) + Remote owned (Supabase/Prisma)

---

## 2. BookEditor Mega-Component

**Files:**
- `src/app/admin/(editor)/books/[id]/edit/page.tsx` (~2,400 lines)

**What it does:**
A single React component coordinates:
- Page CRUD (add, delete, reorder with drag-drop)
- Image upload and overlay compositing
- Narration generation (standard and multi-voice overlay)
- Audio assignment lifecycle (create, delete, range assignment)
- Sound library browsing and drag-drop assignment
- Overlay editor state (saving, compositing, selected element)
- Voice selection and voice settings
- Autosave (two separate timers: 2.5s for pages, 3s for overlay)
- Keyboard shortcuts (Cmd+S, arrow keys)
- Local page state vs. server state sync

**Friction:**
- ~40 `useState` hooks scattered across the file. Finding state related to one
  feature requires reading hundreds of lines of unrelated state declarations.
- `setActivePage` side-effects: changing the active page resets soundscape range
  defaults, clears selected overlay element, and stops audio preview — all via
  separate `useEffect`s with no explicit coordination.
- Autosave is duplicated: one timer for local page changes, one inside
  `DraggableTextOverlayEditor` for overlay changes, with different delays and
  different error handling strategies.
- Error handling via a single `setError` field: only one error is visible at a
  time, even though 6+ async operations can fail simultaneously.
- `handleOverlaySave` and `handleOverlayComposite` are defined hundreds of lines
  apart from where they're passed as props.

**Integration risk:**
State mutations in one handler reach across to unrelated features. A developer
adding a new feature must read the entire 2,400-line file to understand what state
they must not clobber. The most likely failure mode is a new `useEffect` that
resets state another feature depends on.

**Dependency category:** In-process

---

## 3. Text Overlay Coordinate System

**Files:**
- `src/components/text-overlay/DraggableTextOverlayEditor.tsx` (browser rendering)
- `src/lib/image-compositing.ts` (Node.js canvas compositing)
- `src/app/books/[id]/reader/page.tsx` (reader word-highlight rendering)

**What it does:**
Text overlay elements store position and size as percentages of image dimensions.
Three separate layers convert these percentages to pixels for rendering:
1. **Browser editor**: `(fontSize / 100) * containerHeight` (line ~178)
2. **Node compositor**: equivalent math using Sharp/canvas dimensions
3. **Reader**: re-derives pixel positions for word-highlight overlay

**Friction:**
- The percentage→pixel formula is written three times, in three different
  environments (browser DOM, Node canvas, browser reader).
- There is no shared type or validation for overlay coordinates. A value of `x: 110`
  (out of bounds) is accepted without error.
- Font size is expressed as `% of image height`. Background padding and shadow
  blur are expressed as `% of image width`. This asymmetry is implicit and not
  enforced by the type system.
- If one layer's math drifts (e.g., a `containerWidth` vs `containerHeight` mix-up),
  the editor preview shows correct placement but the composited image shows it wrong
  — or vice versa.

**Integration risk:**
A single math error is invisible in the editor and only appears in the final
rendered image or reader highlight. There are no snapshot tests comparing editor
placement to compositor output.

**Dependency category:** In-process

---

## 4. Audio Assignment Cascade Deletes

**Files:**
- `src/app/api/admin/audio-assignments/route.ts`
- `src/app/api/admin/audio-assignments/[id]/route.ts`

**What it does:**
`DELETE /api/admin/audio-assignments` supports two modes:
1. Delete a single assignment by ID
2. Bulk-delete by `pageNumber + audioType`

On deletion, it cascades:
1. Deletes audio files from Supabase Storage (best-effort, non-blocking)
2. Deletes `page_overlay_narrations` DB rows (cascade via Prisma)
3. Clears `pages.narration_url` and `pages.narration_timestamps` in the DB

**Friction:**
- Supabase Storage deletion is "best-effort" — if it fails, the audio file becomes
  an orphan but the DB record is deleted. There is no cleanup job.
- The cascade to `page_overlay_narrations` is implicit (Prisma relation). A
  developer reading the DELETE handler does not see that overlay narrations are also
  being deleted.
- No rollback: if the Prisma update to clear `narration_url` fails, the
  `page_overlay_narrations` rows may already be gone.
- Range assignments (e.g., soundscape applied to pages 3–8) are not shown to the
  editor user until a query result returns. There's no preview of what will be
  affected before deletion.

**Integration risk:**
Cascade behavior is invisible at the call site. The editor calls `deleteAudioAssignment`
and does not know it will also wipe overlay narration data.

**Dependency category:** Remote owned (Supabase + Prisma)

---

## 5. Word Alignment Hidden Quality

**Files:**
- `src/lib/wordAlignment.ts` (~325 lines, pure functions)
- `src/app/api/admin/generate-narration/route.ts` (caller)

**What it does:**
`alignWordsWithTimestamps` uses greedy Levenshtein matching to align source text
words with ElevenLabs' phoneme-level timestamps. `validateTimestamps` checks that
the result makes sense (monotonic, no gaps > 2s, coverage > 80%).

**Friction:**
- Zero tests. The algorithm has hard-coded thresholds (similarity: 0.6, quality: 0.5)
  with no test coverage to verify they work on edge cases (punctuation-heavy text,
  non-English words, very short or very long pages).
- Alignment quality below threshold is `console.warn`'d but the API returns a 200
  with no quality signal. The editor and reader have no idea whether word highlights
  are reliable.
- The silent fallback to raw ElevenLabs timestamps means poor alignment is
  indistinguishable from good alignment in the reader.
- `calculateTextSimilarity` uses character-level Levenshtein, not word-level. This
  is appropriate for short strings but untested for compound words or diacritics.

**Integration risk:**
Low for data integrity, high for UX correctness. A regression in alignment logic
would not surface as an error — it would surface as word highlights that are
off-by-one or wrong for certain books, discovered by users.

**Dependency category:** In-process

---

## 6. Multi-Voice Narration Stitching

**Files:**
- `src/app/api/admin/generate-overlay-narration/route.ts`
- `src/lib/audio-stitcher.ts`
- `src/app/books/[id]/reader/page.tsx` (timestamp consumer)

**What it does:**
For pages with multiple overlay text elements each assigned a different voice:
1. Route generates one audio track per voice element (N ElevenLabs calls)
2. `stitchAudioTracks()` concatenates audio buffers with silence padding and
   merges timestamps with time offsets
3. Editor receives either the combined track or falls back to individual tracks
4. Reader uses merged timestamps to highlight words during playback

**Friction:**
- Timestamp merging (applying time offsets across tracks) happens inside
  `audio-stitcher.ts`, but timestamp consumption (mapping word index → element)
  happens in the reader. There is no schema validation between them.
- If stitching produces timestamps in a different format or order than the reader
  expects, word highlighting silently breaks.
- The editor has a fallback: if stitching fails, it saves individual track URLs
  (lines ~704-707 in the editor). The reader does not handle this fallback —
  it only knows about a single `narrationUrl`.
- `audio-stitcher.ts` is pure JS operating on raw MP3 buffers. It is not tested
  because the only test vector is a real ElevenLabs response.

**Integration risk:**
The stitching→reader interface is an undocumented contract. A change to how
`audio-stitcher.ts` offsets timestamps (e.g., to fix a silence-padding bug) will
silently break word highlighting in the reader.

**Dependency category:** True external (ElevenLabs) + In-process

---

## 7. Overlay Editor State Fragmentation

**Files:**
- `src/components/text-overlay/DraggableTextOverlayEditor.tsx`
- `src/components/text-overlay/PropertyPanel.tsx`
- `src/app/admin/(editor)/books/[id]/edit/page.tsx` (parent)

**What it does:**
The overlay editor tracks whether changes have been saved and whether the composite
image is stale across three separate mechanisms:
1. `hasChanges` — local state in `DraggableTextOverlayEditor`
2. `isStale` — memoized JSON comparison of `elements` vs `originalElementsRef`
3. `compositedAt` — timestamp from parent's `localPages` state

**Friction:**
- `hasChanges` is set to `false` on successful save, but `isStale` may still be
  `true` if the composite hasn't run yet. These two states can contradict each other
  in a way that confuses the toolbar status indicator.
- `originalElementsRef` is updated after a successful save, but `compositedAt` is
  only updated after a successful composite. If a save happens without a composite,
  `isStale` computes against the saved (not composited) state — which is the wrong
  baseline for "does the composite need to be regenerated?"
- `PropertyPanel` accepts a full `TextElement` and calls `onUpdate(updatedElement)`.
  If a new field is added to `TextElement` and `PropertyPanel` is not updated, the
  autosave will silently save an element missing the new field.

**Integration risk:**
Low for data integrity. Medium for UX: the toolbar can show misleading status (e.g.,
"Saved" when the composite is stale). The risk of missing fields in `PropertyPanel`
updates is mitigated by TypeScript but only at compile time.

**Dependency category:** In-process

---

## Recommended Priorities

### Immediate (high integration risk, data loss possible)

1. **Narration Pipeline** — Extract phases into a service layer with explicit
   error handling per phase. Surface alignment quality to callers. Add retry for
   transient failures.

2. **Audio Assignment Cascades** — Document and test the cascade behavior. Add
   a dry-run endpoint so the editor can preview what will be deleted. Consider
   wrapping cascade in a DB transaction.

### Medium-term (maintainability, silent bugs)

3. **Coordinate System** — Extract a shared `OverlayCoordinates` utility that
   both the browser editor and the Node compositor import from a shared module
   (or `src/lib/overlay-coordinates.ts`). Add validation.

4. **Word Alignment Tests** — Write test cases for `wordAlignment.ts` against
   known inputs. Add alignment quality to the API response so the editor can
   warn users when highlights may be unreliable.

### Longer-term (developer experience)

5. **BookEditor Decomposition** — Extract `PageManager`, `NarrationPanel`,
   `OverlayEditorPanel`, and `AudioLibraryPanel` as separate components with
   well-defined props. Autosave logic should live in a single `useAutosave` hook.

6. **Stitcher Contract** — Define a typed `StitchedNarration` interface shared
   between `audio-stitcher.ts` and the reader. Add a schema validation step
   after stitching.

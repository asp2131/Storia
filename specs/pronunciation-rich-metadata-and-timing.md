# Plan: Pronunciation Rich Metadata + Per-Segment Audio Timing

## Task Description

The `book_pronunciations` table declares three rich-metadata columns — `phonetic_display`, `syllables`, `breakdown_segments` — that the generation pipeline (`src/lib/pronunciationGeneration.ts`) never populates. Only the two audio URLs and status fields are written. Mobile (storia-mobile Flutter reader) needs this data to render per-syllable highlighting that is synchronized with breakdown audio playback.

This plan ships four sequential capability bumps to the pronunciation pipeline:

1. **Step 1 — Persist breakdown chunks now.** `splitIntoBreakdownChunks(word)` already runs during generation; its result is thrown away after building the TTS string. Write it into `breakdown_segments` JSONB.
2. **Step 2 — Real syllabification.** Add `hypher` + `hyphenation.en-us` (Liang–Knuth patterns, sync, ~30 KB, no network) to compute true orthographic syllables and persist into `syllables` JSONB.
3. **Step 3 — Phonetic display.** Add `cmu-pronouncing-dictionary` (offline ARPABET, 134k words) with optional Datamuse fallback to produce an IPA / respelling string and persist into `phonetic_display`.
4. **Step 4 — Per-segment audio timing.** Switch breakdown TTS to the existing `synthesizeSpeechWithTimestamps` helper (`src/lib/elevenlabs.ts:246`), parse the character alignment, and enrich `breakdown_segments` with `{startMs, endMs}` per chunk so the Flutter reader can highlight the active syllable in time with playback.

## Objective

When this plan is complete, every newly generated `book_pronunciations` row will carry:

- `breakdown_segments`: `[{ index, chunk, spoken, startMs, endMs }]`
- `syllables`: `["won", "der", "ful"]` (orthographic syllables from Liang–Knuth patterns)
- `phonetic_display`: IPA-style string (e.g. `/ˈwʌn.dɚ.fəl/`) or readable respelling
- existing `full_word_url`, `breakdown_url`, status, source — unchanged

Existing rows (no audio regen needed) get backfilled for `syllables` and `phonetic_display` via a one-shot script. Rows with `breakdown_url` but no segments get re-synthesized opportunistically (or marked for next regen). Public + admin pronunciation API responses surface the new fields so the Flutter reader can consume them.

## Problem Statement

The Flutter reader can play `breakdown_url` today but has no way to know **which syllable the audio is on at a given moment**, and no structured representation of the chunks themselves. Without that, per-chunk visual highlighting (the core UX the user wants) is impossible. The schema was provisioned for this from the start (migration `20260423233310_add_book_pronunciations`) but the writer side was never wired up. Three independent data needs collapse into one ticket because they share one upsert path.

## Solution Approach

Single integration point: the `book_pronunciations` upsert in `generatePronunciationEntries` (`src/lib/pronunciationGeneration.ts:369-394`). All four steps add fields to the same `create` / `update` payload.

Library boundary stays clean by introducing a small pure helper module — `src/lib/pronunciationMetadata.ts` — exporting:

```ts
buildBreakdownSegments(word: string): { index: number; chunk: string; spoken: string }[]
syllabify(word: string): string[]
phoneticDisplay(word: string): string | null
attachTimingsToSegments(segments, alignment): EnrichedSegment[]
```

`pronunciationGeneration.ts` calls these helpers, persists the JSON, and upgrades the breakdown TTS call from `synthesizeSpeech` to `synthesizeSpeechWithTimestamps` (already implemented at `src/lib/elevenlabs.ts:246`). API routes pass the new fields through unchanged. Tests are extended with fixtures.

Alignment parsing handles the `<break time="0.4s" />` SSML tokens by walking `normalized_alignment.characters` (which strips formatting) and matching each chunk's substring greedily from the previous chunk's end position. If alignment fails to parse, the run still succeeds — segments are persisted without `startMs/endMs` and Flutter falls back to fixed-step highlighting.

## Relevant Files

Use these files to complete the task:

- `src/lib/pronunciationGeneration.ts` — generation pipeline; add metadata fields to upsert (`:369`, `:403`), thread chunks + alignment through
- `src/lib/elevenlabs.ts` — already exports `synthesizeSpeechWithTimestamps` at `:246`; reuse, no edits expected
- `src/lib/pronunciation.ts` — `WordPronunciationEntry` / `PronunciationEntryObject` types; extend with optional `phoneticDisplay`, `syllables`, `breakdownSegments`
- `src/lib/pronunciationGeneration.test.ts` — update mocks + assertions for new fields
- `src/lib/pronunciationReview.ts` — admin review row shaping; pass new fields through
- `src/app/api/admin/books/[id]/pronunciations/route.ts` — admin GET; include new columns in response
- `src/app/api/admin/books/[id]/pronunciations/generate/route.ts` — standalone generation; no change expected, smoke test only
- `src/app/api/books/[id]/pronunciations/route.ts` — public manifest GET; include new columns in response
- `prisma/schema.prisma` — `book_pronunciations` model already has all three columns (no migration needed)
- `scripts/backfill-pronunciations.ts` — Phase 2 backfill; add `--metadata-only` mode
- `scripts/backfill-book-pronunciations.ts` — legacy JSON→table migrator; reference for shape
- `package.json` — add `hypher`, `hyphenation.en-us`, `cmu-pronouncing-dictionary` deps

### New Files

- `src/lib/pronunciationMetadata.ts` — pure helpers for segments, syllabification, phonetic, alignment-to-timing
- `src/lib/pronunciationMetadata.test.ts` — unit tests for the four helpers (deterministic, no I/O)
- `scripts/backfill-pronunciation-metadata.ts` — one-shot backfill for `syllables` + `phonetic_display` over existing rows (no audio regen)

## Implementation Phases

### Phase 1: Foundation

- Land `src/lib/pronunciationMetadata.ts` with the four pure helpers and full unit coverage. No DB writes yet. This is the pivot point — every later step depends on it being correct and side-effect-free.
- Install `hypher`, `hyphenation.en-us`, `cmu-pronouncing-dictionary`. Verify bundle impact (these are server-only, used in Node API routes + scripts; should not reach the Next client bundle).
- Extend `WordPronunciationEntry` types in `src/lib/pronunciation.ts` with optional rich fields.

### Phase 2: Core Implementation

- Wire helpers into `generatePronunciationEntries`:
  - Compute `segments`, `syllables`, `phoneticDisplay` once per word, before the TTS calls.
  - Persist on **both** the success and failure upsert branches (failure rows still benefit from syllables/phonetic — only timing/audio is missing).
  - Replace breakdown `synthesizeSpeech` call with `synthesizeSpeechWithTimestamps`; on success, run `attachTimingsToSegments(segments, alignment)` and store the enriched array; on alignment parse failure, store bare segments.
- Update `rowToWordPronunciationEntry` (`pronunciationGeneration.ts:522`) to surface the new fields.
- Update API route response shapers (admin + public) to include new columns.

### Phase 3: Integration & Polish

- Update tests:
  - `pronunciationGeneration.test.ts` — assert new fields on upsert payloads; mock `synthesizeSpeechWithTimestamps` returning a representative alignment.
  - `pronunciationMetadata.test.ts` — exhaustive helper coverage including edge cases (1-char words, all-vowel words, hyphenated input, words missing from CMU dict).
  - Route tests in `src/app/api/.../pronunciations/route.test.ts` — assert new fields appear in JSON.
- Backfill: `scripts/backfill-pronunciation-metadata.ts` runs over all `book_pronunciations` rows where `syllables IS NULL OR phonetic_display IS NULL`, computes via helpers, updates in batches of 200. Honors reviewed guard. Dry-run mode via `--dry`.
- Run `npm run build` and full test suite. Smoke test by generating pronunciations for a sample book and inspecting one row in the DB.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members.

### Team Members

- Builder
  - Name: `metadata-helpers-builder`
  - Role: Author the new `src/lib/pronunciationMetadata.ts` module + its unit test file. Pure functions, no DB or HTTP.
  - Agent Type: `builder`
  - Resume: true

- Builder
  - Name: `pipeline-integrator`
  - Role: Wire the new helpers and `synthesizeSpeechWithTimestamps` into `pronunciationGeneration.ts`; update upsert payloads (success + failure); update `rowToWordPronunciationEntry`.
  - Agent Type: `feature-lead`
  - Resume: true

- Builder
  - Name: `api-surface-builder`
  - Role: Thread the new fields through admin + public pronunciation API responses and review aggregation.
  - Agent Type: `builder`
  - Resume: true

- Builder
  - Name: `backfill-scripter`
  - Role: Author `scripts/backfill-pronunciation-metadata.ts` (syllables + phonetic only, no audio regen, dry-run flag, batched).
  - Agent Type: `builder`
  - Resume: true

- Tester
  - Name: `test-updater`
  - Role: Update `pronunciationGeneration.test.ts` and route tests; add fixtures covering alignment parse + helper edge cases.
  - Agent Type: `test-writer`
  - Resume: true

- Validator
  - Name: `final-validator`
  - Role: Run the validation commands, inspect a generated row end-to-end, confirm acceptance criteria.
  - Agent Type: `validator`
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Install dependencies and extend types
- **Task ID**: `deps-and-types`
- **Depends On**: none
- **Assigned To**: `metadata-helpers-builder`
- **Agent Type**: `builder`
- **Parallel**: false
- Run `npm install hypher hyphenation.en-us cmu-pronouncing-dictionary`.
- Confirm all three packages resolve and have working types (or add `// @ts-expect-error` shims with a comment if upstream types are missing).
- Extend `PronunciationEntryObject` in `src/lib/pronunciation.ts` with optional fields:
  - `phoneticDisplay?: string`
  - `syllables?: string[]`
  - `breakdownSegments?: Array<{ index: number; chunk: string; spoken: string; startMs?: number; endMs?: number }>`
- Do not import these libs into any client component — server-only.

### 2. Build pure metadata helpers
- **Task ID**: `metadata-helpers`
- **Depends On**: `deps-and-types`
- **Assigned To**: `metadata-helpers-builder`
- **Agent Type**: `builder`
- **Parallel**: false
- Create `src/lib/pronunciationMetadata.ts` exporting:
  - `buildBreakdownSegments(word)` — wraps existing `splitIntoBreakdownChunks` + `spokenBreakdownChunk` (from `pronunciationGeneration.ts`); returns `[{ index, chunk, spoken }]`. Move `spokenBreakdownChunk` here and re-export from `pronunciationGeneration.ts` to avoid duplication.
  - `syllabify(word)` — uses `hypher` + `hyphenation.en-us`; returns `["won","der","ful"]`. Falls back to `[word]` for input ≤3 chars or empty syllabification result.
  - `phoneticDisplay(word)` — uses `cmu-pronouncing-dictionary` to fetch ARPABET, converts to IPA via a stress-aware ARPABET→IPA map; returns `null` when the word is not in the dictionary. Document the ARPABET→IPA table inline.
  - `attachTimingsToSegments(segments, alignment, breakdownText)` — walks `alignment.characters` and matches each `segment.spoken` substring greedily starting from the previous match's end. Returns segments enriched with `startMs`, `endMs` (rounded ms). Returns segments unchanged if alignment is missing or no chunk matches.
- Create `src/lib/pronunciationMetadata.test.ts` covering:
  - Single-syllable words (`"cat"` → 1 chunk, `["cat"]`, IPA present)
  - Multi-syllable (`"wonderful"` → 3 chunks, 3 syllables, IPA present)
  - Out-of-dictionary word → `phoneticDisplay` returns `null`
  - `tion`-suffix mapping (`"action"` → spoken chunk includes `"shun"`)
  - Alignment parser: synthetic alignment for `"won der ful"` → correct ms ranges; missing alignment → bare segments

### 3. Wire helpers into generation pipeline
- **Task ID**: `pipeline-wire`
- **Depends On**: `metadata-helpers`
- **Assigned To**: `pipeline-integrator`
- **Agent Type**: `feature-lead`
- **Parallel**: false
- In `src/lib/pronunciationGeneration.ts`:
  - Import the four helpers from `pronunciationMetadata.ts`.
  - Inside the per-word `Promise.all` block (`:297`), compute `segments = buildBreakdownSegments(word)`, `syllables = syllabify(word)`, `phoneticDisplay = phoneticDisplay(word)` once.
  - Build breakdown speech text from `segments.map(s => s.spoken).join(' <break time="0.4s" /> ')` (replace `buildBreakdownSpeechText`'s usage; keep the function for backwards-compat or migrate callers).
  - Replace the breakdown `synthesizeSpeech` call with `synthesizeSpeechWithTimestamps({ text, voiceId, modelId: "eleven_v3", useSpeakerBoost })`. On success, run `attachTimingsToSegments(segments, alignment, breakdownText)`.
  - Wrap timing parse in try/catch — on failure, log a warn and proceed with bare segments. Never let a parse error fail the row.
  - Pass `breakdown_segments`, `syllables`, `phonetic_display` into both `create` and `update` of the success upsert (`:369`).
  - Pass `syllables` and `phonetic_display` into the **failure** upsert (`:403`) too — they don't depend on TTS. `breakdown_segments` on failure carries bare chunks (no timings).
  - Update `rowToWordPronunciationEntry` (`:522`) to include the three new fields when present.

### 4. Surface new fields in API responses (parallel with task 5)
- **Task ID**: `api-surface`
- **Depends On**: `pipeline-wire`
- **Assigned To**: `api-surface-builder`
- **Agent Type**: `builder`
- **Parallel**: true
- Audit response shaping in:
  - `src/app/api/books/[id]/pronunciations/route.ts` (public manifest)
  - `src/app/api/admin/books/[id]/pronunciations/route.ts` (admin review)
  - `src/lib/pronunciationReview.ts` (admin row shaper)
- Confirm the three new columns are returned to clients. If any shaper explicitly picks fields, add the new ones. Keep response keys camelCase: `phoneticDisplay`, `syllables`, `breakdownSegments`.
- No schema or behavior changes — purely additive.

### 5. Backfill script for existing rows (parallel with task 4)
- **Task ID**: `backfill-script`
- **Depends On**: `metadata-helpers`
- **Assigned To**: `backfill-scripter`
- **Agent Type**: `builder`
- **Parallel**: true
- Create `scripts/backfill-pronunciation-metadata.ts`:
  - Iterate `book_pronunciations` rows where `syllables IS NULL OR phonetic_display IS NULL OR breakdown_segments IS NULL`.
  - For each, compute helpers from `normalized_word` and update the three columns. Do **not** re-synthesize audio (no ElevenLabs calls). Bare segments (no timings) are acceptable here — Flutter falls back gracefully.
  - Honor the reviewed guard: skip rows where `human_reviewed` or `source = 'override'` or `status = 'reviewed'` (override rows may have hand-curated metadata already).
  - Batch updates in groups of 200; log per-batch counts.
  - Support `--dry` (read-only, prints summary), `--book <id>` (scope to one book), `--limit <n>`.
  - Add a brief usage block at the top of the file.

### 6. Update tests
- **Task ID**: `tests-update`
- **Depends On**: `pipeline-wire`, `api-surface`
- **Assigned To**: `test-updater`
- **Agent Type**: `test-writer`
- **Parallel**: false
- Update `src/lib/pronunciationGeneration.test.ts`:
  - Mock `synthesizeSpeechWithTimestamps` to return a deterministic alignment.
  - Assert upsert `create` / `update` payloads include `breakdown_segments`, `syllables`, `phonetic_display` with expected shapes.
  - Cover the alignment-parse-failure path → row still upserts, segments lack timings.
- Update route tests for both admin and public pronunciation endpoints to assert the three new keys appear in JSON.
- All test commands: `npm run test -- pronunciation`.

### 7. Final validation
- **Task ID**: `validate-all`
- **Depends On**: `tests-update`, `backfill-script`, `api-surface`
- **Assigned To**: `final-validator`
- **Agent Type**: `validator`
- **Parallel**: false
- Run validation commands (see below).
- Generate pronunciations for one test word against a dev book and inspect the row in the DB — confirm all three columns populated and segment ms ranges look monotonic.
- Run `scripts/backfill-pronunciation-metadata.ts --dry` against the dev DB and confirm count of rows that would be updated is non-zero (or zero if pipeline already covered everything).
- Confirm acceptance criteria.

## Acceptance Criteria

- A freshly generated `book_pronunciations` row has non-null `breakdown_segments`, `syllables`, and `phonetic_display` (the last only when the word is in CMU dict).
- `breakdown_segments` is an array of objects each containing `index`, `chunk`, `spoken` and — when alignment parsed successfully — `startMs` and `endMs`. Times are monotonically non-decreasing across the array.
- `syllables` is an array of orthographic syllable strings whose concatenation equals (or is a hyphenation of) the original word.
- A failure-path row (TTS errored) still has `syllables` and `phonetic_display` populated; `breakdown_segments` carries bare chunks; `status = "failed"`.
- Public + admin pronunciation API responses include `phoneticDisplay`, `syllables`, `breakdownSegments` keys.
- `npm run build` succeeds.
- `npm run test -- pronunciation` passes including new assertions.
- Backfill script runs without errors, in `--dry` and live modes, and honors the reviewed guard.
- No client bundle now imports `cmu-pronouncing-dictionary`, `hypher`, or `hyphenation.en-us` (`grep -r "cmu-pronouncing-dictionary" src/app | grep -v 'api\|lib'` returns empty).

## Validation Commands

Execute these commands to validate the task is complete:

- `npm install` — confirms new deps install cleanly
- `npx tsc --noEmit` — type-check the new helper module + integration points
- `npm run test -- pronunciation` — run all pronunciation-related unit + route tests
- `npm run build` — Next build incl. Prisma generate; catches accidental client-bundle imports
- `npx tsx scripts/backfill-pronunciation-metadata.ts --dry --limit 5` — smoke-test the backfill against the dev DB
- Manual: trigger `/api/admin/books/<id>/pronunciations/generate` for a known book/word and inspect the row in `psql` — `select normalized_word, syllables, phonetic_display, breakdown_segments from book_pronunciations where book_id = <id> and normalized_word = '<word>';`

## Notes

- `synthesizeSpeechWithTimestamps` already exists at `src/lib/elevenlabs.ts:246` — no new client code, just swap the call in the breakdown path. Keep the full-word synth on the cheaper `synthesizeSpeech` path; we don't need timings for the full-word clip.
- `eleven_v3` model honors `<break>` SSML reliably; keep that model for the breakdown call.
- Greedy substring matching in `attachTimingsToSegments` is intentional: chunks are short, the spoken text concatenates them in order with explicit gaps, and ElevenLabs' `normalized_alignment.characters` strips SSML so the chunk text appears verbatim.
- The CMU dict ships ~134 k entries and ~2.5 MB JSON — fine for server runtime, do **not** import in any client/edge route.
- ARPABET→IPA conversion table lives inline in `pronunciationMetadata.ts` (≈40 entries). Keep it in one file so future tweaks are easy.
- New libraries added via npm:
  - `npm install hypher hyphenation.en-us cmu-pronouncing-dictionary`
- No Prisma migration required — all three columns already exist (migration `20260423233310_add_book_pronunciations`).
- The Flutter mobile reader work that consumes these fields is **out of scope** for this plan; this ticket only ships the data + API contract.
- Remember to update `.wolf/anatomy.md` for the new files (`src/lib/pronunciationMetadata.ts`, its test, the backfill script) and append session entries to `.wolf/memory.md` per project OpenWolf protocol.

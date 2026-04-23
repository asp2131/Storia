# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-03-25

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->
- User asked to use a team of agents for implementation/audits instead of solo execution when possible.

## Key Learnings

- Mobile `Book` / `PageData` models in `storia-mobile` still lack any `hasPronunciations` / `pronunciationManifestUrl` / `wordPronunciations` fields; current cross-platform pronunciation shipping path therefore remains web/backend-only page JSON, and adopting the spec's manifest contract will require an explicit mobile API/model update.
- Backend pronunciation generation now persists page `word_pronunciations` as backward-compatible entries shaped like `string | { fullWord, breakdown? }`; using a shared normalization helper across generation and reader lookup avoids contract drift between storage and playback.
- QA for the web pronunciation requirements artifact expects explicit separation of manifest-present, manifest-missing/absent, and manifest-fetch-failure behaviors rather than a single generic fallback statement.
- Web reader word interaction originally supported click/Enter/Space only and rendered overlay words inside an `aria-hidden` container; phase-1 web pronunciation work adds long-press handling and moves interactive words to an accessible surface with a secondary per-word control.
- Reader pronunciation contract evolved from page-level `Record<string, string>` to backward-compatible `Record<string, string | { breakdown?: string; fullWord?: string }>` in web `PageData`; current reader hook prefers `breakdown` for breakdown mode and `fullWord` for whole-word mode while still accepting legacy string entries.
- SplitType `types` option is type-sensitive in this project; use comma-separated values without spaces (e.g. `"lines,chars"`), not `"lines, chars"`.
- SplitType `types` option is type-checked strictly in this repo/build; use comma-separated values without spaces (e.g. `"lines,chars"`), not `"lines, chars"`.
- **Project:** frontend
- **Description:** Storia is an immersive reading platform that combines ebooks, narration, and soundscapes into a single reader experience.
- Overlay editor state is keyed by `page.id` for saved pages and `page-${number}` for unsaved pages, so any renumber operation (reorder/delete) must remap registry keys for unsaved pages.
- Reorder flows that only change active page index to follow the same logical page should preserve the current overlay store (do not destroy on index-only navigation).
- In Vitest React context tests, mocked hook return objects should be stable references across renders; recreating `data` arrays each render can trigger sync effects repeatedly and cause render-loop/OOM behavior.
- In Vitest hook tests for `useWordPronunciation`, keep `wordPronunciations` object references stable across rerenders; the hook resets active playback whenever that dependency reference changes, which can null `onended` and make narration auto-resume assertions flaky/false-negative.
- Local dev now boots Prisma against a Dockerized Postgres on `localhost:5433`; `npm run dev` runs `db:prepare` first to ensure `storia_dev` exists and apply migrations before Next starts.
- Proof-test comprehension is modeled as **book-level end-of-book questions**, not page-anchored inline prompts; editor UX should therefore use a dedicated Questions tab separate from page/audio editing.
- `useWordPronunciation` now accepts `Record<string, WordPronunciationEntry>` where entry is `string | { breakdown?, fullWord? }`. Resolver: breakdown mode prefers `entry.breakdown` then falls back to `entry.fullWord`; whole-word prefers `entry.fullWord` then `entry.breakdown`. Legacy string entries are passed through for either mode.
- `useWordPronunciation` buffer cache is keyed by audio URL (not by word or mode). This dedups preload+playback fetches when breakdown and fullWord share a URL, and prevents re-fetching when breakdown mode falls back to fullWord audio.
- `src/lib/pronunciation.ts` is the canonical home for the pronunciation contract: `WordPronunciationEntry` type, `normalizePronunciationToken`, `extractUniquePronunciationTokens`, `createStoredPronunciationEntry(fullWord, breakdown?)`, `resolvePronunciationUrl(entry, mode)`. Both the backend (`generate-narration` route) and the reader hook import from here to avoid drift.
- `createStoredPronunciationEntry` omits the `breakdown` key when no breakdown URL is supplied — reader's `resolvePronunciationUrl` handles this by falling back to `fullWord`.
- Current web pronunciation implementation still consumes page-level `wordPronunciations` data from the reader payload, now widened to `string | { breakdown?, fullWord? }`; spec-only manifest fields such as `hasPronunciations` / `pronunciationManifestUrl` are not implemented in the reader contract yet.
- Overlay accessibility (WG-3): each `OverlayTextElement` now wraps interactive words in `role="group"` with sentence-level `aria-label` (Story text + full element.text + interaction hint). Per-word `<button>` carries `aria-label="Hear ${token}"`, `aria-describedby` pointing to a sentence-scoped `sr-only` hint, and `aria-keyshortcuts="Shift+Enter"`. Shift+Enter (or Shift+Space) on a focused word triggers `onWordSecondaryAction` as a keyboard alternate to the long-press / sr-only "Sound out" button. The image is `alt=""` + `aria-hidden=true` while the page alt text lives in a sibling sr-only span.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-04-22] Do not pass fresh inline `wordPronunciations` objects into `useWordPronunciation` tests on every render; use stable references or the hook's reset effect will stop playback and clear `onended`, producing misleading narration-resume failures.
- [2026-04-23] When testing cancel-and-replace behavior in a two-clip sequence: the step1 source's `onended` field on the mock is not nulled by `stopActivePlayback` because by the time the new request arrives, `activeSourceRef.current` is already null (step1 finished). The correctness invariant to test is that the gap timer's step2 callback is a no-op (requestId guard prevents it), NOT that step1's `onended` prop is null. Assert via state/pronouncingIndex instead.

## Decision Log

- 2026-04-22: Treat section `1.14 Web functional requirements` in `specs/word-pronunciation-cross-platform-spec.md` as the canonical final web requirements artifact by consolidating scope, FRs, acceptance criteria, edge cases, QA matrix, open gaps, and an implementation-ready checklist in one place.
- 2026-04-22: For same-voice tap/long-press pronunciation, prefer pre-generated narration-voice pronunciation assets as the canonical cross-platform source over device TTS or on-demand synthesis; this preserves voice parity across web and mobile and fits existing page/overlay narration storage patterns.
- 2026-04-22: For phase-1 web pronunciation UX, keep click/tap as whole-word playback, use pointer long-press (~450ms) for breakdown playback, and require a keyboard-accessible secondary breakdown action so long-press is not web-only.
- 2026-04-22: In the current web overlay implementation, expose the alternate breakdown action as a per-word secondary "Sound out" button reachable by keyboard/screen readers instead of relying only on modifier-key discovery.
- 2026-04-22: Treat the web pronunciation spec itself as the source of release QA truth by adding scenario-based acceptance criteria, edge-case coverage, and a manual QA matrix for manifest, narration, accessibility, repeated interaction, network, and feature-flag variants.
<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- 2026-03-25: Keep per-page overlay stores in a registry and remap keys on reorder/delete; for reorder-induced active-page index shifts, preserve current store to avoid deleting remapped keys or losing unsaved overlay edits.
- 2026-03-27: Replaced naive JS MP3 buffer concatenation with ffmpeg-static (child_process.execFile). Chose over: (a) @ffmpeg/ffmpeg WASM — browser-only, can't run in Vercel serverless, (b) Xing header stripping — insufficient, frame parameter mismatches between silence and real audio still break browsers, (c) sequential playback — would require Flutter mobile reader changes. ffmpeg concat filter decodes all inputs to PCM and re-encodes, producing spec-compliant output.
- 2026-04-07: Local development uses a root `docker-compose.yml` Postgres service plus `scripts/ensure-local-db.sh`, wired into `predev`/`db:prepare`. Chose `localhost:5433` instead of `5432` because the host already had port 5432 allocated, and the workflow needs to auto-recreate `storia_dev` if the database is dropped.

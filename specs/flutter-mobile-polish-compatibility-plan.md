# Flutter Mobile Polish Compatibility Plan

## Objective

Ensure that **book editing on web** (overlay text, narration, soundscape/BGM) reliably produces assets and metadata that render and behave as a **polished Flutter reader experience**.

This plan treats the web editor as a **Flutter-targeting authoring pipeline**.

## Decisions Locked (2026-03-27)

1. **Primary goal:** Data compatibility and behavioral compatibility first (not pixel-perfect parity first).
2. **Publish gate policy:** Block on `fail`; allow `warn` (no hard block).
3. **Normalization policy:** Auto-normalize on read and write.
4. **Timestamp strictness:** Keep current recommendation:
   - `fail`: malformed/non-monotonic/invalid timestamp data
   - `warn`: token drift/sanity issues
5. **Font policy:** Custom fonts are allowed, but must be shipped to Flutter as app assets with a deterministic fallback mapping strategy.
6. **Highlight parity scope (now):** Lock mobile-compatible highlight token values now; full interaction/animation parity can remain phased.
7. **Narration policy:** Stitched narration is canonical page narration when generated from overlay tracks.
8. **Soundscape overlap precedence:** Newest assignment wins.
9. **Readiness enforcement location:** Both editor and API.
10. **Flutter preview mode:** Required before publish.
11. **Rollout:** Phased with feature flags.
12. **Source-of-truth governance:** `mobile-compat` skill + versioned contract artifact in repo.

---

## Mobile Compatibility Baseline (Source of Truth)

Primary mobile reference files:
- `storia-mobile/lib/src/audio/audio_engine.dart`
- `storia-mobile/lib/src/features/reader/overlay/overlay_layout_engine.dart`
- `storia-mobile/lib/src/features/reader/overlay/text_overlay_utils.dart`
- `storia-mobile/lib/src/features/library/library_screen.dart`
- `storia-mobile/lib/src/features/reader/reader_screen.dart`
- `storia-mobile/lib/src/data/models.dart`

Required parity constraints:
1. Dual-channel audio (narration + soundscape), independently toggled.
2. Narration position drives word highlighting using mobile-compatible active-word logic.
3. Highlight semantics:
   - Tapped: `#8B5CF6` (bold, 1.15x scale)
   - Spoken: `#FFD54F` (bold)
   - Narration active: `#D4EDBC`
4. Overlay geometry uses percentage-based positioning/scaling.
5. Library and reader data contracts remain shape-compatible across platforms.

---

## Current Web Risk Areas (Must Fix)

1. **Text shadow shape mismatch**
   - Web overlay type uses `shadow.offsetX/offsetY`
   - Mobile expects `shadow.x/y`
   - Risk: visual drift or missing shadows in Flutter.

2. **Active-word sync mismatch**
   - Web reader/editor currently computes active word via simplified `currentTime >= start` logic.
   - Mobile uses `start/end` window + gap handling logic.
   - Risk: word highlighting feels inaccurate compared to Flutter.

3. **No explicit mobile readiness gate before publish**
   - Invalid/partial overlay-narration data can pass through editor flows.

---

## Implementation Strategy

Build a shared **MobileCompatibilityService** in web and call it from all authoring/publish paths.

Service responsibilities:
- Normalize payloads to Flutter-compatible shape.
- Validate overlay/audio/timestamp contracts.
- Provide deterministic active-word computation parity.
- Emit page/book-level mobile readiness reports.

---

## Phased Checklist (Priority Order)

## Phase 1 — Data Contract & Schema Normalization (P0)

### 1.1 Add canonical mobile-aligned compatibility types
- [ ] Create `src/lib/mobile-compat/types.ts`
- [ ] Define canonical interfaces for:
  - `WordTimestamp`
  - `MobileTextShadow` (`x`, `y`, `blur`, `color`)
  - `MobileTextBackground`
  - `MobileTextElement`
  - `MobileTextOverlayConfig`

### 1.2 Add normalization utilities
- [ ] Create `src/lib/mobile-compat/normalize.ts`
- [ ] Implement:
  - `normalizeTextShadow()` (supports both `offsetX/offsetY` and `x/y`, emits canonical mobile form)
  - `normalizeTextElementForMobile()`
  - `normalizeOverlayForMobile()`
  - `normalizePageForMobile()`

### 1.3 Integrate normalization at save boundaries
- [ ] Update `src/contexts/BookEditorContext.tsx`
  - Apply overlay normalization before `handleOverlaySave` submission.
  - Apply narration timestamp normalization before mutating local page state.
- [ ] Update `src/app/api/admin/books/[id]/pages/[page]/overlay` handler (if present in routes)
  - Normalize server-side to avoid client-only safety.

Acceptance criteria:
- Overlay JSON persisted from web contains mobile-compatible shadow fields.
- Existing records with `offsetX/offsetY` are accepted and transformed.

---

## Phase 2 — Word Sync Parity (P0)

### 2.1 Port mobile active-word algorithm
- [ ] Create `src/lib/mobile-compat/word-sync.ts`
- [ ] Implement `computeActiveWordIndexMobileCompatible(timestamps, currentTimeSeconds)` matching Flutter logic in:
  - `storia-mobile/lib/src/features/reader/overlay/text_overlay_utils.dart`

### 2.2 Replace existing reader/editor active-word logic
- [ ] Update `src/app/books/[id]/reader/page.tsx`
  - Replace inline active-word effect logic with shared mobile-compatible function.
- [ ] Update `src/contexts/BookEditorContext.tsx`
  - Replace narration preview active-word logic with same function.

Acceptance criteria:
- Given identical timestamps + playback positions, web and mobile produce same active index.

---

## Phase 3 — Mobile Highlight & Interaction Semantics (P1)

### 3.1 Centralize highlight style policy
- [ ] Create `src/lib/mobile-compat/highlight-policy.ts`
- [ ] Lock token values now:
  - tapped `#8B5CF6`
  - spoken `#FFD54F`
  - narration-active `#D4EDBC`
- [ ] Keep precedence metadata (`tapped > spoken > narration-active > base`) in policy for phased UI adoption.

### 3.2 Apply policy to dynamic overlay renderer (phased)
- [ ] Update `src/components/IntegratedIllustration.tsx`
  - Phase now: consume locked token values.
  - Later phase: full tapped scale/weight interaction parity.

### 3.3 Align reader CSS tokens with mobile colors
- [ ] Update `src/app/globals.css`
  - Add explicit variables for three highlight roles.
  - Avoid ambiguous single `--reader-highlight-bg` usage where role-specific styles are needed.

Acceptance criteria:
- Highlight token values match mobile constants across web surfaces.
- Full interaction parity remains a follow-up phase, not a P0 blocker.

---

## Phase 4 — Mobile Readiness Gate (P0)

### 4.1 Build validator module
- [ ] Create `src/lib/mobile-compat/validate.ts`
- [ ] Add checks:
  - Overlay schema integrity
  - Font compatibility checks:
    - Supported built-ins are valid by default (`Inter`, `Lora`, `Playfair Display`, `JetBrains Mono`, `Gaegu`)
    - Custom fonts require Flutter asset registration + fallback mapping metadata
  - Narration timestamp shape and monotonicity (`start <= end`, ascending)
  - Word-token and timestamp sanity checks
  - Soundscape assignment/range validity

### 4.2 Expose readiness report type
- [ ] Create `src/lib/mobile-compat/readiness-report.ts`
- [ ] Return structured output:
  - `status: pass | warn | fail`
  - `issues: { code, severity, message, pageNumber, fieldPath }[]`

### 4.3 Enforce gate on publish (editor + API)
- [ ] Update `src/contexts/BookEditorContext.tsx` in `handlePublish`
  - Validate all pages before publish mutation.
  - Block publish on `fail` severity issues.
  - Surface actionable errors to user.
- [ ] Add API-side enforcement for publish endpoints
  - Reject publish when readiness report contains `fail` severity issues.
  - Return structured issue payload.

Acceptance criteria:
- Publish blocked when mobile-breaking issues exist.
- Editor shows clear issue list tied to pages.

---

## Phase 5 — Flutter Preview Mode in Web Editor (P1)

### 5.1 Add required preview workflow
- [ ] Add `flutterPreview` mode in `src/components/editor/OverlayEditorPanel.tsx`
- [ ] Track `previewConfirmedAt` per edited page and reset on subsequent page edits

### 5.2 Render via mobile-like layout semantics
- [ ] Reuse normalized mobile overlay data in preview.
- [ ] Ensure contained-image rect and percent scaling behavior match mobile assumptions.

### 5.3 Include playback-linked word highlighting
- [ ] Hook preview highlight rendering to mobile-compatible word sync function.

Acceptance criteria:
- Author can preview a page in “Flutter mode” and observe near-identical overlay behavior.
- Publish is blocked until all changed pages have a confirmed Flutter preview pass.

---

## Phase 6 — Reader Playback Deep Module (P1)

### 6.1 Extract reader playback session core
- [ ] Create `src/lib/reader-playback/session.ts`
  - Minimal session interface (`subscribe`, `dispatch`, `dispose`)
  - request-id guard for page transitions
  - loadPage / transitionToPage semantics

### 6.2 Add adapter ports
- [ ] Create:
  - `src/lib/reader-playback/ports/audio-port.ts`
  - `src/lib/reader-playback/ports/scheduler-port.ts`
- [ ] Implement web adapters for HTMLAudio elements.

### 6.3 Hook React UI via facade
- [ ] Create `src/hooks/useReaderPlayback.ts`
- [ ] Migrate `src/app/books/[id]/reader/page.tsx` to consume this hook.

Acceptance criteria:
- Reader page sheds orchestration complexity.
- Playback behavior is testable at session boundary.

---

## Test Plan

## A. Contract/Normalization tests
- [ ] `src/lib/mobile-compat/__tests__/normalize.test.ts`
  - accepts legacy and canonical shadow inputs
  - emits canonical mobile forms

## B. Word sync parity tests
- [ ] `src/lib/mobile-compat/__tests__/word-sync.test.ts`
  - exact cases mirrored from Flutter behavior (in-word, between-words gap, trailing edge)

## C. Validator tests
- [ ] `src/lib/mobile-compat/__tests__/validate.test.ts`
  - malformed timestamps, missing required media, bad ranges
  - custom font without Flutter asset mapping => fail
  - custom font with mapping metadata => pass/warn as designed

## D. Editor integration tests
- [ ] Extend `src/contexts/BookEditorContext.overlay-*.test.tsx`
  - publish gate pass/fail behavior
  - normalization applied before save/publish

## E. Reader integration tests
- [ ] Add `src/components/reader/` tests for active-word parity and highlight precedence.

---

## Definition of Done

A book edited on web is considered "Flutter polished" when:
1. All pages pass mobile readiness checks.
2. Overlay JSON is canonical and schema-compatible.
3. Narration word highlighting indices match mobile for identical inputs.
4. Highlight token values are mobile-compatible; full interaction parity is tracked as a subsequent phase.
5. Publish gate prevents mobile-breaking regressions.

---

## Suggested Execution Order

1. Phase 1 (Normalization)
2. Phase 2 (Word Sync Parity)
3. Phase 4 (Publish Gate)
4. Phase 3 (Highlight Semantics)
5. Phase 5 (Flutter Preview)
6. Phase 6 (Playback Session Deepening)

This order minimizes mobile regressions early while allowing architecture improvements to land safely afterward.

---

## Governance Artifact

In addition to this plan and the `mobile-compat` skill instructions, maintain a versioned contract artifact (e.g. `specs/mobile-compat-contract.json`) that includes:
- canonical highlight tokens
- overlay/narration schema rules
- font compatibility + Flutter asset mapping requirements
- readiness fail/warn rule set

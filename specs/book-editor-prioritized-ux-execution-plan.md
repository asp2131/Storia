# Book Editor Prioritized UX Execution Plan

This spec operationalizes the selected improvements:

1. Right-panel task modes (Narration | Soundscape | Library)
2. Contextual mini-toolbar for selected text overlays
3. Save confidence + recovery UX
4. Page readiness indicators
5. Clear AI generation flow (Target → Voice → Generate → Review)

---

## Goals

- Reduce creator uncertainty (save state + async generation clarity)
- Reduce cognitive load in the editor sidebar
- Speed up page-level production workflows
- Make project readiness obvious at a glance

## Non-Goals

- Full visual redesign of editor layout
- New backend media pipeline
- New AI providers or voice models

---

## Current Surface Area

Primary components:

- `src/components/editor/OverlayEditorPanel.tsx`
- `src/components/editor/PageManagerPanel.tsx`
- `src/components/editor/AudioLibraryPanel.tsx`
- `src/components/editor/NarrationPanel.tsx`
- `src/components/text-overlay/DraggableTextOverlayEditor` (and related overlay components)
- `src/contexts/BookEditorContext.tsx` (+ split context hooks)

---

## Delivery Strategy (Incremental PR Slices)

### Sprint A (high-confidence, high-impact)

- **A1** Save confidence + recovery UX (#3)
- **A2** Page readiness indicators (#4)
- **A3** Right-panel task mode shell (#1, tabs only)

### Sprint B (workflow quality)

- **B1** Complete task mode migration (#1)
- **B2** AI generation flow stepper + explicit states (#6)
- **B3** Contextual mini-toolbar for selected overlays (#2)

---

## A1 — Save Confidence + Recovery UX (#3)

### User Experience

- Persistent status chip in footer/header:
  - `Unsaved changes`
  - `Saving…`
  - `Saved`
  - `Save failed` (with retry)
- Secondary label: `Last saved 12s ago`
- On unexpected reload with local draft present: `Restore last autosave?` dialog/toast

### Implementation

#### State model additions (BookEditorContext)

Add/derive:

- `saveState: "idle" | "dirty" | "saving" | "saved" | "error"`
- `lastSavedAt: number | null`
- `lastSaveError: string | null`
- `draftRecoveryAvailable: boolean`

#### Autosave behavior

- Debounced autosave (2.5–4s) on meaningful changes
- Optimistic state transitions:
  - any edit => `dirty`
  - autosave start => `saving`
  - success => `saved + lastSavedAt`
  - failure => `error`

#### Recovery mechanism

- Save local draft snapshots to `localStorage` keyed by `bookId`
- On mount, if unsynced draft timestamp is newer than server state => show restore prompt
- Recovery actions:
  - `Restore draft`
  - `Discard local draft`

### Component updates

- `OverlayEditorPanel.tsx` footer status area for save chip + last saved + retry CTA
- Optional lightweight top-level toast component for restore prompt

### Acceptance Criteria

- No user action required for routine saving
- Save status updates within 100ms of state changes
- Reload after disconnected save failure can restore local changes
- Recovery flow covered by tests

### Tests

- Unit: save state transitions and debounce behavior
- Integration: localStorage recovery prompt appears under correct freshness rules

---

## A2 — Page Readiness Indicators (#4)

### User Experience

Each page thumbnail shows compact readiness dots/icons for:

- Illustration present
- Overlay text present
- Narration present
- Soundscape present (optional)

Also surface a per-page aggregate status:

- `Ready` (required checks pass)
- `Needs attention` (missing required checks)

### Implementation

#### Derivation utility

Create helper (e.g. `src/lib/editor/pageReadiness.ts`):

- `computePageReadiness(page, pageAudioMap)`
- Returns:
  - `hasImage`
  - `hasText`
  - `hasNarration`
  - `hasSoundscape`
  - `isReady`
  - `missing: string[]`

#### UI integration

- Update `PageManagerPanel.tsx` thumbnail badges to include readiness row
- Tooltip/hover text for missing items

### Acceptance Criteria

- Sidebar allows scanning missing content across all pages quickly
- Status updates immediately when page content changes

### Tests

- Unit tests for readiness computation
- Integration tests ensuring thumbnail status updates after assignment/generation/delete

---

## A3/B1 — Right-Panel Task Modes (#1)

### User Experience

Right panel top segmented control:

- `Narration`
- `Soundscape`
- `Library`

Behavior:

- Only active mode content is expanded
- Per-mode state is preserved (search query, selected category, expanded sync preview)
- Optional notification badges (e.g. pending actions)

### Implementation

#### Mode shell (A3)

- Introduce `activeAudioMode` in audio panel local state
- Extract existing panel sections into subcomponents:
  - `NarrationModePanel`
  - `SoundscapeModePanel`
  - `LibraryModePanel`

#### Full migration (B1)

- Remove duplicated controls across sections where possible
- Ensure action parity from existing panel

### Components

- Refactor `AudioLibraryPanel.tsx` into mode-driven layout
- Reuse existing `NarrationPanel` internals if useful; avoid duplicate business logic

### Acceptance Criteria

- No feature loss vs current audio tooling
- Task completion (assign/generate/play) requires less vertical scrolling

### Tests

- Integration tests for mode switching and state persistence
- Regression tests for assignment/generation actions under each mode

---

## B2 — AI Generation Flow Clarity (#6)

### User Experience

Replace ambiguous action area with explicit 4-step flow:

1. **Target**: This page or selected text
2. **Voice**: Voice picker/settings or overlay multi-voice notice
3. **Generate**: single clear CTA
4. **Review**: play, regenerate, assign/keep

Show explicit generation phases:

- `Preparing text`
- `Generating voices`
- `Stitching audio`
- `Saving assignment`
- `Done` / `Failed`

### Implementation

- Re-map existing `generatingPhase` to user-facing labels
- Add deterministic UI state machine in Narration mode panel:
  - `idle | configuring | generating | reviewing | error`
- Add action chips for last generated result metadata (duration, voice, generated at)

### Acceptance Criteria

- Users can always tell what stage generation is in
- Failure state includes specific next action (`Retry`, `Edit text`, `Switch voice`)

### Tests

- UI state-machine tests for all phase transitions
- Error rendering tests for phase-specific failures

---

## B3 — Contextual Mini-Toolbar for Overlay Text (#2)

### User Experience

When an overlay text element is selected, show a floating toolbar anchored near it:

- Font size +/-
- Voice assignment quick picker
- Duplicate
- Delete
- Lock/Unlock

Rules:

- Never render off-screen (collision-aware positioning)
- Keyboard support for critical actions
- Hide when no selection

### Implementation

#### Overlay integration

- In overlay editor layer, compute selected element bounds
- Position toolbar with viewport clamping
- Dispatch existing store/context actions from toolbar

#### API/state additions

- Ensure selected element state exposes editable props and mutation actions
- Add lock flag if not already available

### Acceptance Criteria

- Common text edits require fewer panel interactions
- Toolbar appears <100ms after selection
- No overlap bugs in typical viewport sizes

### Tests

- Interaction tests for toolbar actions (duplicate/delete/lock/font changes)
- Positioning tests (edge/corner collision scenarios)

---

## Cross-Cutting Technical Notes

- Prefer deriving UI state from existing context selectors to avoid duplicated source-of-truth.
- Keep async actions idempotent where possible (save, assign, generate retry).
- Use small presentational subcomponents for mode panels and readiness badges.
- Maintain accessibility:
  - semantic buttons
  - focus states
  - keyboard navigation in tabs/toolbar

---

## Instrumentation (Optional but Recommended)

Track lightweight events:

- `editor_save_state_changed`
- `editor_restore_draft_prompt_shown`
- `editor_restore_draft_accepted`
- `editor_audio_mode_changed`
- `editor_narration_generate_started/succeeded/failed`
- `editor_overlay_toolbar_action`

Success signals:

- Reduced manual saves
- Reduced generation retries caused by confusion
- Faster completion time from page start to “ready”

---

## Risks & Mitigations

1. **Context complexity growth**
   - Mitigation: extract UI-only state to panel-local hooks where possible.

2. **Regression in audio assignment flows**
   - Mitigation: add integration tests before panel refactor, maintain parity checklist.

3. **Autosave race conditions**
   - Mitigation: sequence/token-based save resolution, last-write-wins with timestamp checks.

4. **Overlay toolbar positioning edge cases**
   - Mitigation: viewport-clamped anchor utility + test matrix.

---

## Definition of Done

- All five selected UX improvements shipped behind no regressions in core editor flows.
- Acceptance criteria for each section met.
- New tests added for save confidence, readiness derivation, mode switching, AI phase flow, and toolbar interactions.
- Spec remains source of truth for follow-up iterations.

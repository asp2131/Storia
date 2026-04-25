# Cross-Platform Word Pronunciation Spec

Status: In progress  
Date: 2026-04-22  
Last updated: 2026-04-23  
Scope: Storia web + storia-mobile  
Related feature: Tap or long-press a word to hear a broken-down pronunciation flow instead of only hearing the whole word

## Implementation status snapshot

This spec now doubles as a progress tracker for the current implementation state in the repo.

### Status legend

- **Done** — implemented and present in the current codebase
- **Partial** — some meaningful implementation exists, but the spec intent is not fully complete
- **Not started** — no corresponding implementation was found yet

### Current progress summary

#### Done
- Phase 1: **1.2**, **1.3**
- Phase 2: **2.1**, **2.3**, **2.4**
- Phase 4: **4.1**, **4.2**, **4.3**, **4.5**
- Phase 6: **6.1**

#### Partial
- Phase 0: **0.1**, **0.2**, **0.3**
- Phase 1: **1.1**
- Phase 2: **2.2**
- Phase 3: **3.1**, **3.2**, **3.4**
- Phase 4: **4.4**
- Phase 6: **6.2**, **6.4**, **6.5**

#### Not started
- Phase 3: **3.3**
- Phase 5: **5.1**, **5.2**, **5.3**, **5.4**
- Phase 6: **6.3**

### Biggest remaining gaps

1. **Mobile integration is still not done.** The web reader is manifest-backed, but mobile still uses the older TTS-based long-press pronunciation path and does not yet consume the shared pronunciation manifest contract.
2. **Editorial tooling is still not built.** Generation and validation exist, but editor review, preview, override, and publish-readiness workflows are still missing.
3. **The implemented manifest is simpler than the full proposed schema.** The current contract supports `fullWord` / `breakdown` plus some metadata, but not the full richer authoring/runtime shape proposed later in this spec.
4. **QA / rollout work is incomplete.** Core unit coverage exists, but the full manual QA matrix, staged rollout, and post-launch monitoring/readiness work are not complete.

---

## 1. Product Spec

### 1.1 Problem

Today, Storia word interaction primarily supports hearing the whole word. That helps recognition, but it does not consistently teach how a word sounds when broken into smaller units.

For early readers, struggling readers, and practice-mode use cases, Storia needs a pronunciation experience that can:

- break words down into syllables or learner-friendly phonetic chunks
- optionally replay the full word after the breakdown
- preserve fast reading flow during narration
- work consistently across web and mobile
- support editor review and override for names, invented words, and unusual pronunciations

### 1.2 Goal

Enable cross-platform word pronunciation playback so a user can hear a word broken down phonetically or syllabically, with fallback to whole-word playback when pronunciation assets are unavailable.

### 1.3 Non-goals

Not in initial scope:

- full IPA-first education workflow for every reader
- replacing `WordTimestamp` narration sync logic
- real-time phoneme synthesis as primary production path
- forcing one universal gesture model across all reader modes on day one
- auto-generating perfect pronunciations for all fantasy/proper-noun vocabulary without editorial override

### 1.4 Users

Primary users:

- child readers using tap/long-press help in reader
- parents/caregivers supporting decoding practice
- editors/content operators preparing book content

Secondary users:

- QA verifying interaction and fallback behavior
- product/learning teams evaluating reading outcomes

### 1.5 User stories

#### Reader stories

- As a child reader, when I interact with a word, I want to hear it broken into learnable pieces so I can decode it in the same narration-consistent voice.
- As a child reader, if I only want quick help, I want a fast fallback that still plays the full word.
- As a reader in narration mode, I want pronunciation help without losing my place.
- As a reader on mobile or web, I want word help to behave consistently.

#### Editor stories

- As an editor, I want generated pronunciations for words in a book so I do not have to author every entry manually.
- As an editor, I want to override bad pronunciations for names, rare words, or invented words.
- As an editor, I want to preview breakdown audio before publishing.

### 1.6 UX principles

- Keep reading flow fast.
- Never break existing narration/highlighting.
- Always provide fallback.
- Prefer narrator-consistent audio over device-default TTS when available.
- Preserve cross-platform gesture consistency where possible.
- Let editorial overrides beat automation.

### 1.7 Recommended interaction model

Based on mobile compatibility analysis:

- Current mobile behavior:
  - tap word = speak word
  - long-press word = sound out by syllables, then full word

Recommended rollout:

#### Phase 1 interaction

- Tap word = current quick whole-word playback
- Long-press word = pronunciation breakdown flow
- If no pronunciation asset exists, long-press falls back to whole-word playback

#### Phase 2 interaction

Feature-flagged or settings-based mode:

- Optional setting: `Tap words to hear sounded-out pronunciation`
- Practice mode may enable pronunciation-on-tap earlier than general reading mode

#### Phase 3 interaction

Adaptive model:

- Early reader mode: tap = breakdown, long-press = alternative help or repeat
- Standard mode: tap = full word, long-press = breakdown

### 1.8 Pronunciation playback behavior

When pronunciation breakdown is triggered:

1. Resolve normalized word entry.
2. Look up pre-generated pronunciation asset.
3. If present, play learner-help sequence:
   - chunk/syllable breakdown audio, or precomposed breakdown clip
   - optional short pause
   - full-word pronunciation audio
4. If missing, play existing whole-word audio/TTS fallback.
5. Restore prior reading state according to playback policy.

### 1.9 Narration coexistence policy

Initial policy:

- if narration is active, pause narration
- play pronunciation interaction
- resume narration from prior position

Reason:

- lower risk than ducking/mixing
- simpler state management across web and mobile
- less chance of corrupting highlight sync

### 1.10 Content model expectations

Pronunciation data should be:

- generated ahead of time where possible
- cached and portable across clients
- attachable to book/page/word contexts without changing narration timestamp behavior
- overrideable by editors before publish

### 1.11 Success metrics

Product metrics:

- increase in successful pronunciation help interactions
- low interaction latency for first play and repeat play
- low fallback/error rate
- reduced mispronunciation complaints from editors/QA
- improved comprehension/practice completion metrics in reading-practice cohorts

Operational metrics:

- pronunciation coverage by published book
- override rate by editors
- generation failure rate
- asset cache hit rate

### 1.12 Accessibility requirements

- word interaction remains keyboard/touch accessible on web where feasible
- screen-reader labeling must not become worse than current behavior
- long-press behavior must still have alternate access path if needed
- no color-only reliance for state feedback
- audio control state changes must remain understandable in reader UI

### 1.13 Acceptance criteria

- Missing pronunciation data never breaks existing word interaction.
- Existing narration highlight sync still works.
- Pronunciation interaction works on web and mobile using same published data shape.
- Proper nouns and custom vocabulary can be overridden in editorial workflow.
- Narration resumes correctly after pronunciation playback.
- Long-press and tap semantics remain testable and predictable.
- Reader can still complete a book with feature disabled, partially available, or fully available.

### 1.14 Web functional requirements

This section is the consolidated, implementation-ready web deliverable for phase 1. It combines:
- web reader scope extracted from the cross-platform product spec
- web-specific functional requirements for interaction, accessibility, lookup, loading, playback, and fallback behavior
- QA acceptance criteria, edge-case coverage, and release sign-off checks

Current implementation constraints that this section intentionally addresses:
- web currently supports click / `Enter` / `Space` for whole-word playback, but not long-press breakdown playback
- interactive overlay words currently render inside an `aria-hidden` subtree, so accessibility remediation is required before release
- current web pronunciation playback does not yet coordinate with narration pause/resume state
- current web reader data exposes page-level pronunciation maps, while the recommended long-term contract is a shared published manifest

#### 1.14.1 Interaction triggers

- **FR-WEB-01:** In standard reading mode, pointer click/tap on a word must trigger the existing quick whole-word playback path.
- **FR-WEB-02:** Pointer press-and-hold on a word for at least `450ms` must trigger pronunciation breakdown playback.
- **FR-WEB-03:** When a long-press is recognized, the web reader must suppress the click-triggered whole-word playback for that same gesture.
- **FR-WEB-04:** If the phase-1 pronunciation feature flag is disabled, all word interactions must continue to use existing whole-word playback behavior.
- **FR-WEB-05:** If a reader-level `pronunciation-on-tap` experiment is enabled, pointer click/tap must trigger pronunciation breakdown instead of whole-word playback.

#### 1.14.2 Keyboard and accessibility access

- **FR-WEB-06:** Each interactive word must remain keyboard focusable through the existing word interaction model or an equivalent accessible wrapper.
- **FR-WEB-07:** Pressing `Enter` or `Space` on a focused word must trigger the same whole-word playback behavior as pointer click in the active reader mode.
- **FR-WEB-08:** The web reader must expose a keyboard-accessible secondary action for breakdown playback so long-press is not the only way to trigger it on web.
- **FR-WEB-09:** The secondary breakdown action must be announced with an accessible name equivalent to `Sound out word` or `Hear word breakdown`.
- **FR-WEB-10:** Adding pronunciation support must not reduce current screen-reader labeling quality for interactive words.

#### 1.14.3 Word resolution and lookup

- **FR-WEB-11:** On every pronunciation interaction, the client must resolve the visible token text, normalize it using the shared normalization rules, and look up the matching entry in the published pronunciation manifest.
- **FR-WEB-12:** The same normalization rules used on web must match the backend/mobile contract for lowercase handling, punctuation stripping, apostrophes, hyphens, and unicode normalization.
- **FR-WEB-13:** If a rendered token cannot be normalized into a valid lookup key, the reader must skip manifest lookup and fall back to the current whole-word path without throwing an error.
- **FR-WEB-14:** The client must support partial pronunciation coverage; words without manifest entries must remain interactive through the existing fallback behavior.

#### 1.14.4 Manifest loading and caching

- **FR-WEB-15:** The web reader must know whether a book has pronunciation support before or during reader load via `hasPronunciations`, `pronunciationManifestUrl`, or an equivalent published contract.
- **FR-WEB-16:** If a manifest URL exists, the reader must fetch the pronunciation manifest no later than first pronunciation interaction and may preload it when the reader opens.
- **FR-WEB-17:** Manifest fetch state must be cached per book for the lifetime of the reader session so repeated word interactions do not refetch the manifest unnecessarily.
- **FR-WEB-18:** Manifest fetch failure must not block reading; the reader must fall back to existing whole-word playback and record a failure/fallback analytics event.
- **FR-WEB-19:** Audio assets referenced by pronunciation entries must be playable from stable CDN or approved bucket URLs and benefit from normal browser caching.

#### 1.14.5 Playback sequence and narration coexistence

- **FR-WEB-20:** When breakdown playback is triggered and narration is currently playing, the reader must pause narration before starting pronunciation audio.
- **FR-WEB-21:** When breakdown playback is triggered while narration is already paused, the reader must not auto-start narration before or during the pronunciation sequence.
- **FR-WEB-22:** The default breakdown playback sequence on web must be: breakdown clip if available, then optional short pause, then full-word clip if available.
- **FR-WEB-23:** If no breakdown clip exists but a full-word pronunciation clip exists in the manifest entry, the reader must play the full-word clip.
- **FR-WEB-24:** If no usable pronunciation audio exists in the manifest entry, the reader must fall back to the existing whole-word playback path.
- **FR-WEB-25:** After pronunciation playback completes, narration must resume only if narration had been actively playing immediately before the pronunciation interaction began.
- **FR-WEB-26:** If the user manually pauses narration during or immediately after pronunciation playback, the reader must respect the latest user intent and must not auto-resume narration.
- **FR-WEB-27:** The reader must prevent overlapping pronunciation sequences; a new pronunciation request must cancel, replace, or ignore the prior one according to a single deterministic policy.
- **FR-WEB-28:** Rapid repeated interactions on the same or different words must not corrupt playback state, active page state, or narration resume state.

#### 1.14.6 UI state and feedback

- **FR-WEB-29:** Pronunciation playback must not break existing overlay rendering, active-word highlighting, or narration timestamp sync.
- **FR-WEB-30:** If the reader already distinguishes tapped/spoken/narration-active word states, pronunciation playback must map to those existing states without introducing conflicting simultaneous highlights.
- **FR-WEB-31:** The reader must provide perceivable feedback when pronunciation help is triggered, such as an existing highlight state, active control state, or equivalent non-color-only signal.
- **FR-WEB-32:** If a pronunciation request fails after interaction begins, the reader must exit any transient loading state and leave the page interactive.

#### 1.14.7 Settings, flags, and mode handling

- **FR-WEB-33:** Web pronunciation behavior must be gated by a feature flag so rollout can be disabled without removing existing word interactions.
- **FR-WEB-34:** The reader must support a settings or experiment path that allows `tap = breakdown` without requiring a separate content contract.
- **FR-WEB-35:** Practice mode, if enabled on web, must be able to opt into pronunciation-on-tap independently from standard reading mode.

#### 1.14.8 Analytics and observability

- **FR-WEB-36:** The web reader must emit an analytics event for each pronunciation interaction attempt.
- **FR-WEB-37:** Analytics payloads must include, where available: `bookId`, `pageId`, normalized word key, trigger source (click, long-press, keyboard, alternate control), playback path taken, and feature-flag/mode state.
- **FR-WEB-38:** The reader must distinguish successful manifest-backed playback from fallback whole-word playback and manifest-load failure.
- **FR-WEB-39:** The reader should capture pronunciation interaction latency and cancellation/interruption outcomes.

#### 1.14.9 Web acceptance checklist

A phase-1 web implementation is acceptable only if all of the following pass:

- **AC-WEB-01:** Click/tap still plays the whole word when the feature flag is off.
- **AC-WEB-02:** Long-press on a supported word plays breakdown audio and does not double-play whole-word audio.
- **AC-WEB-03:** Long-press on an unsupported word falls back to the existing whole-word path.
- **AC-WEB-04:** `Enter`/`Space` on a focused word works, and the breakdown action is reachable without pointer long-press.
- **AC-WEB-05:** Narration playing -> pronunciation interaction -> narration resume works without losing place.
- **AC-WEB-06:** Narration paused -> pronunciation interaction does not unexpectedly start narration.
- **AC-WEB-07:** Repeated rapid interactions do not leave the reader in a stuck loading or paused state.
- **AC-WEB-08:** Overlay text, active highlights, and page navigation continue to function during and after pronunciation playback.
- **AC-WEB-09:** Manifest fetch failure, missing entry, or missing audio never breaks the page and always leaves a usable fallback path.
- **AC-WEB-10:** Analytics are emitted for success, fallback, and failure paths.

#### 1.14.10 Detailed web acceptance criteria by scenario

The following criteria define the minimum web QA bar for sign-off. Each row should be testable in automated integration coverage where practical and in manual browser QA for final release.

| ID | Scenario | Preconditions | Action | Expected result |
|---|---|---|---|---|
| **AC-WEB-11** | Manifest present, supported word | Feature flag on; manifest loaded or loadable; selected word has valid breakdown asset | Long-press word, or invoke keyboard-accessible breakdown action | Breakdown path starts within the normal interaction latency target, whole-word click path is suppressed for that gesture, and playback follows manifest-backed sequence |
| **AC-WEB-12** | Manifest present, entry missing | Feature flag on; manifest available; selected word has no matching manifest entry | Trigger breakdown on unsupported word | No uncaught error occurs; existing whole-word playback path runs; reader remains interactive; fallback analytics event is emitted |
| **AC-WEB-13** | Manifest URL present but fetch fails | Feature flag on; manifest URL returns timeout, network error, or non-2xx | Trigger first breakdown interaction | Reader does not stall; request fails gracefully; whole-word fallback remains available; failure analytics event is emitted once per interaction attempt |
| **AC-WEB-14** | Manifest absent by contract | Feature flag on; reader payload indicates no pronunciation support | Interact with words via click, keyboard, and alternate breakdown affordance if shown | Existing whole-word behavior remains intact, no broken loading state appears, and no pronunciation-only UI path blocks reading |
| **AC-WEB-15** | Narration active before pronunciation | Narration currently playing and synced on page | Trigger breakdown on a word with pronunciation support | Narration pauses before pronunciation audio begins, pronunciation plays once, and narration resumes only from the saved pre-interaction position/state |
| **AC-WEB-16** | Narration already paused before pronunciation | Narration loaded but paused by user or reader state | Trigger breakdown on a word with pronunciation support | Pronunciation plays without auto-starting narration, and narration remains paused when pronunciation finishes |
| **AC-WEB-17** | User intent overrides auto-resume | Narration was active at interaction start | While pronunciation is playing or immediately after, user pauses/stops narration or navigates away | Reader respects latest user intent; no delayed auto-resume restarts narration afterward |
| **AC-WEB-18** | Rapid repeated interactions on same word | Feature flag on; supported word visible | Trigger breakdown repeatedly in quick succession | Playback policy remains deterministic (cancel/replace/ignore as specified), no overlapping audio persists, and reader state is not left stuck |
| **AC-WEB-19** | Rapid repeated interactions across different words | Feature flag on; multiple interactive words visible | Trigger word A then word B before A completes | Final playback outcome follows defined replacement policy, narration resume state reflects only the latest surviving interaction, and no stale highlight/loading state remains |
| **AC-WEB-20** | Keyboard whole-word access | Interactive word is focusable | Focus word with keyboard and press `Enter` and `Space` in separate trials | Result matches active pointer click/tap behavior for the current mode, without duplicate playback |
| **AC-WEB-21** | Keyboard breakdown access | Interactive word is focusable and alternate breakdown control is exposed | Invoke breakdown via keyboard-only path | Breakdown action is reachable without pointer long-press, has an accessible name, and triggers the same supported/fallback logic as pointer breakdown |
| **AC-WEB-22** | Screen-reader compatibility baseline | Interactive words rendered in reader | Inspect accessibility tree and operate with screen reader enabled | Pronunciation support does not hide interactive words from assistive tech, does not regress labels, and does not rely on `aria-hidden` content as the only accessible path |
| **AC-WEB-23** | Slow network manifest load | Devtools throttling or equivalent slow network simulation enabled | Open reader and trigger first breakdown before manifest fetch completes | Reader shows at most transient non-blocking loading feedback, remains responsive, avoids duplicate fetch storms, and eventually resolves to manifest-backed playback or fallback |
| **AC-WEB-24** | Slow network audio asset load | Manifest entry exists but audio asset responds slowly | Trigger breakdown on supported word | Reader remains interactive during asset wait, does not permanently lock highlight/loading UI, and either plays once asset is ready or exits cleanly to fallback/error state |
| **AC-WEB-25** | Feature flag off | Pronunciation feature flag disabled | Click, long-press, keyboard whole-word, keyboard breakdown control attempts | Existing whole-word behavior remains canonical; pronunciation-specific handlers or controls are suppressed or safely inert |
| **AC-WEB-26** | Pronunciation-on-tap experiment on | Feature flag on and experiment/mode configured for tap=breakdown | Click/tap word and invoke keyboard action | Tap/keyboard primary action now follows breakdown behavior, alternate semantics remain predictable, and analytics reflect experiment state |
| **AC-WEB-27** | Practice mode variant | Practice mode enabled independently of standard mode | Interact with words in practice mode | Practice-mode mapping follows configured pronunciation policy without changing standard reading mode behavior outside practice mode |
| **AC-WEB-28** | Page navigation during pending pronunciation work | Reader begins manifest fetch or pronunciation playback | Navigate to another page before request/playback completes | In-flight work is cancelled or safely ignored for prior page, no cross-page audio leakage occurs, and destination page remains stable |

#### 1.14.11 Edge-case coverage for QA

QA must explicitly exercise the following edge cases rather than relying only on happy-path checks:

- **EC-WEB-01:** Empty/invalid normalized token (for example punctuation-only or malformed unicode token) falls back without throwing.
- **EC-WEB-02:** Word exists in manifest but entry has only `fullWord` audio and no `breakdown` audio; full-word manifest clip is used.
- **EC-WEB-03:** Word exists in manifest but referenced audio URL returns `404`/`403`; reader exits transient state and keeps page usable.
- **EC-WEB-04:** Long-press pointer is released before threshold; click/tap behavior should follow normal short-press behavior only.
- **EC-WEB-05:** Long-press threshold reached, then pointer moves away/cancels; playback policy remains deterministic and does not double-trigger.
- **EC-WEB-06:** Multiple supported words are activated in under `1s`; only the allowed final playback survives.
- **EC-WEB-07:** User triggers pronunciation while narration is buffering, not yet started, or ending; reader does not misclassify narration state for resume.
- **EC-WEB-08:** Keyboard user tabs quickly between words and activates breakdown repeatedly; focus order and visible focus state remain intact.
- **EC-WEB-09:** Feature flag changes between sessions or reloads; cached manifest state does not incorrectly force stale behavior.
- **EC-WEB-10:** Browser refresh/reopen after prior manifest failure can recover normally once network is restored.

#### 1.14.12 Manual QA checklist for release sign-off

Use this checklist for browser/device sign-off. Every item should be marked pass/fail with evidence.

**Core interaction**
- [ ] Click/tap whole-word behavior still works with pronunciation flag off.
- [ ] Long-press threshold reliably triggers breakdown without also firing click playback.
- [ ] Unsupported words fall back to existing whole-word behavior.
- [ ] Repeated interactions do not create overlapping playback or stuck UI.

**Manifest and network handling**
- [ ] Reader behaves correctly when manifest is present and cached.
- [ ] Reader behaves correctly when manifest is missing by contract.
- [ ] Reader behaves correctly when manifest fetch fails.
- [ ] Reader remains usable on slow network during first manifest and first audio load.
- [ ] Repeated interactions do not refetch manifest unnecessarily within the same reader session.

**Narration coexistence**
- [ ] Narration active -> pronunciation -> resume restores correct reading state.
- [ ] Narration paused -> pronunciation leaves narration paused.
- [ ] User pause/stop/navigation during pronunciation prevents unwanted auto-resume.
- [ ] Page navigation during pronunciation does not leak audio or corrupt page state.

**Accessibility and keyboard**
- [ ] Interactive words are reachable in logical keyboard order.
- [ ] `Enter` and `Space` activate the primary word action.
- [ ] Breakdown action is reachable without pointer long-press.
- [ ] Accessible naming for breakdown action is announced correctly.
- [ ] No regression in screen-reader exposure of interactive words versus baseline.
- [ ] Triggered state is perceivable without relying on color alone.

**Flags and mode variants**
- [ ] Flag off: existing behavior only.
- [ ] Flag on + standard mode: click/tap stays whole-word, long-press/alternate action triggers breakdown.
- [ ] Flag on + pronunciation-on-tap experiment: primary action changes to breakdown as specified.
- [ ] Practice mode can opt into pronunciation-on-tap independently of standard mode.

**Observability**
- [ ] Success analytics fire for manifest-backed playback.
- [ ] Fallback analytics fire for manifest miss / missing asset paths.
- [ ] Failure analytics fire for manifest load or playback failure paths.
- [ ] Analytics payload includes trigger source and mode/flag context.

#### 1.14.13 Suggested web QA matrix

Minimum matrix for manual verification before rollout:

| Dimension | Required coverage |
|---|---|
| Browsers | Latest Chrome, Safari, Firefox desktop; at least one mobile browser path if web reader ships there |
| Input modes | Mouse, trackpad/touch, keyboard-only |
| Accessibility | Screen reader spot check plus keyboard-only traversal |
| Network | Normal, slow 3G-equivalent, offline/failing manifest request |
| Feature variants | Flag off, flag on standard mode, flag on pronunciation-on-tap experiment, practice mode variant |
| Content variants | Manifest present with full support, manifest present with partial support, manifest absent, manifest fetch failure |
| Audio states | Narration playing, narration paused, narration buffering/ending, no narration loaded |

#### 1.14.14 Implementation-ready checklist

The web reader implementation is ready for engineering sign-off only when all of the following are defined in tickets, designs, or code tasks:

**Interaction and accessibility**
- [ ] Long-press threshold and cancellation behavior are fixed at the product level.
- [ ] Click/tap, keyboard primary action, and alternate breakdown action semantics are documented for standard mode, pronunciation-on-tap mode, and practice mode.
- [ ] An accessible, non-long-press breakdown affordance is chosen and included in the reader design.
- [ ] Interactive words are no longer dependent on an `aria-hidden` subtree as the only interaction surface.

**Data and loading contract**
- [ ] Reader payload exposes `hasPronunciations`, `pronunciationManifestUrl`, or an equivalent contract.
- [ ] Shared normalization rules are documented once and referenced by web, mobile, and backend work.
- [ ] Manifest-present, manifest-absent, and manifest-fetch-failure paths are each implemented explicitly.
- [ ] Per-book manifest caching and stale-state reset behavior are specified.

**Playback state machine**
- [ ] Narration-active -> pause -> pronunciation -> conditional resume flow is implemented.
- [ ] Narration-paused -> pronunciation -> remain paused flow is implemented.
- [ ] User override behavior during/after pronunciation playback is defined to win over auto-resume.
- [ ] Repeated interactions use a single deterministic concurrency policy, with cancel-and-replace as the phase-1 default.
- [ ] Page navigation cancels or safely ignores in-flight manifest/audio work from the prior page.

**Fallbacks and observability**
- [ ] Unsupported tokens, missing entries, and missing/unplayable audio all resolve to a usable reader state.
- [ ] Success, fallback, failure, and cancellation analytics are emitted with trigger source and mode context.
- [ ] Transient loading/active UI states clear correctly on success, replacement, cancellation, and failure.

**QA readiness**
- [ ] AC-WEB-01 through AC-WEB-28 have an owner and a verification plan.
- [ ] EC-WEB-01 through EC-WEB-10 are covered in test design or manual QA notes.
- [ ] The browser/input/accessibility/network matrix in section `1.14.13` is scheduled for release sign-off.

#### 1.14.15 Open web gaps requiring explicit resolution

These gaps are not blockers to documenting the requirements, but they are blockers or near-blockers for implementation/release if left unresolved:

- **WG-WEB-01 — Accessible breakdown action:** choose the keyboard/screen-reader reachable secondary action that exposes breakdown playback without long-press.
- **WG-WEB-02 — Overlay accessibility remediation:** remove dependency on `aria-hidden` interactive content or provide an equivalent accessible interaction surface with matching labels and order.
- **WG-WEB-03 — Narration/pronunciation arbitration:** finalize the exact state machine for pause, cancel, replace, resume, and user override.
- **WG-WEB-04 — Manifest migration path:** define how the web reader supports current page-level pronunciation data while moving toward the shared manifest contract.
- **WG-WEB-05 — Loading/cache strategy:** decide preload vs first-use fetch, audio prefetch aggressiveness, and stale-cache behavior for repeated sessions.
- **WG-WEB-06 — Visual state model:** confirm whether pronunciation playback reuses existing active-word states or introduces a distinct non-conflicting state.
- **WG-WEB-07 — Pointer-type behavior:** verify whether long-press policy applies uniformly across mouse, touch, stylus, and browser-specific pointer quirks.
- **WG-WEB-08 — Settings discoverability:** decide where pronunciation-on-tap and practice-mode behavior is surfaced without confusing child readers.

---

## 2. Engineering Phased Ticket List

> Progress snapshot as of 2026-04-23. Each ticket below is marked **Done**, **Partial**, or **Not started** based on the current repo state.

### Phase 0 — Discovery and contract lock

#### Ticket 0.1 — Finalize gesture semantics
**Status: Partial**
- Decide exact phase-1 behavior for tap vs long-press on web and mobile.
- Document differences by reader mode.
- Confirm accessibility alternative for long-press-only behavior.
- Notes: web phase-1 semantics are implemented, including long-press and a keyboard-accessible secondary action, but cross-platform parity is not complete because mobile still uses the older long-press TTS path.

#### Ticket 0.2 — Freeze playback state machine requirements
**Status: Partial**
- Define what happens when pronunciation starts during:
  - active narration
  - paused narration
  - soundscape on
  - practice mode
- Define pause/resume timing and cancellation behavior.
- Notes: the web playback state machine is implemented, including pause/resume and cancel-and-replace behavior, but it is not yet fully locked and aligned across web, mobile, and practice-mode behavior.

#### Ticket 0.3 — Approve canonical pronunciation asset strategy
**Status: Partial**
- Choose pre-generated audio assets as default production path.
- Define allowed fallback sources.
- Document why runtime-only TTS is not canonical.
- Notes: backend/web now clearly prefer pre-generated pronunciation assets, but mobile still relies on runtime TTS for the long-press help path.

### Phase 1 — Shared schema and API contracts

#### Ticket 1.1 — Add shared pronunciation manifest schema
**Status: Partial**
- Introduce cross-platform pronunciation data structure.
- Keep `WordTimestamp` unchanged.
- Support per-word breakdown and full-word refs.
- Notes: a shared manifest endpoint and shared normalization contract now exist with book-level metadata (`version`, `bookId`, `locale`, `defaultPlaybackMode`) and richer per-entry published fields (`id`, `normalizedWord`, nested `audio`, review/source metadata). This remains partial because mobile does not consume the manifest yet and the full richer authoring fields proposed later in this document are not all populated yet.

#### Ticket 1.2 — Define word normalization rules
**Status: Done**
- Lowercasing, punctuation stripping, apostrophe behavior, hyphen handling, unicode normalization.
- Ensure web and mobile resolve same key for same visible token.

#### Ticket 1.3 — Add publish-time validation rules
**Status: Done**
- Validate pronunciation entries map to actual rendered tokens where required.
- Warn on orphaned entries, duplicate normalized keys, or missing fallback audio.

### Phase 2 — Generation pipeline and storage

#### Ticket 2.1 — Build pronunciation generation job
**Status: Done**
- Input: book vocabulary set or page token set.
- Output: pronunciation manifest entries plus audio assets.
- Track source, confidence, and generation status.

#### Ticket 2.2 — Add storage model for pronunciation assets
**Status: Partial**
- Define where audio clips live.
- Store stable URLs/keys for breakdown and full-word audio.
- Support CDN/cache strategy.
- Notes: the current implementation stores stable asset URLs and generation output, but the full explicit storage model proposed here is not fully represented yet.

#### Ticket 2.3 — Add generation fallback chain
**Status: Done**
- Example order:
  - curated/editor override
  - dictionary/lexicon result
  - TTS generation
  - no asset => client fallback

#### Ticket 2.4 — Add backfill job for existing books
**Status: Done**
- Generate manifests for already-published catalog.
- Produce report: coverage, failures, override candidates.

### Phase 3 — Editorial tooling

#### Ticket 3.1 — Surface vocabulary review UI in web editor
**Status: Partial**
- Show extracted words per book/page.
- Show status: generated, overridden, missing, low-confidence.
- Notes: the web editor now includes a book-wide pronunciation generation panel with coverage summary, missing-page hints, and generate/regenerate controls wired to the existing backend generation flow. Full vocabulary review and per-entry status management are still not built.

#### Ticket 3.2 — Add pronunciation preview controls
**Status: Partial**
- Preview breakdown audio.
- Preview full-word audio.
- Preview phonetic/syllable display text.
- Notes: the web editor pronunciation panel now includes a searchable per-word review list with whole-word and breakdown preview buttons, plus basic status/source/confidence context. Richer phonetic/syllable display text and a fuller editorial review workflow are still not built.

#### Ticket 3.3 — Add override workflow
**Status: Not started**
- Editors can edit:
  - syllable chunks
  - learner-friendly phonetic display
  - preferred full-word text
  - audio source selection / uploaded replacement
- Mark entries as human-reviewed.

#### Ticket 3.4 — Add pre-publish checks
**Status: Partial**
- Prevent silent publish regressions for books requiring pronunciation coverage.
- Warn on unresolved low-confidence or missing critical words.
- Notes: validation exists in generation/publish-time flows, but the full editor-facing publish-readiness workflow is not built yet.

### Phase 4 — Web reader integration

#### Ticket 4.1 — Extend word interaction resolver
**Status: Done**
- On tap/long-press, resolve normalized word key.
- Request pronunciation manifest entry.
- Fall back safely when missing.

#### Ticket 4.2 — Add pronunciation playback controller
**Status: Done**
- Handle pause narration -> play interaction -> resume narration.
- Avoid collisions with existing playback state.
- Prevent overlapping pronunciation requests.

#### Ticket 4.3 — Preserve overlay/highlight behavior
**Status: Done**
- Keep existing tapped/spoken/narration-active states intact.
- Ensure pronunciation playback does not corrupt active word highlighting.

#### Ticket 4.4 — Add feature flag / settings path
**Status: Partial**
- Reader-level flag for pronunciation-on-tap experiments.
- Practice-mode enablement path.
- Notes: a web feature flag and tap-behavior setting exist, but the full practice-mode path described by the spec is not complete yet.

#### Ticket 4.5 — Add analytics events
**Status: Done**
- Track trigger source, fallback usage, latency, cancel rate, repeat plays.

### Phase 5 — Mobile reader integration

#### Ticket 5.1 — Extend mobile word interaction policy
**Status: Not started**
- Keep current mobile semantics in phase 1 unless flag changes them.
- Wire long-press to shared pronunciation manifest lookup.
- Notes: mobile still uses the older local TTS-based long-press pronunciation path.

#### Ticket 5.2 — Integrate with mobile audio engine safely
**Status: Not started**
- Preserve request ID / race-prevention behavior.
- Keep narration and soundscape channel logic stable.
- Resume narration reliably after pronunciation flow.

#### Ticket 5.3 — Align overlay token resolution with manifest lookup
**Status: Not started**
- Ensure tokenized words from overlay text map to same normalized keys as backend/web.

#### Ticket 5.4 — Add offline/cache support
**Status: Not started**
- Cache fetched pronunciation assets for smoother repeat playback.
- Define behavior when asset missing offline.

### Phase 6 — QA, testing, and rollout

#### Ticket 6.1 — Unit tests for normalization and manifest lookup
**Status: Done**
- punctuation variants
- capitalization variants
- contractions and hyphenated words
- proper noun overrides

#### Ticket 6.2 — Integration tests for playback state transitions
**Status: Partial**
- narration active -> pronunciation -> resume
- rapid repeated taps/long-presses
- manifest miss -> fallback
- feature flag on/off
- Notes: hook-level playback tests are in good shape on web, but full reader-level integration coverage is not complete yet.

#### Ticket 6.3 — Manual QA matrix across web and mobile
**Status: Not started**
- browser/device matrix
- offline/slow network behavior
- accessibility checks
- practice mode interactions

#### Ticket 6.4 — Staged rollout
**Status: Partial**
- internal only
- selected books
- practice mode cohort
- broader release
- Notes: web feature-flag gating exists, but the fuller staged rollout plan is not yet represented here as completed work.

#### Ticket 6.5 — Post-launch monitoring
**Status: Partial**
- monitor latency, failure, fallback, and editor override trends
- gather qualitative reading-support feedback
- Notes: pronunciation analytics events exist, but the broader post-launch monitoring loop is not complete yet.

---

## 3. Schema / API Proposal

### 3.1 Design goals

- One published pronunciation contract for both web and mobile
- No breaking change to existing narration timing/highlight data
- Support generated + human-reviewed entries
- Support fast manifest lookup from visible text tokens
- Allow partial coverage without hard failures

### 3.2 Proposed content model

Pronunciation data should live alongside existing book/page data, not inside `WordTimestamp`.

Recommended publish artifact:

- book-level pronunciation manifest for reusable vocabulary
- optional page-level index for fast lookup if needed

### 3.3 Proposed TypeScript shape

```ts
export type PronunciationSource =
  | 'editor_override'
  | 'dictionary'
  | 'tts_generated'
  | 'imported'
  | 'unknown';

export type PronunciationAudioAsset = {
  url: string;
  durationMs?: number;
  checksum?: string;
};

export type WordPronunciation = {
  id: string;
  normalizedWord: string;
  displayWord?: string;
  phoneticDisplay?: string; // learner-friendly, not strict IPA-only
  ipa?: string | null;
  syllables: string[];
  breakdownSegments?: string[]; // optional finer chunks than syllables
  source: PronunciationSource;
  confidence?: number | null;
  humanReviewed: boolean;
  audio?: {
    breakdown?: PronunciationAudioAsset;
    fullWord?: PronunciationAudioAsset;
    segments?: PronunciationAudioAsset[];
  };
  updatedAt: string;
};

export type BookPronunciationManifest = {
  version: 1;
  bookId: string;
  locale: string;
  defaultPlaybackMode?: 'whole_word' | 'breakdown_then_word';
  entries: Record<string, WordPronunciation>; // key = normalizedWord
};
```

### 3.4 Optional page-level binding

If product needs page-scoped overrides or per-page optimization:

```ts
export type PagePronunciationIndex = {
  pageId: string;
  words: string[]; // normalized keys used on page
};
```

Use only if needed. Prefer book-level deduplication first.

### 3.5 Proposed backend persistence model

Illustrative relational approach:

#### `book_pronunciations`
- `id`
- `book_id`
- `normalized_word`
- `display_word`
- `phonetic_display`
- `ipa`
- `syllables_json`
- `breakdown_segments_json`
- `source`
- `confidence`
- `human_reviewed`
- `created_at`
- `updated_at`

Unique index:
- `(book_id, normalized_word)`

#### `pronunciation_audio_assets`
- `id`
- `book_pronunciation_id`
- `asset_type` (`breakdown`, `full_word`, `segment`)
- `segment_index` nullable
- `url`
- `duration_ms`
- `checksum`
- `created_at`

Alternative:
- store manifest JSON directly on published book artifact and maintain normalized authoring tables internally

### 3.6 Proposed API surfaces

#### Option A — Inline on book payload at publish/runtime

Extend book fetch payload with pronunciation manifest reference or inline manifest.

Example:

```ts
export type PageData = {
  id: string;
  pageNumber: number;
  textContent: string;
  overlay?: TextOverlayConfig | null;
  imageUrl?: string | null;
  narrationUrl?: string | null;
  soundscapeUrl?: string | null;
  compositedImageUrl?: string | null;
  narrationTimestamps?: WordTimestamp[];
};

export type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  pageCount: number;
  pages: PageData[];
  pronunciationManifestUrl?: string | null;
};
```

Pros:
- simple client contract
- cacheable
- good for static/published reading

Cons:
- large manifest may not belong inline for big books

#### Option B — Dedicated runtime endpoint

```http
GET /api/books/:bookId/pronunciations
```

Response:

```json
{
  "version": 1,
  "bookId": "book_123",
  "locale": "en-US",
  "defaultPlaybackMode": "breakdown_then_word",
  "entries": {
    "adventure": {
      "id": "wp_1",
      "normalizedWord": "adventure",
      "displayWord": "adventure",
      "phoneticDisplay": "ad-VEN-chur",
      "ipa": null,
      "syllables": ["ad", "ven", "ture"],
      "breakdownSegments": ["ad", "ven", "chur"],
      "source": "editor_override",
      "confidence": 0.98,
      "humanReviewed": true,
      "audio": {
        "breakdown": { "url": "https://cdn.example.com/p/adventure-breakdown.mp3" },
        "fullWord": { "url": "https://cdn.example.com/p/adventure-full.mp3" }
      },
      "updatedAt": "2026-04-22T00:00:00.000Z"
    }
  }
}
```

Pros:
- lazy load
- easier payload control
- easier manifest versioning

Cons:
- extra request unless prefetched

#### Option C — Hybrid recommended

- Book payload includes `pronunciationManifestUrl` or `hasPronunciations`
- Client fetches manifest lazily or during reader preload

Recommended first implementation.

### 3.7 Proposed editorial APIs

#### Get manifest/editor data

```http
GET /api/editor/books/:bookId/pronunciations
```

Returns:
- manifest entries
- generation status
- review status
- coverage stats

#### Regenerate vocabulary entries

```http
POST /api/editor/books/:bookId/pronunciations/generate
```

Body:

```json
{
  "scope": "missing_only",
  "pageIds": ["page_1", "page_2"]
}
```

#### Upsert pronunciation override

```http
PUT /api/editor/books/:bookId/pronunciations/:normalizedWord
```

Body:

```json
{
  "displayWord": "Aeloria",
  "phoneticDisplay": "ay-LOR-ee-uh",
  "ipa": null,
  "syllables": ["ay", "lor", "i", "uh"],
  "breakdownSegments": ["ay", "lor", "ee", "uh"],
  "humanReviewed": true,
  "audioOverrideUrl": "https://cdn.example.com/uploads/aeloria.mp3"
}
```

#### Publish validation

```http
GET /api/editor/books/:bookId/pronunciations/validation
```

Returns:
- missing entries
- duplicate conflicts
- low-confidence entries
- orphaned entries
- coverage summary

### 3.8 Client lookup algorithm

Common web/mobile algorithm:

1. extract visible token text
2. normalize token using shared normalization rules
3. lookup `manifest.entries[normalizedWord]`
4. if entry exists:
   - prefer `audio.breakdown` for breakdown mode
   - else compose from `audio.segments` if available
   - else use `audio.fullWord`
5. if no entry/audio:
   - fall back to existing whole-word playback path

### 3.9 Versioning and compatibility

- Add `version` field to manifest
- Clients must tolerate:
  - no manifest
  - missing entry
  - entry without audio
  - audio without IPA/phonetic display
- Old books remain valid with no pronunciation manifest

### 3.10 Caching proposal

Web:
- preload manifest at reader open or first interaction
- cache manifest per book
- cache audio by URL through browser/CDN strategy

Mobile:
- prefetch manifest during book load
- cache frequently used pronunciation clips locally
- preserve offline-safe fallback behavior when clips unavailable

### 3.11 Security and integrity notes

- editor APIs require authenticated edit access
- uploaded overrides must validate content type and size
- generated asset URLs should be signed or stored in approved bucket/CDN path
- manifest generation should sanitize token input and avoid unsafe file naming

### 3.12 Open questions

- Should pronunciation manifest be book-level only, or support global vocabulary reuse across books?
- Should breakdown audio be precomposed clip, segment list, or both?
- Should `phoneticDisplay` be strict educational notation, simplified learner notation, or configurable per audience?
- Should practice mode use different playback defaults than standard reading mode?
- Should analytics track per-word struggle/repeat behavior for editorial improvement?

---

## Recommended first build slice

Smallest high-value slice:

1. Add book-level pronunciation manifest contract.
2. Build generation job for top vocabulary words in selected books.
3. Add editor override UI for missing or incorrect words.
4. Wire long-press on mobile and equivalent secondary gesture on web to pronunciation breakdown playback.
5. Keep tap whole-word behavior unchanged initially.
6. Add fallback to current whole-word path when manifest/audio missing.

This gives low-risk launch path, strong editor control, and shared web/mobile contract.

# Web Reader Pronunciation Functional Requirements

Status: Draft  
Date: 2026-04-22  
Owner: Frontend / Product requirements handoff  
Source inputs: `specs/word-pronunciation-cross-platform-spec.md`, current web reader implementation, mobile compatibility brief

## 1. Purpose

This document defines the phase-1 **web-specific** functional requirements for word pronunciation support in the Storia reader.

It translates the cross-platform product direction into web reader requirements that are:
- implementation-ready
- product-level rather than code-level
- testable by QA
- explicit about keyboard, accessibility, loading, playback coordination, and fallback behavior

## 2. Current-state constraints informing this spec

These constraints come from the existing web reader and must be addressed by any implementation:

1. Web currently supports **click / Enter / Space** for whole-word playback, but not long-press breakdown playback.
2. Interactive overlay words are currently rendered inside an **`aria-hidden="true"`** container, so the present implementation is not an acceptable accessibility baseline for the new feature.
3. Web pronunciation playback currently runs through a standalone hook and does **not** coordinate with narration pause/resume state.
4. Web reader data currently exposes page-level `wordPronunciations` maps, not the proposed shared manifest contract.
5. Mobile compatibility requires web to preserve the product model of:
   - quick help path
   - breakdown help path
   - predictable narration coexistence
   - safe fallback when pronunciation data is missing

## 3. Phase-1 experience summary

### 3.1 Reader-facing behavior

In standard reading mode on web:
- **Tap/click** plays the existing quick whole-word pronunciation.
- **Long-press** plays sounded-out pronunciation when supported.
- If sounded-out pronunciation is unavailable, long-press falls back to whole-word playback.
- A **keyboard-accessible alternate action** must exist for sounded-out pronunciation so long-press is not the only path.

### 3.2 Playback policy

If narration is currently playing:
- pause narration
- play pronunciation help
- resume narration only if narration had been playing before the interaction and the user did not manually override that state

## 4. Functional requirements

## WR-1. Word interaction model

1. In standard web reading mode, primary word activation must trigger **whole-word playback**.
2. A pointer long-press gesture must trigger **breakdown playback**.
3. Long-press recognition must use a single product-defined threshold, initially **~450ms**, and apply consistently across supported browsers and input types that expose pointer events.
4. Once a long-press has been recognized, the reader must suppress the normal click/tap action for that same gesture so users do not hear both playback modes.
5. If the pronunciation feature is disabled by rollout controls, all word interactions must continue to behave as they do today.
6. If a reading mode or experiment enables “pronunciation on tap,” the primary activation action must switch from whole-word playback to breakdown playback without requiring different content data.

## WR-2. Keyboard and accessibility alternatives

1. Every interactive word must be reachable through keyboard navigation or an equivalent accessible interaction surface.
2. Primary keyboard activation (`Enter` and `Space`) must trigger the same action as primary pointer activation for the current mode.
3. The reader must provide a **secondary keyboard-accessible action** for breakdown playback.
4. The breakdown action must be exposed with an accessible name equivalent to **“Sound out word”** or **“Hear word breakdown.”**
5. Screen-reader users must not lose access to word interaction because of pronunciation support.
6. Word interactivity must not depend on content being inside an `aria-hidden` subtree.
7. Any visible pronunciation state indicator must have a non-color cue so it remains perceivable for low-vision users and users with color-vision deficiency.
8. If long-press is unavailable on a device, blocked by browser behavior, or difficult for assistive technology users, the alternate action must still provide complete feature access.

## WR-3. Word resolution and lookup

1. On each pronunciation interaction, the reader must resolve the visible token the user acted on and normalize it using the shared pronunciation lookup rules.
2. Web normalization behavior must match the shared cross-platform contract for lowercase conversion, punctuation trimming, apostrophes, hyphens, and Unicode normalization.
3. If a token cannot be normalized into a valid lookup key, the interaction must safely fall back to whole-word playback.
4. The reader must support partial pronunciation coverage: unsupported words must remain interactive and usable.
5. The same visible token must resolve to the same lookup key regardless of whether the interaction originated from pointer, keyboard, or alternate-access UI.

## WR-4. Loading and caching behavior

1. The reader must know whether pronunciation data exists for a book through the published reader contract, such as `hasPronunciations`, `pronunciationManifestUrl`, or an equivalent field.
2. If pronunciation data exists, the manifest may preload on reader open and must be fetched no later than the first breakdown attempt.
3. Manifest data must be cached per book for the active reader session so repeated interactions do not repeatedly refetch the same manifest.
4. Audio assets referenced by pronunciation data must benefit from normal browser caching and stable asset URLs.
5. If the current page or next likely page has pronunciation assets for already-visible words, the implementation may warm the cache, but preloading must not block initial reading UI.
6. Slow manifest or audio loading must not freeze page interaction; reading, page navigation, and standard audio controls must remain usable.
7. The UI must surface a transient loading state only when needed and must clear it deterministically on success, cancellation, or failure.
8. Phase-1 web requirements must explicitly support all three manifest states:
   - **manifest present:** use manifest-backed lookup and playback/fallback rules
   - **manifest missing/absent by contract:** skip manifest loading and keep existing whole-word behavior available
   - **manifest fetch failure:** fail gracefully at request time, keep the reader interactive, and fall back to existing whole-word playback

## WR-5. Playback state transitions

1. When breakdown playback is requested while narration is playing, narration must pause before pronunciation playback starts.
2. When breakdown playback is requested while narration is paused, narration must remain paused.
3. The default breakdown sequence must be:
   - breakdown clip if available
   - optional short pause
   - full-word clip if available
4. If no breakdown clip exists but a full-word clip exists, the reader must play the full-word clip.
5. If no usable pronunciation audio is available, the reader must fall back to the existing whole-word path.
6. After pronunciation playback ends, narration must auto-resume **only** if narration was actively playing immediately before the interaction began.
7. If the user manually changes narration state during or immediately after pronunciation playback, the user’s latest intent must win over automatic resume logic.
8. The reader must use one deterministic concurrency policy for repeated pronunciation requests: cancel-and-replace, ignore-new, or queue-one. Phase 1 should use **cancel-and-replace** unless product explicitly approves another policy.
9. Rapid repeated interactions must not leave narration, pronunciation playback, or page UI in a stuck or contradictory state.
10. Pronunciation playback must not corrupt active page state, word highlighting, or page navigation.

## WR-6. UI feedback and reader state visibility

1. The reader must provide perceivable feedback when pronunciation help starts.
2. That feedback may reuse an existing active-word or tapped-word treatment, but the reader must avoid showing contradictory simultaneous states for the same word.
3. If a pronunciation request is loading, the user must receive lightweight feedback that the interaction was recognized.
4. If playback begins, the UI must reflect the active pronunciation state for the currently playing word.
5. If playback is cancelled, interrupted, or replaced, any transient indicator must clear promptly.
6. Pronunciation support must not degrade current narration highlighting behavior.
7. The feature must behave responsively at mobile-width web layouts, tablet layouts, and desktop layouts without relying on hover-only controls.

## WR-7. Settings, flags, and mode handling

1. Web pronunciation support must be controlled by a feature flag so the team can disable rollout without removing existing word playback.
2. The reader must support a mode or setting that changes primary activation from whole-word playback to breakdown playback.
3. Practice-oriented reading modes must be able to opt into pronunciation-on-tap independently of standard reading mode.
4. Changing this setting must affect future interactions immediately and must not require a page reload.
5. If the setting is unavailable for a reader, the UI must not expose a broken or inactive control.

## WR-8. Error handling and fallback behavior

1. Missing pronunciation manifests must never break the page.
2. Manifest load failures must fall back to whole-word playback when the user requests pronunciation help.
3. Missing pronunciation entries for individual words must fall back to whole-word playback without surfacing a blocking error.
4. Missing or unplayable audio assets must fail gracefully and leave the reader interactive.
5. If a pronunciation request fails after narration was paused, the reader must still resolve to a valid end state:
   - resume narration if it should resume, or
   - remain paused if that matches the pre-interaction or latest user state.
6. Error handling must not strand the reader in a loading state.
7. Error handling must not disable subsequent pronunciation attempts for other words unless the reader has entered a clearly communicated unrecoverable state.
8. Fallback behavior must be silent or low-friction for the child reader; product/engineering diagnostics belong in analytics and logs rather than intrusive reader messaging.
9. QA sign-off must separately verify these reader outcomes:
   - **manifest present + supported word:** breakdown playback uses manifest-backed behavior
   - **manifest present + entry missing:** breakdown request falls back cleanly to whole-word playback
   - **manifest fetch failure:** breakdown request fails gracefully, keeps reading usable, and preserves a fallback path

## WR-9. Observability requirements

1. The web reader must emit an event for each pronunciation interaction attempt.
2. Analytics must distinguish:
   - successful manifest-backed breakdown playback
   - manifest-backed full-word fallback
   - existing whole-word fallback due to missing data
   - manifest load failure
   - cancelled or replaced playback
3. The event payload should include, where available:
   - `bookId`
   - `pageId`
   - normalized word key
   - trigger source
   - active mode / flag state
   - playback path taken
4. The implementation should capture latency from interaction to audible playback start.

## WR-10. Acceptance-level reader outcomes

A web implementation satisfies phase-1 requirements only if all of the following are true:

1. Primary activation still plays a usable word-audio path when the feature is off.
2. Breakdown playback is reachable by pointer and by a non-pointer alternative.
3. Unsupported words still provide a usable pronunciation path through fallback behavior.
4. Narration pause/play/resume behavior is predictable and does not lose the user’s place.
5. Repeated rapid interactions do not break reader interactivity.
6. Accessibility for interactive words is not worse than the pre-feature baseline and must improve where the current implementation is inaccessible.
7. Failures in manifest loading or audio playback do not block reading completion.

## 5. Open web-specific gaps to resolve before implementation

## WG-1. Accessible alternate action design

The product spec requires a keyboard-accessible alternative to long-press, but the exact UI is still open.

Decision needed:
- whether breakdown is exposed through a focused-word secondary shortcut, inline action, context menu, or reader toolbar action

Why it matters:
- this is the highest-risk accessibility blocker because long-press alone is insufficient on web

## WG-2. Trigger behavior across pointer types

Decision needed:
- whether long-press applies uniformly to mouse, touch, stylus, and trackpad-emulated events, or whether some pointer types use a different secondary gesture

Why it matters:
- browser/platform differences can create accidental clicks, text selection conflicts, or context-menu interference

## WG-3. Accessibility remediation for overlay words

The current overlay-word implementation places interactive words inside an `aria-hidden` subtree.

Decision needed:
- how the reader will expose the word interaction surface accessibly without duplicating, mis-ordering, or hiding meaningful content from assistive technology

Why it matters:
- this is a release blocker for any claim of keyboard/screen-reader support

## WG-4. Playback arbitration with narration

Decision needed:
- the exact reader state machine for narration pause, pronunciation start, cancellation, replacement, and resume intent

Why it matters:
- the current web pronunciation path is not coordinated with narration and can otherwise create race conditions or incorrect resume behavior

## WG-5. Pronunciation contract migration path

Decision needed:
- how web moves from the current page-level `wordPronunciations` map to the shared published manifest contract without breaking older books

Why it matters:
- phase-1 needs backward-compatible rollout and partial-content support

## WG-6. Loading strategy and cache policy

Decision needed:
- whether manifests preload on reader open, on first interaction, or using a hybrid strategy, and how aggressive audio prefetching should be

Why it matters:
- this affects first-use latency, data usage, and low-bandwidth reader behavior

## WG-7. Visual feedback model

Decision needed:
- whether pronunciation uses the current tapped-word visual state, a distinct “sounding out” state, or a combined state model

Why it matters:
- the UI must avoid conflicting highlight semantics while keeping the child reader oriented

## WG-8. Settings discoverability

Decision needed:
- where pronunciation-on-tap or practice-mode pronunciation settings appear in the web reader and how they are explained to caregivers without confusing child readers

Why it matters:
- mode switching changes a core interaction model and must remain predictable

## 6. Source references checked

- `specs/word-pronunciation-cross-platform-spec.md`
- `src/app/books/[id]/reader/page.tsx`
- `src/components/IntegratedIllustration.tsx`
- `src/hooks/useWordPronunciation.ts`

## 7. Recommended handoff use

This artifact is intended to be the direct input for:
- docs consolidation into the cross-platform spec
- QA acceptance criteria and browser/device matrix drafting
- implementation planning for the web reader state machine and accessible interaction model

# Plan: Tap-to-Pronounce Word Feature

## Task Description
Implement a feature in the book reader where kids can tap or click any word on a page to hear that word pronounced aloud. This leverages our existing word-level timestamp infrastructure and ElevenLabs v3 TTS to help children learn the pronunciation of individual words in our stories.

## Objective
When a child taps any word in the reader text, they hear that word pronounced clearly. The interaction should feel instant, provide clear visual feedback, and work seamlessly alongside existing narration playback.

## Problem Statement
Children reading stories on Storia encounter unfamiliar words but have no way to hear individual word pronunciations. The full-page narration reads the entire text, but kids need the ability to isolate and repeat individual words to build vocabulary and phonemic awareness.

## Solution Approach
Two-tier approach for pronunciation playback:

1. **Primary (instant, free):** When narration audio + word timestamps exist, use the Web Audio API to clip and play the exact segment of the narration audio corresponding to the tapped word. This is instant because the audio is already loaded.

2. **Fallback (API, ~1.5s latency):** When no narration exists for the page, call a lightweight API endpoint that generates single-word audio via ElevenLabs v3 on Replicate. Cache results in-memory to avoid repeat API calls.

Both paths include a satisfying tap animation (pulse + highlight) so kids get immediate visual feedback even if audio takes a moment.

## Relevant Files
Use these files to complete the task:

- `src/app/books/[id]/reader/page.tsx` — Reader UI. Word `<span>` elements already render at lines 751-768 when timestamps are loaded. Must add `onClick` handlers and tap feedback styles.
- `src/hooks/useBookData.ts` — Contains `WordTimestamp` type and `useReaderData` hook. Will need a new `usePronounceWord` mutation hook for the API fallback.
- `src/hooks/useAudioCrossFade.ts` — Web Audio API utilities (AudioContext init, gain control). Reference for AudioContext patterns.
- `src/app/globals.css` — Global styles. Add tap-pulse keyframe animation and `.word-tappable` styles.
- `src/app/api/admin/generate-narration/route.ts` — Current ElevenLabs v3 integration. Reference for Replicate API pattern.

### New Files
- `src/hooks/useWordPronunciation.ts` — New hook encapsulating both the "clip from narration" and "API fallback" paths. Manages AudioContext, playback state, and in-memory cache.
- `src/app/api/pronounce-word/route.ts` — Lightweight API endpoint that generates a single-word pronunciation via ElevenLabs v3. Returns audio URL directly (no Supabase storage needed for ephemeral single-word clips).

## Implementation Phases

### Phase 1: Foundation
- Create the `useWordPronunciation` hook with the narration-clip path (Web Audio API `audioBuffer.start(0, startTime, duration)`)
- Add tap animation CSS to `globals.css`

### Phase 2: Core Implementation
- Create the `/api/pronounce-word` API route for the fallback path
- Wire up click handlers on word `<span>` elements in the reader
- Add visual feedback (pulse animation + highlight color change)
- Implement in-memory cache for API-generated word audio

### Phase 3: Integration & Polish
- Handle edge cases: rapid tapping, tapping during narration playback, words with punctuation
- Ensure iOS AudioContext compatibility (user gesture requirement)
- Validate the feature works in both light and dark mode
- Type-check and build

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to do the building, validating, testing, deploying, and other tasks.

### Team Members

- Builder
  - Name: builder-word-pronunciation-hook
  - Role: Create the `useWordPronunciation` hook and the `/api/pronounce-word` API route
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-reader-ui
  - Role: Wire up click handlers, tap animation CSS, and visual feedback in the reader page
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: validator
  - Role: Run type-check, build, and verify acceptance criteria
  - Agent Type: general-purpose
  - Resume: false

## Step by Step Tasks

### 1. Create useWordPronunciation Hook
- **Task ID**: create-pronunciation-hook
- **Depends On**: none
- **Assigned To**: builder-word-pronunciation-hook
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/hooks/useWordPronunciation.ts` with the following API:
  ```ts
  interface UseWordPronunciationReturn {
    pronounceWord: (word: string, index: number) => void;
    activeWordIndex: number | null; // which word is currently being pronounced
    isLoading: boolean; // true when waiting for API fallback
  }
  function useWordPronunciation(options: {
    narrationAudioRef: RefObject<HTMLAudioElement | null>;
    wordTimestamps: WordTimestamp[];
    timestampsLoaded: boolean;
  }): UseWordPronunciationReturn
  ```
- **Primary path (narration clip):** When `timestampsLoaded && wordTimestamps.length > 0`:
  - Get the `start` and `end` times from `wordTimestamps[index]`
  - Use a **separate** `HTMLAudioElement` (not the narration ref) to avoid interrupting full narration playback
  - Set `audio.currentTime = start`, play, then pause at `end` using a `timeupdate` listener
  - This avoids needing to decode the full audio buffer — simpler and works with streaming audio
- **Fallback path (API call):** When timestamps are not available:
  - Call `POST /api/pronounce-word` with `{ word }`
  - Play the returned audio URL via a temporary Audio element
  - Cache the URL in a `Map<string, string>` ref so repeated taps on the same word don't re-call the API
- Set `activeWordIndex` during playback for visual feedback, clear it when playback ends
- Strip punctuation from words before sending to API (e.g., "cliff." → "cliff")

### 2. Create /api/pronounce-word API Route
- **Task ID**: create-pronounce-api
- **Depends On**: none
- **Assigned To**: builder-word-pronunciation-hook
- **Agent Type**: general-purpose
- **Parallel**: true (same builder, sequential with task 1)
- Create `src/app/api/pronounce-word/route.ts`:
  - Accept POST with `{ word: string }`
  - Validate: word must be 1-50 chars, non-empty
  - Call ElevenLabs v3 on Replicate with same voice settings as narration:
    ```ts
    replicate.run("elevenlabs/v3", {
      input: {
        text: word,
        prompt: word,
        voice: "Reginald",
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.76,
        speed: 0.90,
      },
    })
    ```
  - Return `{ url: audioUrl }` — no Supabase upload needed (ephemeral)
  - Keep it lightweight — no Whisper, no timestamps, no database writes

### 3. Add Tap Animation CSS
- **Task ID**: add-tap-css
- **Depends On**: none
- **Assigned To**: builder-reader-ui
- **Agent Type**: general-purpose
- **Parallel**: true
- Add to `src/app/globals.css`:
  - `@keyframes word-tap-pulse` — a quick scale-up + color flash animation (200ms)
  - `.word-tappable` — base styles for tappable words: `cursor: pointer`, subtle underline-on-hover, `user-select: none` on mobile
  - `.word-tappable:active` — immediate press feedback (slight scale down)
  - `.word-pronouncing` — applied while the word is being spoken: highlight bg + subtle pulse
  - Use `var(--reader-highlight-bg)` for pronunciation highlight color for theme consistency
  - Add a new CSS variable `--reader-tap-highlight: #bef264` (light) / `rgba(190, 242, 100, 0.35)` (dark) to differentiate tap highlights from narration word tracking

### 4. Wire Up Reader UI Word Tap Handlers
- **Task ID**: wire-reader-ui
- **Depends On**: create-pronunciation-hook, add-tap-css
- **Assigned To**: builder-reader-ui
- **Agent Type**: general-purpose
- **Parallel**: false
- In `src/app/books/[id]/reader/page.tsx`:
  - Import and use `useWordPronunciation` hook, passing `narrationRef`, `wordTimestamps`, `timestampsLoaded`
  - Update the word `<span>` elements (lines 752-768) to:
    - Add `onClick={() => pronounceWord(wordData.word, index)}`
    - Add `className` including `word-tappable` always, and `word-pronouncing` when `pronouncingIndex === index`
    - Apply `--reader-tap-highlight` bg when the word is being pronounced (distinct from narration tracking highlight)
  - Handle conflict: if narration is playing and user taps a word, the tap should still work (uses separate audio element)
  - For the non-timestamp text fallback (line 770: `<span>{pageData.textContent}</span>`), split text into word spans so tapping works even without timestamps:
    ```tsx
    pageData.textContent.split(/(\s+)/).map((segment, i) =>
      segment.trim() ? <span key={i} className="word-tappable" onClick={...}>{segment}</span> : segment
    )
    ```
  - Show a subtle loading indicator on the word when `isLoading` is true (e.g., a tiny spinner or opacity pulse)

### 5. Validate Implementation
- **Task ID**: validate-all
- **Depends On**: create-pronunciation-hook, create-pronounce-api, add-tap-css, wire-reader-ui
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- Run `npx tsc --noEmit` — ensure no type errors
- Run `npm run build` — ensure production build succeeds
- Verify acceptance criteria met:
  - Words in reader are visually tappable (cursor change, hover style)
  - Tapping a word triggers pronunciation audio
  - Visual feedback appears during pronunciation
  - Feature works with and without narration timestamps
  - No interference with existing narration playback
  - Works in both light and dark mode

## Acceptance Criteria
- [ ] Each word in the reader text is individually tappable (click/touch)
- [ ] Tapping a word plays that word's pronunciation audio
- [ ] When narration + timestamps exist: audio clips from existing narration (instant, no API call)
- [ ] When no narration exists: falls back to ElevenLabs v3 API, with loading state
- [ ] Clear visual feedback on tap (highlight + pulse animation)
- [ ] Repeated taps on the same word re-play without additional API calls (cached)
- [ ] Tapping a word during full narration playback does not interrupt narration
- [ ] Works in both light mode and dark mode
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Production build succeeds (`npm run build`)

## Validation Commands
Execute these commands to validate the task is complete:

- `npx tsc --noEmit` — Ensure no TypeScript compilation errors
- `npm run build` — Ensure production build succeeds
- Verify file exists: `src/hooks/useWordPronunciation.ts`
- Verify file exists: `src/app/api/pronounce-word/route.ts`
- Verify CSS contains `word-tappable` class: check `src/app/globals.css`
- Verify reader page imports `useWordPronunciation`: check `src/app/books/[id]/reader/page.tsx`

## Notes
- No new dependencies needed — uses existing Replicate SDK, Web Audio API, and React hooks
- The ephemeral `/api/pronounce-word` endpoint does NOT store audio in Supabase — word pronunciations are short-lived and cached client-side
- ElevenLabs v3 voice is set to "Reginald" with speed 0.90 to match the current narration settings
- Punctuation should be stripped before sending words to the API (e.g., "meow!" → "meow")
- The narration-clip approach uses a separate Audio element to avoid interrupting ongoing narration playback
- iOS requires a user gesture to start AudioContext — tapping a word IS a user gesture, so this works naturally

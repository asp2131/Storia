# Plan: Duolingo-Style Reader UI Redesign

## Task Description
Redesign the book reader UI (`/books/[id]/reader/page.tsx`) to match the Duolingo reading experience layout. The current reader uses a dark full-screen cinematic style with a bottom sheet for text on mobile. The new design will feature a clean, minimal layout with:
- Top progress bar (green fill + X close button)
- White/light background with auto light/dark mode support
- Centered illustration (large, rounded corners, ~40-50% of viewport)
- Inline centered text below the image (no bottom sheet)
- Word highlighting with light green/yellow background on active words
- Bottom navigation buttons (next/prev) instead of swipe
- Current audio controls preserved
- Minimal chrome, clean and focused

## Objective
Replace the current dark cinematic reader layout with a clean Duolingo-style card-based reading experience that supports auto light/dark mode, uses bottom nav buttons instead of swipe, removes the bottom sheet in favor of inline text, and maintains all existing audio/progress/feedback functionality.

## Problem Statement
The current reader UI uses a full-screen dark cinematic layout with:
- Dark slate-900 background everywhere
- Full-bleed image taking 65-80% of viewport height
- Text in a draggable bottom sheet (react-modal-sheet) on mobile
- Swipe/tap zone navigation
- Hidden UI chrome that appears on tap
- Dense audio controls in the sheet header

This is hard to read for children's book content and doesn't match the clean, focused, card-based design pattern used by Duolingo that the product requires.

## Solution Approach
1. **Remove bottom sheet**: Replace `react-modal-sheet` with inline text content below the image
2. **New layout structure**: Vertical stack — progress bar → image card → text → bottom nav
3. **Auto light/dark**: Add CSS custom properties for both themes, respect `prefers-color-scheme`
4. **Progress bar redesign**: Top-fixed green progress bar with X close button (Duolingo style)
5. **Image as card**: Centered with rounded corners, not full-bleed
6. **Text inline**: Large centered text below image, with word highlighting using light green/yellow
7. **Bottom nav buttons**: Full-width teal next button with arrow, prev button when applicable
8. **Audio controls**: Compact floating controls, repositioned to not conflict with new layout
9. **Preserve all hooks/logic**: All business logic (audio, progress, feedback, login prompt) stays intact

## Relevant Files
Use these files to complete the task:

- `src/app/books/[id]/reader/page.tsx` — **Main file to redesign**. The 1389-line reader component with all UI, state management, audio controls, navigation, word highlighting, and sheet rendering. This will be heavily modified.
- `src/app/globals.css` — Global CSS with Tailwind v4 `@theme` block and custom animations. Needs new CSS variables for light/dark theme and updated animations.
- `src/app/layout.tsx` — Root layout with font loading (Inter, Lora, Playfair). No changes needed but reference for available fonts.
- `src/hooks/useBookData.ts` — Data types (`PageData`, `BookData`, `WordTimestamp`) and `useReaderData` hook. No changes needed, reference only.
- `src/hooks/useAudioCrossFade.ts` — Web Audio API cross-fade hook. No changes needed, stays as-is.
- `src/hooks/useReadingProgress.ts` — Reading progress save/load hooks. No changes needed.
- `src/hooks/useLocalPreferences.ts` — Soundscape mode preferences. No changes needed.
- `src/components/FeedbackModal.tsx` — Feedback modal overlay. May need minor color updates for light mode.
- `src/components/LoginPrompt.tsx` — Login prompt toast. May need minor color updates for light mode.

### New Files
- None. All changes are modifications to existing files.

## Implementation Phases

### Phase 1: Foundation — Theme System & CSS
Set up the auto light/dark theme infrastructure in `globals.css`:
- Add CSS custom properties for light and dark color tokens
- Add `@media (prefers-color-scheme: dark)` overrides
- Add new utility classes or Tailwind theme tokens for reader-specific colors
- Add new keyframes for the progress bar animation
- Update body defaults to support both themes

**CSS Variables to add:**
```css
:root {
  /* Reader theme - light mode */
  --reader-bg: #ffffff;
  --reader-text: #1a1a2e;
  --reader-text-secondary: #6b7280;
  --reader-card-bg: #f3f4f6;
  --reader-progress-bar-bg: #e5e7eb;
  --reader-progress-bar-fill: #58cc02; /* Duolingo green */
  --reader-highlight-bg: #d4edbc; /* Light green highlight */
  --reader-nav-btn-bg: #1cb0f6; /* Duolingo blue */
  --reader-nav-btn-text: #ffffff;
  --reader-close-color: #afafaf;
}

@media (prefers-color-scheme: dark) {
  :root {
    --reader-bg: #131f24;
    --reader-text: #e2e8f0;
    --reader-text-secondary: #94a3b8;
    --reader-card-bg: #1e293b;
    --reader-progress-bar-bg: #334155;
    --reader-progress-bar-fill: #58cc02;
    --reader-highlight-bg: rgba(88, 204, 2, 0.25);
    --reader-nav-btn-bg: #1cb0f6;
    --reader-nav-btn-text: #ffffff;
    --reader-close-color: #64748b;
  }
}
```

### Phase 2: Core Implementation — Reader Layout Rewrite
Rewrite the reader's JSX layout in `page.tsx`:

**Remove:**
- `react-modal-sheet` import and all Sheet components
- `sheetRef`, `textSheetOpen` state
- Tap zone overlays for swipe navigation
- Full-bleed image with gradient overlays
- Hidden UI chrome layer (the auto-hide top/bottom bars)
- `uiVisible` toggle mechanism
- Navigation hint overlay for swipe
- Desktop navigation arrows (will be replaced by bottom buttons)
- Mini page counter (progress bar replaces it)

**Add:**
- Fixed top bar with X close button + green progress bar
- Scrollable content area: centered image card + inline text
- Fixed bottom bar with full-width next/prev navigation buttons
- Audio controls in a compact floating position (top-right or below progress bar)

**New Layout Structure (mobile & desktop):**
```
┌──────────────────────────────┐
│ [X]  ████████░░░░░░░░░░░░░  │  ← Fixed top: close + progress
├──────────────────────────────┤
│                              │
│      ┌──────────────────┐    │
│      │                  │    │
│      │   Illustration   │    │  ← Centered image, rounded, ~40-50% vh
│      │                  │    │
│      └──────────────────┘    │
│                              │
│     "I see five fish."       │  ← Centered text, large, bold
│                              │
│    [🔊 BGM] [🎤 Narrate]    │  ← Audio controls (compact pills)
│                              │
├──────────────────────────────┤
│    [    ←    ] [    →    ]   │  ← Fixed bottom: prev/next buttons
└──────────────────────────────┘
```

**Word highlighting update:** Change from amber glow style to light green background (matching Duolingo's word highlight visible in "skinny" screenshot):
```tsx
// OLD
"text-amber-300 bg-amber-500/30 rounded px-1 -mx-0.5 shadow-[0_0_20px_rgba(245,158,11,0.3)]"

// NEW
"rounded px-1 -mx-0.5"
style={{ backgroundColor: 'var(--reader-highlight-bg)' }}
```

### Phase 3: Integration & Polish
- Update `FeedbackModal.tsx` and `LoginPrompt.tsx` to use CSS variables instead of hardcoded slate colors (optional, modal overlays can stay dark)
- Ensure keyboard navigation still works (arrow keys map to bottom buttons)
- Remove swipe touch handlers (replaced by buttons)
- Keep all business logic: audio, progress tracking, feedback modal, login prompt
- Test that word highlighting works with new light green style
- Ensure images with no illustration show a nice placeholder on light bg
- Mobile: buttons should respect safe-area-inset-bottom
- Add smooth page transitions (optional fade/slide on page change)

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to to the building, validating, testing, deploying, and other tasks.
  - This is critical. You're job is to act as a high level director of the team, not a builder.
  - You're role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: builder-theme
  - Role: CSS theme system — add light/dark CSS variables and new animations to globals.css
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-reader
  - Role: Reader page layout rewrite — restructure JSX, remove sheet, add progress bar, inline text, bottom nav buttons
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-polish
  - Role: Polish pass — update FeedbackModal/LoginPrompt for light mode compat, cleanup unused imports/state, safe-area support
  - Agent Type: general-purpose
  - Resume: true

- Validator
  - Name: validator
  - Role: Validate all changes compile, render correctly, and preserve existing functionality
  - Agent Type: validator
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Add Light/Dark Theme CSS Variables
- **Task ID**: add-theme-css
- **Depends On**: none
- **Assigned To**: builder-theme
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 2 planning)
- Add CSS custom properties to `src/app/globals.css` under `:root` for light mode reader colors
- Add `@media (prefers-color-scheme: dark)` block with dark mode overrides
- Include variables: `--reader-bg`, `--reader-text`, `--reader-text-secondary`, `--reader-card-bg`, `--reader-progress-bar-bg`, `--reader-progress-bar-fill` (#58cc02 Duolingo green), `--reader-highlight-bg` (#d4edbc light green), `--reader-nav-btn-bg` (#1cb0f6 Duolingo blue), `--reader-nav-btn-text`, `--reader-close-color`
- Add progress bar fill animation keyframe: `@keyframes progress-fill { from { width: 0% } to { width: var(--progress-width) } }`
- Keep all existing CSS animations and classes intact
- Do NOT modify any existing CSS, only ADD new rules

### 2. Rewrite Reader Layout — Remove Sheet & Old Chrome
- **Task ID**: rewrite-reader-layout
- **Depends On**: add-theme-css
- **Assigned To**: builder-reader
- **Agent Type**: general-purpose
- **Parallel**: false
- Read the full current `src/app/books/[id]/reader/page.tsx` (1389 lines)
- Remove these imports: `Sheet, SheetRef` from `react-modal-sheet`; `ArrowLeft, Settings, Bookmark, Info` from lucide (keep the rest)
- Remove these state variables: `uiVisible`, `textSheetOpen`, `showSettingsPanel`, `showNavigationHint`, `hintDismissing`, `showSoundscapeMenu`
- Remove `sheetRef`, `uiTimeoutRef` refs
- Remove these functions: `toggleUI`, `resetAutoHide`, touch/swipe handlers (`handleTouchStart`, `handleTouchEnd`, `touchStartX` ref)
- Remove the auto-hide useEffect for `uiVisible`
- Remove the navigation hint useEffect and its localStorage check
- Keep ALL of these: audio state/refs/effects, word highlighting state/effects, reading progress state/effects, feedback state/effects, login prompt state/effects, keyboard navigation, `goToPage`/`nextPage`/`prevPage`, all audio toggle functions, soundscape mode handlers, volume effects
- Restructure the JSX return to the new layout:
  - **Outer wrapper**: `min-h-screen` with `background-color: var(--reader-bg)` and `color: var(--reader-text)`
  - **Hidden audio elements**: Keep as-is at top
  - **Fixed top bar** (z-40, sticky top-0):
    - Left: X button (`onClick={() => handleExitAttempt(() => router.back())`) with `color: var(--reader-close-color)`
    - Center/Right: Progress bar — `h-3 rounded-full` with `bg: var(--reader-progress-bar-bg)`, fill div with `bg: var(--reader-progress-bar-fill)`, width = `(currentPage / totalPages) * 100%`
  - **Scrollable content area** (flex-1, overflow-y-auto, flex flex-col items-center, pt-8 px-6):
    - **Image card**: `max-w-md w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg` containing the Next.js Image component with `object-cover`. If no image, show colored placeholder
    - **Text content**: `mt-8 mb-6 text-center max-w-lg px-4` with `text-2xl md:text-3xl font-bold font-sans leading-relaxed` using `color: var(--reader-text)`. Render word timestamps with green highlight for active word. No first-letter drop cap styling.
    - **Audio controls island**: Compact row of pills below text, same style as current mobile sheet header controls
  - **Fixed bottom bar** (z-40, sticky bottom-0, p-4, safe-area-bottom):
    - Full-width teal next button: `w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center` with `bg: var(--reader-nav-btn-bg)`, white ChevronRight icon. `onClick={nextPage}`, disabled on last page
    - When `currentPage > 1`: Show a row with prev button (left half) and next button (right half), or a left arrow above the main next button
    - On page 1 (cover page pattern from Duolingo): Show only the forward arrow button
- Update the loading state to use `var(--reader-bg)` instead of `bg-slate-900`
- Update the error state similarly
- Keep FeedbackModal and LoginPrompt renders at the bottom of JSX
- Keep the Settings panel code but simplify — it can be triggered from a small gear icon in the top bar next to X

### 3. Update Word Highlighting Style
- **Task ID**: update-word-highlighting
- **Depends On**: rewrite-reader-layout
- **Assigned To**: builder-reader
- **Agent Type**: general-purpose
- **Parallel**: false
- In the text rendering section (both the inline text area — no more separate desktop/mobile):
  - Remove the old amber glow highlighting classes
  - For active word during narration: apply `backgroundColor: 'var(--reader-highlight-bg)'` with `rounded px-1 -mx-0.5` classes, and bold the active word
  - Remove the first-letter drop cap styling (`.text-5xl .font-bold .text-amber-500 .float-left` for index 0)
  - All words should be same size, with only the active word getting the green highlight background
  - Ensure the text is centered and reads naturally

### 4. Polish — Update Overlays for Theme Compatibility
- **Task ID**: polish-overlays
- **Depends On**: rewrite-reader-layout
- **Assigned To**: builder-polish
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 3)
- Update `FeedbackModal.tsx`: The modal uses its own dark backdrop so it should work fine, but verify `bg-slate-900/95` and text colors look correct overlaid on a light background. The modal can stay dark-themed (overlay pattern).
- Update `LoginPrompt.tsx`: Same as above — it floats above content with its own dark background, should still look fine. Verify positioning doesn't conflict with new fixed bottom nav bar.
- In reader `page.tsx`: Remove unused imports (Sheet, SheetRef, ArrowLeft, Settings, Bookmark, Info, etc.) if not already removed
- Remove `textSheetOpen`, `sheetRef`, `showSettingsPanel` state if not already removed
- Ensure `safe-area-inset-bottom` padding is on the fixed bottom nav bar
- Clean up any commented-out code or unused variables
- Toast notifications: Update toast styling to use theme-aware colors instead of hardcoded `bg-slate-800/90`

### 5. Verify Keyboard Navigation
- **Task ID**: verify-keyboard-nav
- **Depends On**: update-word-highlighting, polish-overlays
- **Assigned To**: builder-reader
- **Agent Type**: general-purpose
- **Parallel**: false
- Ensure the existing keyboard handler still works: ArrowRight/Space → nextPage, ArrowLeft → prevPage, Escape → no longer needed (remove or repurpose)
- The keyboard handler should NOT interfere with audio controls or the settings panel
- Verify that removing swipe handlers didn't break anything

### 6. Final Validation
- **Task ID**: validate-all
- **Depends On**: verify-keyboard-nav
- **Assigned To**: validator
- **Agent Type**: validator
- **Parallel**: false
- Run `npm run build` to verify TypeScript compiles without errors
- Verify no unused imports or variables remain
- Check that all existing functionality is preserved:
  - Audio playback (narration + soundscape) still works
  - Word highlighting during narration still works
  - Reading progress saves and restores
  - Feedback modal triggers on exit after 2+ pages
  - Login prompt shows for unauthenticated users
  - Keyboard navigation works
- Verify the new layout renders correctly:
  - Top progress bar shows correct fill percentage
  - X button navigates back
  - Image renders centered with rounded corners
  - Text renders centered below image
  - Bottom nav buttons work
  - Light mode is clean white background
  - Dark mode activates with system preference

## Acceptance Criteria
- [ ] Reader uses light background by default, dark with `prefers-color-scheme: dark`
- [ ] Top of page shows green progress bar (Duolingo-style) with X close button
- [ ] No more bottom sheet — text is inline below the image
- [ ] Image is displayed as a centered card with rounded corners (~40-50% of viewport)
- [ ] Text is centered, large, bold, sans-serif below the image
- [ ] Active word during narration is highlighted with light green background (not amber glow)
- [ ] Bottom of page has full-width teal/blue next button with arrow icon
- [ ] Previous page accessible via back button when past page 1
- [ ] No swipe navigation — only bottom buttons and keyboard arrows
- [ ] Audio controls (narration + soundscape) are present and functional
- [ ] Reading progress tracking still saves/restores correctly
- [ ] Feedback modal still triggers on exit
- [ ] Login prompt still shows for unauthenticated users
- [ ] TypeScript compiles without errors (`npm run build` passes)
- [ ] No unused imports or dead code from the old layout

## Validation Commands
Execute these commands to validate the task is complete:

- `npm run build` — Full build passes without TypeScript errors
- `npm run lint` — No linting errors
- Manually verify: open reader in browser, light mode should be white bg with green progress bar
- Manually verify: toggle system dark mode, reader should switch to dark theme
- Manually verify: click next arrow, page advances, progress bar fills
- Manually verify: play narration, active word gets green highlight
- Manually verify: navigate 2+ pages then click X, feedback modal should appear if eligible

## Notes
- The project uses Tailwind CSS v4 with `@import "tailwindcss"` syntax and `@theme inline` blocks. New CSS variables should be added in `:root` and `@media (prefers-color-scheme: dark)` blocks.
- The `react-modal-sheet` package can remain in `package.json` for now since it may be used elsewhere. The import just needs to be removed from the reader page.
- Fonts available: Inter (sans), Lora (serif), Playfair Display (display serif), JetBrains Mono (mono). The new design should primarily use Inter (font-sans) for text content since Duolingo uses a clean sans-serif.
- The Duolingo screenshots show three states: (1) cover/title page with book illustration, (2) content page with full-bleed illustration + text below, (3) content page with highlighted vocabulary word. All three should be replicated in the new layout.
- Keep the settings panel functionality (narration volume, soundscape mode, auto-play) but access it through a minimal icon rather than the old hidden UI chrome pattern.
- On the first page (cover), show only the next button (like Duolingo). On subsequent pages, show both prev and next.

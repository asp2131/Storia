# Landing Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Storia landing page with accurate library/narration copy, preview-only story card affordances, and a compact press strip for Equitech + ALTA 2026.

**Architecture:** This is a static landing-page cleanup contained to `StoriaCalmLanding`. Keep content inline with the existing component, add a small press-link data constant for clarity, and add focused CSS selectors for the preview note and press strip. No backend or route changes are needed.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS module-style global component stylesheet, GSAP scroll animations.

---

## File Map

- Modify `src/components/StoriaCalmLanding.tsx`
  - Add `PRESS_LINKS` constant near `BOOKS`.
  - Update “Choose” and “Listen” step copy.
  - Add preview-only helper copy to the stories section.
  - Update community captions.
  - Add compact featured press strip after the community photo grid.
- Modify `src/components/StoriaCalmLanding.css`
  - Remove story-card hover lift that implies interactivity.
  - Add `.stories-note` styling.
  - Add `.press-strip`, `.press-card`, and responsive styles.
- Verification only
  - Run TypeScript/build-oriented checks.
  - Manually inspect landing page at desktop and mobile widths.

## Task 1: Landing Copy + Press Markup

**Files:**
- Modify: `src/components/StoriaCalmLanding.tsx`

- [ ] **Step 1: Add press-link data constant after `BOOKS`**

Add this constant immediately after the `BOOKS` array:

```tsx
const PRESS_LINKS = [
  {
    label: "Equitech Futures",
    title: "Shivang Thakor is building the conditions for children to love reading",
    href: "https://www.equitechfutures.com/articles/shivang-thakor-is-building-the-conditions-for-children-to-love-reading",
  },
  {
    label: "ALTA 2026 Podcast",
    title: "Shivang Thakor of the Storia Kids App",
    href: "https://www.youtube.com/watch?v=wmx2MVKhntw&t=2s",
  },
];
```

- [ ] **Step 2: Update the “Choose” step copy**

Replace this paragraph:

```tsx
<p>
  Kids wander a hand-drawn story world and pick tales by mood,
  length, or hero. Over 60 stories and counting.
</p>
```

with:

```tsx
<p>
  Kids wander a hand-drawn story world and pick tales by mood,
  length, or hero. A growing library of stories is live now, with
  more coming soon.
</p>
```

- [ ] **Step 3: Update the “Listen” step copy**

Replace this paragraph:

```tsx
<p>
  Every story is narrated by a human reader, with pauses,
  expression, and care. Kids can read along or simply listen.
</p>
```

with:

```tsx
<p>
  Every story includes warm, expressive narration, with pauses,
  rhythm, and care. Kids can read along or simply listen.
</p>
```

- [ ] **Step 4: Add preview-only helper copy to the stories header**

In the `stories-head` block, after the existing lede paragraph:

```tsx
<p className="lede reveal">
  Classics, folk tales, and originals — narrated with care. New
  titles added each month.
</p>
```

add:

```tsx
<p className="stories-note reveal">
  Preview of the current shelf — 8 titles now, with more on the way.
</p>
```

- [ ] **Step 5: Update community captions**

Change:

```tsx
<figcaption>Family Lit Fest, 2025</figcaption>
```

to:

```tsx
<figcaption>Tulane Book Festival with Former Mayor Mitch Landrieu</figcaption>
```

Change:

```tsx
<figcaption>Meeting readers in Lafayette Square</figcaption>
```

to:

```tsx
<figcaption>Family Day</figcaption>
```

Leave `With author Cherelyn Poe` and `Meet the mascot` unchanged because the press links will live in the new strip, not as replacement photo captions.

- [ ] **Step 6: Add featured press strip after the community photo grid**

Immediately after the closing `</div>` for `<div className="c-grid">...</div>` and before `</section>` for the community section, add:

```tsx
<div className="press-strip reveal" aria-label="Storia press features">
  <p className="press-eyebrow">Featured in</p>
  <div className="press-cards">
    {PRESS_LINKS.map((item) => (
      <a
        className="press-card"
        href={item.href}
        key={item.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>{item.label}</span>
        <strong>{item.title}</strong>
      </a>
    ))}
  </div>
</div>
```

- [ ] **Step 7: Verify TypeScript syntax locally**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: exits `0` with no TypeScript errors from `StoriaCalmLanding.tsx`.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/components/StoriaCalmLanding.tsx
git commit -m "feat: update landing content and press links"
```

## Task 2: Landing CSS Polish

**Files:**
- Modify: `src/components/StoriaCalmLanding.css`

- [ ] **Step 1: Remove preview-card hover lift**

Replace:

```css
.storia-calm .book-card:hover .bc-cover {
  transform: translateY(-4px);
}
```

with:

```css
.storia-calm .book-card {
  flex: 0 0 240px;
  scroll-snap-align: start;
  cursor: default;
}
```

If that creates a duplicate `.book-card` rule, merge the declarations into the existing `.book-card` rule so the final rule is exactly:

```css
.storia-calm .book-card {
  flex: 0 0 240px;
  scroll-snap-align: start;
  cursor: default;
}
```

- [ ] **Step 2: Remove unnecessary cover transition**

In `.storia-calm .bc-cover`, remove this line because there is no longer an interactive hover transform:

```css
transition: transform 0.3s;
```

- [ ] **Step 3: Add stories-note styles after `.stories-head` block**

After the `.storia-calm .stories-head { ... }` rule, add:

```css
.storia-calm .stories-note {
  margin: 18px 0 0;
  color: var(--sl-ink-50);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 4: Add press-strip styles after `.c-tile figcaption`**

After the `.storia-calm .c-tile figcaption { ... }` rule, add:

```css
.storia-calm .press-strip {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 24px;
  align-items: stretch;
  margin-top: 28px;
  border: 1px solid var(--sl-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.34);
  padding: 22px;
}

.storia-calm .press-eyebrow {
  margin: 0;
  color: var(--sl-accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.storia-calm .press-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.storia-calm .press-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--sl-border);
  border-radius: 14px;
  background: var(--sl-paper);
  padding: 18px;
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.storia-calm .press-card:hover,
.storia-calm .press-card:focus-visible {
  border-color: rgba(237, 97, 81, 0.42);
  box-shadow: 0 14px 34px rgba(26, 21, 18, 0.08);
  transform: translateY(-2px);
  outline: none;
}

.storia-calm .press-card span {
  color: var(--sl-ink-50);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.storia-calm .press-card strong {
  color: var(--sl-ink);
  font-family: var(--sl-display);
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.015em;
}
```

- [ ] **Step 5: Add responsive press styles inside existing mobile media query**

Inside the existing `@media (max-width: 900px)` block, after:

```css
.storia-calm .c-grid {
  grid-template-columns: 1fr;
}
```

add:

```css
.storia-calm .press-strip,
.storia-calm .press-cards {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 6: Verify CSS selectors exist in compiled source**

Run:

```bash
rg -n "stories-note|press-strip|press-card|book-card:hover" src/components/StoriaCalmLanding.css
```

Expected:

- Finds `stories-note`, `press-strip`, and `press-card` selectors.
- Does not find `book-card:hover`.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/components/StoriaCalmLanding.css
git commit -m "style: polish landing preview and press strip"
```

## Task 3: QA Verification

**Files:**
- Verify: `src/components/StoriaCalmLanding.tsx`
- Verify: `src/components/StoriaCalmLanding.css`

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit --pretty false
```

Expected: exit `0`.

- [ ] **Step 2: Run a production build if environment dependencies are available**

```bash
npm run build
```

Expected: build completes. If local database/env blocks build, capture the exact failure and run `npx tsc --noEmit --pretty false` as the minimum verification.

- [ ] **Step 3: Start the dev server for manual review**

```bash
npm run dev
```

Expected: Next dev server starts and serves `/`.

- [ ] **Step 4: Manual review checklist**

Open `/` and verify:

- The “Choose” step says a growing library is live with more coming soon.
- The “Listen” step says warm, expressive narration.
- The story shelf includes preview-only helper copy.
- Story cards do not navigate anywhere and do not visually lift on hover.
- The community caption says “Tulane Book Festival with Former Mayor Mitch Landrieu.”
- The community grid still lays out correctly on desktop and mobile.
- The press strip appears near the community section.
- Equitech link opens `https://www.equitechfutures.com/articles/shivang-thakor-is-building-the-conditions-for-children-to-love-reading` in a new tab.
- ALTA link opens `https://www.youtube.com/watch?v=wmx2MVKhntw&t=2s` in a new tab.
- Keyboard tab focus reaches both press cards and shows a visible focus style.

- [ ] **Step 5: Capture final status**

Run:

```bash
git status --short
```

Expected: no uncommitted source changes except OpenWolf/session bookkeeping if the environment updates those files.

- [ ] **Step 6: Commit QA notes only if a tracked QA artifact is created**

No commit is required if QA results are reported in chat only. If a QA artifact is created, commit it with:

```bash
git add <qa-artifact-path>
git commit -m "test: verify landing cleanup"
```

## Self-Review

- Spec coverage: Task 1 covers copy, captions, outbound links, and press markup. Task 2 covers preview-only visual affordance, press styling, focus styling, and responsive behavior. Task 3 covers type/build/manual verification.
- Placeholder scan: no placeholder markers remain. The only conditional is build fallback if local environment blocks `npm run build`, with explicit failure-capture behavior.
- Type consistency: `PRESS_LINKS`, `stories-note`, `press-strip`, `press-cards`, and `press-card` names match across TSX and CSS tasks.

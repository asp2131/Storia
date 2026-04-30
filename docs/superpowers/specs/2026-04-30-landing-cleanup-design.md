# Landing Page Cleanup Design

Date: 2026-04-30

## Goal

Clean up the Storia landing page with focused content and UX tweaks. The work should make the page more accurate, reduce confusing story-card affordances, and add recent external credibility without turning this into a full homepage redesign.

## Scope

### Included

- Update library-size copy to avoid overstating the current catalog.
- Replace direct “human reader” wording with softer narration language.
- Make story cards clearly decorative and preview-only.
- Update the community caption for the Tulane Book Festival photo.
- Add a small “Featured in” press strip for the Equitech article and ALTA 2026 podcast appearance.

### Excluded

- Photo replacement or retouching. The user will handle photo edits separately.
- A dedicated press page or large new press section.
- Changes to the library app, reader, authentication, or backend APIs.

## Content Decisions

### Library copy

Replace the current “Over 60 stories and counting” claim with copy that reflects the current state: Storia has 8 titles now, with more coming soon.

Preferred phrasing direction:

- “a growing library of stories”
- “8 titles now, with more coming soon”

The final implementation should use one concise sentence in the “Choose” step that avoids exact overclaims while still sounding optimistic.

### Narration copy

Replace “Every story is narrated by a human reader” with softer wording.

Preferred phrasing:

- “Every story includes warm, expressive narration…”

The copy should not overpromise that every asset is live human narration. It should preserve the warm read-aloud positioning.

### Story cards

The story cards in the landing page library rail should remain non-clickable. The UI should make them feel like a preview of the library, not interactive cards with a pending click action.

Implementation direction:

- Keep the existing card structure unless a small CSS adjustment is needed.
- Add copy such as “Preview of the current shelf” or “A peek at the current library.”
- Avoid cursor, hover, or CTA styling that suggests cards open a page.

## Community + Press Design

Use the selected Option B: keep the emotional community photo grid, then add a compact “Featured in” strip nearby for external credibility.

### Community caption update

Change the former mayor/community photo caption to:

> Tulane Book Festival with Former Mayor Mitch Landrieu

### Press strip

Add a small “Featured in” strip near the community section. It should include two outbound links:

1. Equitech feature article
   - URL: `https://www.equitechfutures.com/articles/shivang-thakor-is-building-the-conditions-for-children-to-love-reading`
   - Suggested label: “Equitech Futures”
   - Suggested supporting text: “Shivang Thakor is building the conditions for children to love reading”

2. ALTA 2026 podcast appearance
   - URL: `https://www.youtube.com/watch?v=wmx2MVKhntw&t=2s`
   - Suggested label: “ALTA 2026 Podcast”
   - Suggested supporting text: “Shivang Thakor of the Storia Kids App”

The links should open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.

## UI/Architecture Notes

Primary implementation files are expected to be:

- `src/components/StoriaCalmLanding.tsx`
- `src/components/StoriaCalmLanding.css`

No new backend routes or data model changes are needed. Static content can live inline with the landing component unless implementation reveals an existing local constant pattern that should be followed.

## Accessibility and UX Requirements

- Press links must have clear text labels and visible focus states through existing link/card styles or small CSS additions.
- Story preview cards must not be keyboard focusable unless they become true links/buttons, which is out of scope.
- External links must clearly communicate destination through text, not icon-only affordances.
- Copy should remain readable on mobile layouts.

## Testing / Verification

Minimum verification after implementation:

- Typecheck or lint/build command appropriate for this Next.js app.
- Manual landing-page review at desktop and mobile widths.
- Confirm story cards are not clickable or focusable.
- Confirm external press links open the correct URLs in a new tab.
- Confirm updated copy appears in the “How it works” and community/press areas.

## Open Questions

None. Photo edits are intentionally deferred to the user.

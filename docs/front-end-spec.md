# Mobile-First Reader UI/UX Specification

## 1. Introduction
This document defines the user experience goals, interaction patterns, and visual specifications for the mobile overhaul of the **Storia Reader**. It serves as the blueprint for implementing a responsive, touch-friendly, and immersive reading experience on mobile devices.

## 2. UX Goals & Principles

### Target User Personas
1.  **The Immersive Reader:**
    *   *Context:* Reading on a phone during commute or in bed.
    *   *Goal:* Get lost in the story and soundscape without distraction.
    *   *Needs:* One-handed operation, large readable text, hidden controls.
2.  **The Explorer:**
    *   *Context:* Browsing books to check visual style and mood.
    *   *Goal:* Quickly flip through pages and sample audio.
    *   *Needs:* Fast navigation, responsive gestures.

### Core Design Principles
1.  **Content First:** The book page is the hero. UI controls (headers/footers) should recede when not needed.
2.  **Natural Gestures:** Navigation should feel physical—swiping to turn, tapping to interact.
3.  **Thumb-Friendly:** Primary interactions (turning pages, toggling controls) must be reachable with one thumb.
4.  **Readable by Default:** Layouts must adapt to device orientation (Single page for Portrait, Double for Landscape).

## 3. Information Architecture & Layout

### Screen Structure
*   **Immersive Layer (Base):** The Book Page / Flipbook container. Occupies 100% of the screen.
*   **HUD Layer (Overlay):**
    *   **Top Bar:** Back navigation, Book Title (Truncated), Settings (Text size, etc.).
    *   **Bottom Bar:** Audio Player (Play/Pause, Volume), Page Scrubber/Progress.
    *   *Behavior:* Toggled via "Tap Center" interaction. Transitions with a fade effect.

### Responsive Strategy

| Device Mode | Layout | Interaction |
| :--- | :--- | :--- |
| **Mobile Portrait** | **Single Page View** | Maximize width. Flip effect creates a "pad" or single-sheet turn feel. |
| **Mobile Landscape** | **Double Page View** | Traditional open book look. |
| **Tablet/Desktop** | **Double Page View** | Standard flipbook experience. |

## 4. User Flows & Interactions

### Flow: Reading a Book
1.  **Entry:** User taps book cover from Library.
2.  **Loading:** Skeleton screen or cover image displays while assets/audio load.
3.  **Reading State (Immersive):**
    *   **Swipe Left:** Next Page (Flip animation).
    *   **Swipe Right:** Previous Page (Flip animation).
    *   **Tap Left Edge (20%):** Previous Page.
    *   **Tap Right Edge (20%):** Next Page.
4.  **Control State (HUD Active):**
    *   **Tap Center (60%):** Toggle HUD (Header/Footer) visibility.
    *   *Transition:* HUD elements fade in/slide in from edges.
5.  **Exit:** Tap "Back" in Top Bar -> Returns to Library.

### Flow: Audio Control
1.  **Trigger:** User Taps Center to reveal HUD.
2.  **Action:** User taps "Play/Pause" in Bottom Bar.
3.  **Feedback:** Icon toggles, audio fades in/out (crossfade logic preserved).
4.  **Volume:** Slider available in Bottom Bar (or physical volume buttons control system volume).

## 5. Visual Specifications

### Typography & Color
*   **Background:** Deep Indigo/Black (`#0a0e1a`) to match app theme.
*   **Text:** Off-white (`#e2e8f0`) for high contrast but low eye strain.
*   **Active Elements:** Electric Blue (`#1337ec`) for active states (e.g., current page in scrubber).

### Touch Targets
*   **Minimum Target Size:** 44x44px for all interactive icons.
*   **Safe Zones:** Ensure bottom controls clear the iOS Home Indicator/Android Nav Bar.

## 6. Technical Implementation Notes
*   **Library:** Continue using `page-flip` but update configuration:
    *   `usePortrait: true` (enables single page view).
    *   `autoSize: true` (adapts to container).
*   **Gestures:** Implement custom touch handlers or use a library like `Hammer.js` if `page-flip` native gestures are insufficient.
*   **CSS:** Use `dvh` (Dynamic Viewport Height) units to prevent layout jumps on mobile browsers when address bars collapse.

## 7. Next Steps
1.  **Refactor Layout:** Update `reader_live.html.heex` to support the "HUD" overlay structure.
2.  **Update JS Hook:** Modify `app.js` to handle `resize` events and switch `page-flip` modes (Portrait/Landscape).
3.  **Add Touch Listeners:** Ensure swipes trigger `flip.turnToPrev()` / `flip.turnToNext()`.


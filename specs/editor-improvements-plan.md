# Editor UI/UX Improvements Plan

This document outlines the implementation plan for the top 6 UI/UX improvements to the Storia Book Editor, aiming to reduce friction and enhance the overall creator experience.

## 1. Unify the "New" and "Edit" Workflows (Save-First Architecture)

**Problem:** 
Currently, the `new` and `edit` pages are separate, with the `new` page lacking advanced features (drag-and-drop audio, text overlays, etc.) because it relies on lazily creating the book and pages on the backend. This leads to duplicate code and race conditions.

**Solution:**
Adopt a "Save-first" architecture.
*   **Workflow:** When a user clicks "Create New Book" on the dashboard, immediately trigger a server action or API call to create a blank draft shell in the database.
*   **Routing:** Instantly redirect the user to `/admin/books/[id]/edit`.
*   **Cleanup:** Delete the `src/app/admin/(editor)/books/new/page.tsx` entirely. 
*   **Benefit:** Users have immediate access to all advanced tools (like text overlays and AI narration) without waiting for an initial manual save.

---

## 2. Enable True Drag-and-Drop Page Reordering

**Problem:**
The left sidebar renders a grip icon, but pages cannot actually be dragged to reorder. Users have to delete and recreate pages to change their order.

**Solution:**
Implement robust drag-and-drop reordering for the page thumbnails in the left sidebar.
*   **Library:** Integrate `@hello-pangea/dnd` (or `dnd-kit`).
*   **State Updates:** Update the `localPages` state optimistically when a drop occurs.
*   **Backend Sync:** Ensure the new order is saved to the backend during the next autosave or manual save (updating the `pageNumber` fields accordingly).
*   **UX Detail:** Add subtle visual cues (like a drop indicator line) to show where the page will land.

---

## 3. Implement Debounced Autosave

**Problem:**
The editor tracks `hasLocalChanges` but requires the user to manually click "Save Draft" or hit `Cmd+S`. This is high-friction compared to modern cloud editors like Notion or Google Docs.

**Solution:**
Automatically save changes in the background without user intervention.
*   **Implementation:** Add a `useEffect` hook that watches `localPages`, `localTitle`, `localAuthor`, and `hasLocalChanges`.
*   **Debounce:** Use a debounce utility (e.g., from `lodash` or a custom hook) with a delay of 3–5 seconds.
*   **Action:** If changes exist and the debounce timer expires, automatically trigger the `handleSave()` function.
*   **UI Feedback:** Update the top-right status indicator to smoothly transition between "Saved", "Saving...", and "Unsaved changes".

---

## 4. Paste-to-Upload for Images

**Problem:**
Users must click a file picker or explicitly drag a file from their file system into the drop zone to add an image. Many creators copy AI-generated art directly to their clipboard.

**Solution:**
Allow direct image pasting onto the canvas.
*   **Implementation:** Add a global `onPaste` event listener (or scope it to the main editor container).
*   **Logic:** Intercept the paste event, check `event.clipboardData.items` for image types, and extract the `File` object.
*   **Action:** Pass the extracted file directly into the existing `handleImageFile(file)` function.
*   **Benefit:** Drastically speeds up workflows for users sourcing images from midjourney/DALL-E or the web.

---

## 5. Consolidated "Filmstrip" or Grid View Option

**Problem:**
The left sidebar vertically stacks all page thumbnails. For a 30-page children's book, vertical scrolling becomes tedious, and it's hard to get a bird's-eye view of the story.

**Solution:**
Provide alternative ways to view and navigate pages.
*   **Filmstrip Mode:** Add an option to move the pages to a horizontal scrolling "Filmstrip" along the bottom of the screen (similar to video timeline editors). This maximizes horizontal screen space for the canvas.
*   **Grid View Toggle:** Alternatively, add a "Grid View" button that opens a full-screen overlay or expands the sidebar to show all pages in a multi-column grid, making bulk reordering and overview much easier.

---

## 6. Better "Master Preview" Experience

**Problem:**
Users can currently preview the narration and soundscape individually, but there's no cohesive way to experience the final product (audio + visual + text sync) without publishing.

**Solution:**
Build a synchronized "Play Page" master control.
*   **Implementation:** A single prominent "Play" button above or below the canvas.
*   **Sync Logic:** When clicked, simultaneously trigger `soundscapeRef.play()` and `narrationRef.play()`.
*   **Visual Sync:** Utilize the existing `narrationTimestamps` to highlight the text overlay words in real-time as the narration plays.
*   **Benefit:** Creators can verify that the pacing, ambient audio volume, and visual layout all feel harmonious before moving to the next page.

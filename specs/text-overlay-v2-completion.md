# Plan: Text Overlay v2 Completion

## Task Description
Complete the implementation of the Text Overlay v2 feature for the Storia children's book reading application. This feature allows admin users to position styled text directly on book page illustrations, with server-side image compositing that bakes text into images for readers.

The core infrastructure (types, auth, compositing lib, storage, reader component) is already implemented. This plan focuses on the missing pieces:
1. API routes for overlay CRUD and compositing
2. Draggable text overlay editor component
3. Editor page that hosts the component
4. Update reader API to return overlay data

## Objective
Enable admin users to:
- Open a visual editor for any book page
- Add, position, style, and edit text overlays on illustrations
- Save overlay configurations to the database
- Trigger server-side image compositing to bake text into images
- Have readers see the composited images (or dynamic fallback)

## Problem Statement
The Text Overlay v2 specification is complete and core infrastructure exists, but the feature is not yet functional because:
- No API endpoints exist to save/retrieve overlay configs
- No API endpoint exists to trigger compositing
- No admin UI exists to create and edit overlays
- Reader API doesn't return overlay data for dynamic fallback

## Solution Approach
Build the missing components following the existing spec (`specs/text-overlay-v2.md`):

1. **API Layer**: Create RESTful endpoints for overlay CRUD and compositing, with admin auth
2. **Editor Component**: Build a WYSIWYG draggable editor with property panel
3. **Editor Page**: Create the Next.js page that hosts the editor
4. **Reader API Update**: Add overlay and composited image data to reader response

## Relevant Files

### Existing Infrastructure (already implemented)
- `src/types/text-overlay.ts`: Type definitions and validation
- `src/lib/admin-auth.ts`: Admin authentication middleware
- `src/lib/image-compositing.ts`: Server-side image compositing with canvas/sharp
- `src/lib/storage.ts`: Supabase storage upload/delete utilities
- `src/components/IntegratedIllustration.tsx`: Reader component for displaying composited/dynamic overlays
- `prisma/schema.prisma`: Database schema with text_overlay columns (lines 89-93)

### Reference Implementation Patterns
- `src/app/api/admin/books/[id]/route.ts`: Admin book update endpoint pattern
- `src/app/api/admin/books/[id]/pages/route.ts`: Admin pages list endpoint pattern
- `src/app/admin/(editor)/books/[id]/edit/page.tsx`: Book editor page pattern
- `src/app/api/books/[id]/reader/route.ts`: Reader API (needs update)

### New Files to Create
- `src/app/api/admin/books/[id]/pages/[pageNumber]/overlay/route.ts`: GET/POST/PATCH for overlay CRUD
- `src/app/api/admin/books/[id]/pages/[pageNumber]/composite/route.ts`: POST/GET for compositing
- `src/components/text-overlay/DraggableTextOverlayEditor.tsx`: Main editor component
- `src/components/text-overlay/Toolbar.tsx`: Editor toolbar sub-component
- `src/components/text-overlay/PropertyPanel.tsx`: Text properties panel
- `src/app/admin/books/[id]/pages/[pageNumber]/overlay-editor/page.tsx`: Editor page

## Implementation Phases

### Phase 1: API Routes
Create the backend endpoints for overlay management and compositing.

### Phase 2: Editor Components
Build the draggable WYSIWYG editor with toolbar and property panel.

### Phase 3: Editor Page & Integration
Create the page that hosts the editor and update reader API.

### Phase 4: Validation
Test the complete flow: create overlay → save → composite → view in reader.

## Team Orchestration

### Team Management Approach
- Use parallel execution where possible (API routes can be built in parallel with editor components)
- Sequential dependencies: API routes must exist before editor page integration testing
- Shared understanding: All agents must reference `specs/text-overlay-v2.md` for contracts

### Team Members

- **Builder: API-Specialist**
  - Role: Create API routes for overlay CRUD and compositing
  - Agent Type: general-purpose
  - Resume: false

- **Builder: UI-Engineer**
  - Role: Build DraggableTextOverlayEditor component with all sub-components
  - Agent Type: general-purpose
  - Resume: false

- **Builder: Integration-Dev**
  - Role: Create editor page and update reader API
  - Agent Type: general-purpose
  - Resume: false

- **Validator: QA-Engineer**
  - Role: Validate all components work together, run tests
  - Agent Type: general-purpose
  - Resume: false

## Step by Step Tasks

### 1. Create Overlay API Route
- **Task ID**: create-overlay-api
- **Depends On**: none
- **Assigned To**: API-Specialist
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/app/api/admin/books/[id]/pages/[pageNumber]/overlay/route.ts`
- Implement GET handler to fetch overlay config, imageUrl, compositedImageUrl
- Implement POST handler to save/replace overlay config (validate with validateOverlayConfig)
- Implement PATCH handler for partial updates
- On save, clear composited_image_url, composited_at, composited_by to mark stale
- Use requireAdmin() for auth, handle errors properly

### 2. Create Compositing API Route
- **Task ID**: create-composite-api
- **Depends On**: none
- **Assigned To**: API-Specialist
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/app/api/admin/books/[id]/pages/[pageNumber]/composite/route.ts`
- Implement GET handler to check compositing status (hasOverlay, hasBaseImage, compositedImageUrl, isStale)
- Implement POST handler to trigger compositing:
  - Fetch page, verify overlay exists and image_url exists
  - Call compositePageImage() from lib/image-compositing.ts
  - Upload result via uploadCompositedImage() from lib/storage.ts
  - Update pages row with composited_image_url, composited_image_path, composited_at, composited_by
  - Delete old composited image if path exists
  - Return compositedImageUrl, compositedImagePath, compositedAt

### 3. Build PropertyPanel Component
- **Task ID**: build-property-panel
- **Depends On**: none
- **Assigned To**: UI-Engineer
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/components/text-overlay/PropertyPanel.tsx`
- Props: selectedElement, onUpdate, onDelete
- Inputs: text content (textarea), fontFamily (select from AVAILABLE_FONTS), fontSize (range 0.5-50), fontWeight (select), color (color picker), textAlign (button group), rotation (range -180 to 180)
- Optional sections: shadow controls (toggle + color, offsetX, offsetY, blur), background controls (toggle + color, padding, borderRadius)
- Style with Tailwind CSS, use inline styles for dynamic values only

### 4. Build Toolbar Component
- **Task ID**: build-toolbar
- **Depends On**: none
- **Assigned To**: UI-Engineer
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/components/text-overlay/Toolbar.tsx`
- Props: onAddElement, onSave, onComposite, isSaving, isCompositing, hasChanges, isStale
- Buttons: "Add Text" (primary), "Save" (secondary, disabled when no changes), "Composite" (secondary, disabled when no overlay or already composited and not stale)
- Show status indicator: saved/unsaved changes, composited/stale state
- Style with Tailwind CSS

### 5. Build DraggableTextOverlayEditor Component
- **Task ID**: build-editor-component
- **Depends On**: build-property-panel, build-toolbar
- **Assigned To**: UI-Engineer
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/components/text-overlay/DraggableTextOverlayEditor.tsx`
- Props: imageUrl, overlay, onSave, onComposite, isSaving, isCompositing
- State: elements array, selectedElementId, drag state
- Layout: left side = image canvas with draggable elements, right side = PropertyPanel
- Top = Toolbar
- ImageCanvas: relative container with base image, positioned text elements
- Draggable elements: use onPointerDown/Move/Up, calculate percentage positions from container rect
- Resize handle: bottom-right corner for width adjustment
- Preview text styling: fontFamily, fontSize (calculated from container height), fontWeight, color, textAlign, rotation, shadow, background
- No dynamically constructed Tailwind classes - use inline styles for all dynamic values

### 6. Create Editor Page
- **Task ID**: create-editor-page
- **Depends On**: create-overlay-api, create-composite-api, build-editor-component
- **Assigned To**: Integration-Dev
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/app/admin/books/[id]/pages/[pageNumber]/overlay-editor/page.tsx`
- Fetch book and page data on load (server component or useEffect)
- Fetch overlay config from API on mount
- State: overlay config, isSaving, isCompositing, saveError, compositeError
- Handlers: handleSave (POST/PATCH to overlay API), handleComposite (POST to composite API)
- Render DraggableTextOverlayEditor with fetched data
- Handle loading and error states
- Add breadcrumb navigation back to book

### 7. Update Reader API
- **Task ID**: update-reader-api
- **Depends On**: none
- **Assigned To**: Integration-Dev
- **Agent Type**: general-purpose
- **Parallel**: true
- Modify `src/app/api/books/[id]/reader/route.ts`
- Add to page response: compositedImageUrl (page.composited_image_url), overlay (page.text_overlay as TextOverlayConfig | null)
- Keep imageUrl as original illustration (don't overwrite)

### 8. Validate Complete Flow
- **Task ID**: validate-all
- **Depends On**: create-editor-page, update-reader-api
- **Assigned To**: QA-Engineer
- **Agent Type**: general-purpose
- **Parallel**: false
- Run `npm run build` to check for TypeScript errors
- Run `npm run lint` to check for linting issues
- Verify API routes compile and export correctly
- Verify component imports and exports
- Check that reader API returns new fields
- Document any issues found

## Acceptance Criteria

- [ ] GET /api/admin/books/[id]/pages/[pageNumber]/overlay returns overlay config, imageUrl, compositedImageUrl
- [ ] POST /api/admin/books/[id]/pages/[pageNumber]/overlay saves overlay config with validation
- [ ] PATCH /api/admin/books/[id]/pages/[pageNumber]/overlay updates overlay config
- [ ] GET /api/admin/books/[id]/pages/[pageNumber]/composite returns compositing status with isStale flag
- [ ] POST /api/admin/books/[id]/pages/[pageNumber]/composite triggers compositing and updates page
- [ ] DraggableTextOverlayEditor allows adding, dragging, resizing, styling text elements
- [ ] PropertyPanel allows editing all text element properties
- [ ] Toolbar shows save/composite buttons with proper state management
- [ ] Editor page loads at /admin/books/[id]/pages/[pageNumber]/overlay-editor
- [ ] Reader API returns compositedImageUrl and overlay fields
- [ ] All TypeScript compiles without errors
- [ ] No dynamically constructed Tailwind classes in any component

## Validation Commands

Execute these commands to validate the task is complete:

```bash
# Check TypeScript compilation
cd /Users/akinpound/Documents/experiments/storia && npx tsc --noEmit

# Check for lint errors
npm run lint

# Build the application
npm run build

# Verify API routes exist
ls -la src/app/api/admin/books/[id]/pages/[pageNumber]/overlay/
ls -la src/app/api/admin/books/[id]/pages/[pageNumber]/composite/

# Verify components exist
ls -la src/components/text-overlay/

# Verify editor page exists
ls -la src/app/admin/books/[id]/pages/[pageNumber]/overlay-editor/
```

## Notes

- **CRITICAL**: Never use dynamically constructed Tailwind classes (e.g., `className={`text-[${size}px]`}`). Always use inline styles for dynamic values.
- All coordinates use percentages (0-100) for resolution independence
- The composited image should be preferred in the reader, with dynamic overlay as fallback
- Old composited images should be deleted when new ones are created
- The editor should warn users when overlay is stale (modified after last composite)
- Reference `specs/text-overlay-v2.md` for complete contract details

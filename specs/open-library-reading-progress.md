# Plan: Open Library Access with Reading Progress Tracking

## Task Description
Implement a two-tier library experience for Storia:
1. **Open access** - Allow pilot users to browse and read books without logging in for quick feedback gathering
2. **Login incentive** - Provide reading progress tracking as a value-add for authenticated users, enabling them to bookmark their place and return where they left off

## Objective
When complete, anonymous users can freely browse the library and read books, while authenticated users gain the added benefit of persistent reading progress that syncs across devices.

## Problem Statement
Currently, the Library page (`/library`) requires authentication and redirects unauthenticated users to the home page. This creates friction for pilot users who want to quickly explore the product. Additionally, there's no reading progress feature to incentivize account creation.

## Solution Approach
1. Remove authentication requirement from Library and Reader pages
2. Create a new reading progress API that works with Better Auth's user system
3. Add a new Prisma model to track reading progress tied to Better Auth users
4. Implement progress save/load in the Reader component
5. Show "Continue Reading" indicators in the Library for authenticated users
6. Display a subtle login prompt for anonymous users in the Reader

## Relevant Files
Use these files to complete the task:

**Library Page (remove auth requirement, add progress display)**
- `src/app/library/page.tsx` - Main library page that currently requires auth

**Reader Page (add progress tracking)**
- `src/app/books/[id]/reader/page.tsx` - Book reader component
- `src/hooks/useBookData.ts` - Data fetching hooks, add progress hooks here

**Authentication**
- `src/lib/auth.ts` - Better Auth server configuration
- `src/lib/auth-client.ts` - Better Auth client hooks

**Database**
- `prisma/schema.prisma` - Add new model for Better Auth user reading progress

**API Routes**
- `src/app/api/books/route.ts` - Books API, enhance with progress data

### New Files
- `src/app/api/reading-progress/route.ts` - API for saving/loading reading progress
- `src/hooks/useReadingProgress.ts` - Client hook for managing reading progress
- `src/components/LoginPrompt.tsx` - Subtle login prompt component for reader

## Implementation Phases

### Phase 1: Foundation
- Create new Prisma model for Better Auth user reading progress
- Run database migration
- Create reading progress API endpoint

### Phase 2: Core Implementation
- Remove auth requirement from Library page
- Implement progress tracking in Reader
- Add progress loading/saving hooks
- Integrate localStorage fallback for anonymous users

### Phase 3: Integration & Polish
- Add "Continue Reading" section to Library for logged-in users
- Add progress indicators on book cards
- Create login prompt component for Reader
- Test anonymous and authenticated flows

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
  - Name: builder-schema
  - Role: Database schema updates and Prisma migrations
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-api
  - Role: API endpoint development for reading progress
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-library
  - Role: Library page updates - remove auth, add progress display
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-reader
  - Role: Reader component updates - progress tracking and login prompt
  - Agent Type: general-purpose
  - Resume: true

- Validator
  - Name: validator
  - Role: Validate all changes work correctly
  - Agent Type: validator
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Update Prisma Schema
- **Task ID**: update-prisma-schema
- **Depends On**: none
- **Assigned To**: builder-schema
- **Agent Type**: general-purpose
- **Parallel**: false
- Add `user_reading_progress` model to `prisma/schema.prisma` with the following fields:
  - `id` - String @id @default(cuid())
  - `userId` - String (references Better Auth `user.id`)
  - `bookId` - BigInt (references `books.id`)
  - `currentPage` - Int @default(1)
  - `totalPages` - Int (for progress calculation)
  - `lastReadAt` - DateTime
  - `createdAt` - DateTime @default(now())
  - `updatedAt` - DateTime @updatedAt
- Add relation to `user` model: `readingProgress user_reading_progress[]`
- Add unique constraint on `[userId, bookId]`
- Run `npx prisma generate` to update the client

### 2. Run Database Migration
- **Task ID**: run-migration
- **Depends On**: update-prisma-schema
- **Assigned To**: builder-schema
- **Agent Type**: general-purpose
- **Parallel**: false
- Create migration with `npx prisma migrate dev --name add_user_reading_progress`
- Verify migration succeeded

### 3. Create Reading Progress API
- **Task ID**: create-progress-api
- **Depends On**: run-migration
- **Assigned To**: builder-api
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/app/api/reading-progress/route.ts` with:
  - GET handler: Fetch progress for a book (requires userId query param or auth session)
  - POST handler: Save/update progress (requires auth)
  - Include proper error handling and validation
- API should use Better Auth's session to identify user
- Handle unauthenticated users gracefully (return empty for GET, 401 for POST)

### 4. Create Reading Progress Hook
- **Task ID**: create-progress-hook
- **Depends On**: create-progress-api
- **Assigned To**: builder-api
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/hooks/useReadingProgress.ts` with:
  - `useReadingProgress(bookId)` - fetches progress if authenticated
  - `useSaveProgress()` - mutation to save progress
  - Handle localStorage fallback for anonymous users
  - Auto-save on page change with debouncing
- Export TypeScript types for progress data

### 5. Remove Auth Requirement from Library
- **Task ID**: open-library-access
- **Depends On**: none
- **Assigned To**: builder-library
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside tasks 1-4)
- Modify `src/app/library/page.tsx`:
  - Remove the `useEffect` that redirects to `/` when no session
  - Remove the early return `if (!session) return null`
  - Make session optional throughout the component
  - Show login button in nav for unauthenticated users
  - Keep user menu dropdown for authenticated users

### 6. Add Continue Reading Section
- **Task ID**: add-continue-reading
- **Depends On**: create-progress-hook, open-library-access
- **Assigned To**: builder-library
- **Agent Type**: general-purpose
- **Parallel**: false
- Update Library page to:
  - Fetch user's reading progress for all books (if authenticated)
  - Add "Continue Reading" section at top showing books with progress > 0
  - Display progress bar on book cards showing % complete
  - Sort Continue Reading by `lastReadAt` descending

### 7. Integrate Progress into Reader
- **Task ID**: integrate-reader-progress
- **Depends On**: create-progress-hook
- **Assigned To**: builder-reader
- **Agent Type**: general-purpose
- **Parallel**: false
- Update `src/app/books/[id]/reader/page.tsx`:
  - Import and use `useReadingProgress` hook
  - On mount, load saved progress and set `currentPage`
  - On page change, save progress (debounced, 2 second delay)
  - Show progress restoration toast: "Continuing from page X"

### 8. Create Login Prompt Component
- **Task ID**: create-login-prompt
- **Depends On**: none
- **Assigned To**: builder-reader
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/components/LoginPrompt.tsx`:
  - Subtle banner or floating button design
  - Message: "Sign in to save your reading progress"
  - Link to open auth modal or redirect to home page with auth flag
  - Dismissible (save dismissal to sessionStorage)
  - Only shows after 2+ page views

### 9. Add Login Prompt to Reader
- **Task ID**: add-login-prompt-to-reader
- **Depends On**: integrate-reader-progress, create-login-prompt
- **Assigned To**: builder-reader
- **Agent Type**: general-purpose
- **Parallel**: false
- Import LoginPrompt into reader
- Show only for unauthenticated users
- Position at bottom of screen, above the mobile sheet
- Track page views to trigger display after 2+ pages

### 10. Enhance Books API with Progress
- **Task ID**: enhance-books-api
- **Depends On**: create-progress-api
- **Assigned To**: builder-api
- **Agent Type**: general-purpose
- **Parallel**: false
- Update `src/app/api/books/route.ts`:
  - Accept optional `userId` query parameter
  - When userId provided, include reading progress data in response
  - Add `currentPage` and `progressPercent` to book objects
  - This enables Library to show progress without separate API calls

### 11. Final Validation
- **Task ID**: validate-all
- **Depends On**: add-continue-reading, add-login-prompt-to-reader, enhance-books-api
- **Assigned To**: validator
- **Agent Type**: validator
- **Parallel**: false
- Test anonymous user flow:
  - Can access library without login
  - Can read books without login
  - Sees login prompt after viewing 2+ pages
- Test authenticated user flow:
  - Progress saves on page change
  - Progress restores on return visit
  - Continue Reading section shows in library
  - Progress indicators appear on book cards
- Verify no regressions in existing functionality

## Acceptance Criteria
- [ ] Anonymous users can access `/library` without being redirected
- [ ] Anonymous users can read books at `/books/[id]/reader`
- [ ] Anonymous users see a login prompt after viewing 2+ pages
- [ ] Authenticated users' reading progress saves automatically
- [ ] Authenticated users return to their last page when reopening a book
- [ ] Library shows "Continue Reading" section for authenticated users with progress
- [ ] Book cards show progress percentage for books in progress
- [ ] Progress syncs across devices for authenticated users
- [ ] No errors in console during normal usage
- [ ] TypeScript compiles without errors

## Validation Commands
Execute these commands to validate the task is complete:

- `npx prisma validate` - Ensure schema is valid
- `npx prisma generate` - Ensure client is generated
- `npm run build` - Build passes without errors
- `npm run lint` - No linting errors
- Manual test: Open `/library` in incognito - should load without redirect
- Manual test: Navigate to a book reader in incognito - should work
- Manual test: Sign in, read a few pages, refresh - should restore position

## Notes
- The project uses two user systems: legacy `users` table and Better Auth `user` table. This plan uses Better Auth's `user` table for reading progress since that's the active authentication system.
- localStorage is used as a fallback for anonymous users - this means their progress won't sync across devices but provides a better UX than losing progress entirely.
- The login prompt should be subtle and non-intrusive to avoid annoying pilot users while still communicating the value of signing up.
- Debouncing progress saves prevents excessive API calls during rapid page navigation.

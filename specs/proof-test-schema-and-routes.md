# Plan: Proof-Test Schema Changes & Server Routes

## Task Description
Implement the backend schema changes and API routes required for the proof-test roadmap. This covers child profiles, child-aware reading progress, canonical reading sessions, comprehension questions/submissions, continue-reading resolution, and summary reporting. All changes target the existing Next.js + Prisma + Supabase backend in `storia/`.

## Objective
When this plan is complete, the Storia backend will expose a full set of child-centric API contracts that the Flutter mobile app can consume for Milestone 1 — persistent progress, session logging, comprehension checks, and lightweight reporting.

## Problem Statement
The current backend stores reading progress only at the user level (`user_reading_progress`), has no concept of child profiles, no canonical session logging, no comprehension data model, and no reporting endpoints. The Flutter app needs all of these to prove institutional value (schools, ABA clinics).

## Solution Approach
1. Extend `prisma/schema.prisma` with 6 new models (child_profile, child_book_progress, reading_session, book_question, book_question_option, question_attempt)
2. Generate and apply Prisma migrations
3. Add/update 7 API routes following the contracts defined in `../storia-mobile/specs/proof-test/backend-api-contracts.md`
4. Add a shared auth helper for child-profile ownership validation
5. Update seed data for dev/staging testing

## Relevant Files
Use these files to complete the task:

- `prisma/schema.prisma` — Current schema, needs 6 new models + indexes
- `src/lib/auth.ts` — Better Auth setup (session resolution, no changes needed but auth pattern reference)
- `src/lib/prisma.ts` — Prisma client singleton (no changes needed, reference for imports)
- `src/app/api/reading-progress/route.ts` — Existing progress route, needs child-aware evolution
- `src/app/api/books/route.ts` — Existing books listing, needs child-aware progress enrichment
- `src/app/api/books/[id]/reader/route.ts` — Reader data route (reference, may need `hasQuestions` flag)
- `../storia-mobile/specs/proof-test/backend-api-contracts.md` — Canonical API contract spec (source of truth for request/response shapes)
- `../storia-mobile/specs/proof-test/proof-test-backend-and-flutter-implementation-plan.md` — Full implementation plan with schema field details

### New Files
- `src/app/api/child-profiles/route.ts` — GET/POST child profiles
- `src/app/api/reading-sessions/route.ts` — POST reading sessions
- `src/app/api/books/[bookId]/questions/route.ts` — GET book questions
- `src/app/api/comprehension/route.ts` — POST comprehension submissions
- `src/app/api/continue-reading/route.ts` — GET continue-reading resolution
- `src/app/api/reports/summary/route.ts` — GET child/org summary
- `src/lib/child-auth.ts` — Shared helper: validate authenticated user owns child profile

## Implementation Phases

### Phase 1: Foundation (Schema + Migration + Auth Helper)
1. Add 6 new Prisma models with all fields, relations, and indexes
2. Run `npx prisma migrate dev` to generate migration
3. Create `src/lib/child-auth.ts` — a small utility that:
   - Resolves the Better Auth session
   - Validates `childProfileId` belongs to the authenticated user
   - Returns `{ user, childProfile }` or throws/returns error response

### Phase 2: Core Implementation (Routes)
4. `GET/POST /api/child-profiles` — CRUD for child profiles
5. Update `POST /api/reading-progress` — accept `childProfileId`, write to `child_book_progress` (keep backward compat with `user_reading_progress` for web)
6. Update `GET /api/reading-progress` — accept `childProfileId` query param, return from `child_book_progress`
7. `POST /api/reading-sessions` — idempotent session write with upsert by `sessionId`
8. Update `GET /api/books` — accept `childProfileId`, enrich with progress from `child_book_progress` + `hasNarration` + `hasQuestions` flags
9. `GET /api/continue-reading` — return most recent in-progress book for child
10. `GET /api/books/[bookId]/questions` — return ordered questions + options
11. `POST /api/comprehension` — save answers, compute score, return result

### Phase 3: Reporting + Polish
12. `GET /api/reports/summary` — aggregate reading sessions, completions, comprehension for a child over a date range
13. Update `prisma/seed.ts` — add sample child profiles, sessions, questions, attempts
14. Validate all endpoints against the API contracts spec

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to to the building, validating, testing, deploying, and other tasks.

### Team Members

- Builder
  - Name: schema-builder
  - Role: Prisma schema changes, migration generation, and child-auth helper
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: routes-core-builder
  - Role: Implement child-profiles, reading-progress updates, reading-sessions, and books updates
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: routes-feature-builder
  - Role: Implement continue-reading, questions, comprehension, and reporting routes
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: seed-builder
  - Role: Update seed data with sample child profiles, sessions, questions
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: validator
  - Role: Validate all routes compile, match API contracts, and pass type checks
  - Agent Type: general-purpose
  - Resume: false

## Step by Step Tasks

### 1. Add Prisma Schema Models
- **Task ID**: add-schema-models
- **Depends On**: none
- **Assigned To**: schema-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- Add `child_profile` model to `prisma/schema.prisma`:
  - `id` String @id @default(cuid())
  - `userId` String (FK to `user.id`)
  - `displayName` String
  - `ageBand` String
  - `readingLevel` String? (nullable)
  - `isDefault` Boolean @default(false)
  - `createdAt` DateTime @default(now())
  - `updatedAt` DateTime @updatedAt
  - Relation: `user user @relation(fields: [userId], references: [id], onDelete: Cascade)`
  - Index on `userId`
- Add `child_book_progress` model:
  - `id` String @id @default(cuid())
  - `childProfileId` String (FK to `child_profile.id`)
  - `bookId` BigInt
  - `currentPage` Int @default(1)
  - `totalPages` Int
  - `lastReadAt` DateTime
  - `completedAt` DateTime? (nullable)
  - `completionCount` Int @default(0)
  - `lastSessionId` String? (nullable)
  - `createdAt` DateTime @default(now())
  - `updatedAt` DateTime @updatedAt
  - @@unique([childProfileId, bookId])
  - Index on `childProfileId`, `bookId`
- Add `reading_session` model:
  - `id` String @id @default(cuid())
  - `sessionId` String @unique (client-generated, used for idempotency)
  - `userId` String
  - `childProfileId` String (FK to `child_profile.id`)
  - `bookId` BigInt
  - `startedAt` DateTime
  - `endedAt` DateTime
  - `durationSeconds` Int
  - `startPage` Int
  - `endPage` Int
  - `entryIntent` String @default("standard") (values: "standard", "autoplay_narration")
  - `usedNarration` Boolean @default(false)
  - `usedPracticeMode` Boolean @default(false)
  - `completedBook` Boolean @default(false)
  - `source` String @default("mobile")
  - `metadata` Json? @default("{}")
  - `createdAt` DateTime @default(now())
  - Index on `[childProfileId, startedAt]`, `[bookId, startedAt]`, `userId`
- Add `book_question` model:
  - `id` String @id @default(cuid())
  - `bookId` BigInt
  - `questionText` String
  - `questionType` String @default("multiple_choice")
  - `sortOrder` Int
  - `correctAnswer` String
  - `metadata` Json? @default("{}")
  - `createdAt` DateTime @default(now())
  - `updatedAt` DateTime @updatedAt
  - Index on `[bookId, sortOrder]`
- Add `book_question_option` model:
  - `id` String @id @default(cuid())
  - `questionId` String (FK to `book_question.id`)
  - `optionKey` String (e.g. "A", "B", "C")
  - `optionText` String
  - `sortOrder` Int @default(0)
  - Index on `questionId`
- Add `question_attempt` model:
  - `id` String @id @default(cuid())
  - `userId` String
  - `childProfileId` String (FK to `child_profile.id`)
  - `bookId` BigInt
  - `questionId` String (FK to `book_question.id`)
  - `readingSessionId` String? (nullable)
  - `selectedAnswer` String
  - `isCorrect` Boolean
  - `answeredAt` DateTime @default(now())
  - Index on `[childProfileId, bookId, answeredAt]`, `questionId`
- Add reverse relations on `user` model: `child_profiles child_profile[]`
- Add reverse relations on `child_profile`: `bookProgress child_book_progress[]`, `readingSessions reading_session[]`, `questionAttempts question_attempt[]`
- Run `npx prisma migrate dev --name add_proof_test_models`
- Run `npx prisma generate`

### 2. Create Child Auth Helper
- **Task ID**: create-child-auth-helper
- **Depends On**: add-schema-models
- **Assigned To**: schema-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/lib/child-auth.ts` with:
  - `validateChildAccess(childProfileId: string)` async function that:
    1. Gets Better Auth session via `auth.api.getSession({ headers: await headers() })`
    2. If no session, returns `{ error: NextResponse.json({ error: { code: "unauthorized", message: "Authentication required" }}, { status: 401 }) }`
    3. Queries `prisma.child_profile.findUnique({ where: { id: childProfileId, userId: session.user.id } })`
    4. If not found, returns `{ error: NextResponse.json({ error: { code: "forbidden", message: "You do not have access to this child profile" }}, { status: 403 }) }`
    5. Returns `{ user: session.user, childProfile }`
  - `getAuthenticatedUser()` async function (simpler, just session check)

### 3. Implement Child Profiles Route
- **Task ID**: implement-child-profiles
- **Depends On**: create-child-auth-helper
- **Assigned To**: routes-core-builder
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 4)
- Create `src/app/api/child-profiles/route.ts`
- **GET**: Return all child profiles for authenticated user
  - Auth check via `getAuthenticatedUser()`
  - Query: `prisma.child_profile.findMany({ where: { userId } })`
  - Response: `{ childProfiles: [...] }` per contract spec
- **POST**: Create a new child profile
  - Auth check
  - Validate: `displayName` required, `ageBand` required
  - If `isDefault: true`, unset other defaults first
  - Create profile
  - Response: `{ childProfile: {...} }` with 201 status

### 4. Update Reading Progress Route
- **Task ID**: update-reading-progress
- **Depends On**: create-child-auth-helper
- **Assigned To**: routes-core-builder
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside task 3)
- Update `src/app/api/reading-progress/route.ts`
- **GET**: Add `childProfileId` query param support
  - If `childProfileId` present: validate child access, query `child_book_progress`
  - If no `childProfileId`: fall back to existing `user_reading_progress` logic (backward compat for web)
  - Response shape per contract: `{ progress: { childProfileId, bookId, currentPage, totalPages, progressPercent, lastReadAt, completedAt, completionCount, lastSessionId, status } }`
  - `status` derived: "completed" if completedAt, "in_progress" if currentPage > 0, else "new"
- **POST**: Add `childProfileId` support
  - If `childProfileId` present: validate child access, upsert `child_book_progress`
  - If no `childProfileId`: fall back to existing `user_reading_progress` logic
  - Handle `completed: true` → set `completedAt` if transitioning, increment `completionCount`
  - Response shape per contract

### 5. Implement Reading Sessions Route
- **Task ID**: implement-reading-sessions
- **Depends On**: create-child-auth-helper
- **Assigned To**: routes-core-builder
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside tasks 3, 4)
- Create `src/app/api/reading-sessions/route.ts`
- **POST**: Create/finalize a reading session
  - Auth check + child access validation
  - Validate: `sessionId`, `childProfileId`, `bookId`, `startedAt`, `endedAt`, `startPage`, `endPage` all required
  - Validate: `endedAt >= startedAt`, pages >= 1
  - Compute `durationSeconds` from timestamps
  - Upsert by `sessionId` (idempotent)
  - Response: `{ readingSession: {...} }` per contract

### 6. Update Books Listing Route
- **Task ID**: update-books-listing
- **Depends On**: add-schema-models
- **Assigned To**: routes-core-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- Update `src/app/api/books/route.ts`
- Add `childProfileId` query param support alongside existing `userId`
- If `childProfileId` present:
  - Fetch `child_book_progress` for all returned books
  - Enrich each book with `progress: { currentPage, progressPercent, lastReadAt, completedAt, completionCount, status }`
- Add `hasNarration` flag: check if any page in the book has a non-null `narration_url`
- Add `hasQuestions` flag: check if `book_question` records exist for the book
- Keep existing `userId`-based progress as fallback for web

### 7. Implement Continue Reading Route
- **Task ID**: implement-continue-reading
- **Depends On**: add-schema-models
- **Assigned To**: routes-feature-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/app/api/continue-reading/route.ts`
- **GET**: `?childProfileId=xxx`
  - Auth check + child access validation
  - Query: most recent `child_book_progress` where `completedAt IS NULL` and `currentPage > 1`, ordered by `updatedAt DESC`, limit 1
  - Join with `books` for title, author, coverUrl, totalPages
  - Check `hasNarration` via pages
  - Response: `{ continueReading: { book: {...}, progress: {...} } }` or `{ continueReading: null }`

### 8. Implement Book Questions Route
- **Task ID**: implement-book-questions
- **Depends On**: add-schema-models
- **Assigned To**: routes-feature-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/app/api/books/[bookId]/questions/route.ts`
- **GET**: Return questions for a book
  - Query: `prisma.book_question.findMany({ where: { bookId }, orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } })`
  - Response: `{ questions: [{ id, bookId, questionText, questionType, sortOrder, options: [{ id, optionKey, optionText }] }] }`
  - Note: Do NOT expose `correctAnswer` in the response

### 9. Implement Comprehension Route
- **Task ID**: implement-comprehension
- **Depends On**: add-schema-models
- **Assigned To**: routes-feature-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- Create `src/app/api/comprehension/route.ts`
- **POST**: Submit comprehension answers
  - Auth check + child access validation
  - Validate: `childProfileId`, `bookId`, `answers[]` required
  - For each answer: look up `book_question` by `questionId`, compare `selectedAnswer` to `correctAnswer`, create `question_attempt`
  - Compute `totalQuestions`, `correctCount`, `scorePercent`
  - Response: `{ result: { bookId, childProfileId, totalQuestions, correctCount, scorePercent, submittedAt } }`

### 10. Implement Summary Reporting Route
- **Task ID**: implement-reporting
- **Depends On**: implement-reading-sessions, implement-comprehension
- **Assigned To**: routes-feature-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/app/api/reports/summary/route.ts`
- **GET**: `?childProfileId=xxx&range=30d`
  - Auth check + child access validation
  - Parse range (e.g., "7d", "30d", "90d") into date filter
  - Aggregate from `reading_session`: count sessions, sum durationSeconds, count distinct bookIds started
  - Aggregate from `child_book_progress`: count where completedAt within range
  - Aggregate from `question_attempt`: count attempts, avg isCorrect
  - Response: `{ summary: { childProfileId, range, booksStarted, booksCompleted, totalSessions, totalReadingMinutes, averageSessionMinutes, comprehensionAttempts, averageComprehensionScore } }`

### 11. Update Seed Data
- **Task ID**: update-seed-data
- **Depends On**: add-schema-models
- **Assigned To**: seed-builder
- **Agent Type**: general-purpose
- **Parallel**: true (can run alongside route tasks)
- Update `prisma/seed.ts` to add:
  - 2 sample child profiles linked to a test user
  - 3 sample reading sessions across different books
  - Sample `child_book_progress` entries (1 in-progress, 1 completed)
  - 3 sample `book_question` entries with options for one book
  - 2 sample `question_attempt` entries

### 12. Final Validation
- **Task ID**: validate-all
- **Depends On**: implement-child-profiles, update-reading-progress, implement-reading-sessions, update-books-listing, implement-continue-reading, implement-book-questions, implement-comprehension, implement-reporting, update-seed-data
- **Assigned To**: validator
- **Agent Type**: general-purpose
- **Parallel**: false
- Run `npx prisma generate` — verify schema compiles
- Run `npm run build` — verify all routes and types compile
- Verify each route file exists and exports the correct HTTP methods
- Cross-reference each route's request/response shape against `../storia-mobile/specs/proof-test/backend-api-contracts.md`
- Check that `correctAnswer` is NOT exposed in the questions GET endpoint
- Verify error responses follow the standard error shape: `{ error: { code, message, details? } }`
- Verify all BigInt bookId fields are properly serialized (toString) in JSON responses

## Acceptance Criteria
- [ ] 6 new Prisma models created with all fields, relations, and indexes
- [ ] Migration generated and applicable (`npx prisma migrate dev`)
- [ ] `src/lib/child-auth.ts` helper exists and is used by all child-aware routes
- [ ] `GET /api/child-profiles` returns child profiles for authenticated user
- [ ] `POST /api/child-profiles` creates a child profile with validation
- [ ] `GET /api/reading-progress?childProfileId=X&bookId=Y` returns child-aware progress
- [ ] `POST /api/reading-progress` accepts `childProfileId` and writes to `child_book_progress`
- [ ] `POST /api/reading-sessions` creates idempotent session records
- [ ] `GET /api/books?childProfileId=X` returns books with progress, hasNarration, hasQuestions
- [ ] `GET /api/continue-reading?childProfileId=X` returns most recent in-progress book
- [ ] `GET /api/books/[bookId]/questions` returns questions without exposing correct answers
- [ ] `POST /api/comprehension` scores and persists answers
- [ ] `GET /api/reports/summary?childProfileId=X&range=30d` returns aggregated stats
- [ ] Existing web-facing reading progress (no childProfileId) still works (backward compat)
- [ ] All routes use standard error shapes from the API contracts spec
- [ ] `npm run build` passes with no type errors
- [ ] Seed data includes sample child profiles, sessions, questions, and attempts

## Validation Commands
Execute these commands to validate the task is complete:

- `npx prisma generate` — Verify schema compiles
- `npx prisma migrate dev --name add_proof_test_models` — Generate and apply migration
- `npm run build` — Verify full project builds (runs prisma generate + next build)
- `grep -r "child_profile" prisma/schema.prisma` — Confirm model exists
- `grep -r "reading_session" prisma/schema.prisma` — Confirm model exists
- `ls src/app/api/child-profiles/route.ts src/app/api/reading-sessions/route.ts src/app/api/continue-reading/route.ts src/app/api/comprehension/route.ts src/app/api/reports/summary/route.ts src/app/api/books/*/questions/route.ts src/lib/child-auth.ts` — Confirm all new files exist

## Notes
- The `books` model uses `BigInt` IDs (legacy Elixir schema). All routes must convert `bookId` to `BigInt` when querying and `toString()` when serializing to JSON.
- Better Auth uses `user.id` as a `String` (cuid). The new models use String FKs to `user.id`.
- The existing `user_reading_progress` model should NOT be deleted — it continues to serve the web reader. The new `child_book_progress` model is parallel, child-centric storage.
- The `reading_session` model's `sessionId` is client-generated (Flutter creates a UUID). The `id` field is the server-side cuid. Upsert by `sessionId` for idempotency.
- `entryIntent` values are `"standard"` and `"autoplay_narration"` — these map to the Play/Read buttons in the Flutter library preview.
- PostHog analytics integration is out of scope for this plan — it will be a separate plan.
- The `correctAnswer` field on `book_question` must NEVER be returned to the client in the questions GET endpoint. It is only used server-side when scoring comprehension submissions.

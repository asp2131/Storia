# In-Book Questions — Phased Implementation Plan and Decision Log

## Goal
Ship book-attached comprehension questions that are authored in the Storia book editor, exposed through the existing backend contracts, and consumable by the mobile app as a gentle post-completion flow.

## Scope
This plan covers:
- question schema and storage assumptions
- admin/editor authoring requirements
- authoring APIs and read/submit paths
- validation and testing
- release sequencing

This plan assumes the current proof-test backend work is the source of truth for storage and API shape, and the current mobile direction is **end-of-book questions**, not inline/page-level questions.

---

## Confirmed product and architecture decisions

### Decision 1 — Questions are book-level, not page-anchored
Questions are attached to a book and shown after the reader finishes the story.

**Why:**
- matches current schema: `book_question`, `book_question_option`, `question_attempt`
- matches mobile UX direction: questions happen after celebration/completion handoff
- keeps MVP small and avoids page-anchor/editor complexity

**Consequence:**
- no page ID, paragraph anchor, or inline render position is required in MVP
- editor should add a dedicated **Questions** area, separate from page editing

### Decision 2 — MVP question type is multiple choice
The first shipped authoring and runtime flow should support `multiple_choice` only.

**Why:**
- already reflected in schema and mobile/API contracts
- lowest-risk format for child-friendly tap targets and deterministic server scoring

**Consequence:**
- editor can enforce exactly one correct option
- validation can be strict and simple

### Decision 3 — Questions are hidden-answer read models + server-side scoring
Clients fetch prompts/options only. Correct answers stay server-side and are used only by `POST /api/comprehension`.

**Why:**
- already implemented in backend read path
- protects answer integrity and future analytics/reporting

### Decision 4 — Authoring should optimize for short, child-friendly end matter
Question sets should remain small and easy to complete after finishing a book.

**Why:**
- aligns with mobile’s low-pressure post-read flow
- reduces fatigue and increases completion rate

**Consequence:**
- editor should strongly guide toward short sets, concise prompts, and simple options

---

## Working data model

### Existing backend entities
- `book_question`
  - `bookId`
  - `questionText`
  - `questionType`
  - `sortOrder`
  - `correctAnswer`
  - `metadata`
- `book_question_option`
  - `questionId`
  - `optionKey`
  - `optionText`
  - `sortOrder`
- `question_attempt`
  - `userId`
  - `childProfileId`
  - `bookId`
  - `questionId`
  - `readingSessionId?`
  - `selectedAnswer`
  - `isCorrect`
  - `answeredAt`

### Authoring assumptions the editor must satisfy
For each question, the editor must persist:
- stable question ID
- ordered `sortOrder`
- `questionText`
- `questionType = multiple_choice`
- ordered options with stable IDs/keys
- exactly one correct option mapped to `correctAnswer`

### Recommended authoring constraints for MVP
- 1–5 questions per book recommended
- 2–4 options per question
- one correct answer only
- concise prompt and option text
- no raw freeform metadata editing in MVP; use controlled fields only

---

## Phased implementation plan

## Phase 0 — Contract lock and editorial decisions
**Objective:** confirm the MVP boundaries before building editor workflows.

### Deliverables
- approved question-authoring scope for MVP
- final editor information architecture
- final validation rules and publishing policy
- canonical shared examples for API payloads and editor preview

### Dependencies
- proof-test backend schema/routes spec
- mobile end-of-book flow assumptions
- current public editor hardening roadmap

### Key decisions to lock in
- maximum recommended question count shown to authors
- whether `questionCount` should be derived in book list responses now or later
- whether questions can be saved on draft books only, or also edited post-publish with republish required
- whether deletion is hard delete or soft archive in editor UX

### Acceptance criteria
- all teams agree questions are book-level and end-of-book only for MVP
- editor tab structure and save/publish behavior are documented
- backend/mobile/editor all align on one request/response example set

---

## Phase 1 — Backend readiness and admin storage foundation
**Objective:** ensure backend storage and runtime contracts are stable enough for editor integration.

### Deliverables
- schema models and migrations for questions/options/attempts
- seed data for test books with questions
- stable read and submit routes
- `hasQuestions` book discovery flag

### Backend scope
1. Confirm `book_question`, `book_question_option`, `question_attempt` migration is applied.
2. Confirm `GET /api/books/:bookId/questions` returns:
   - ordered questions
   - ordered options
   - no `correctAnswer`
3. Confirm `POST /api/comprehension`:
   - validates `childProfileId`, `bookId`, `answers[]`
   - scores server-side
   - writes `question_attempt`
   - returns summary result
4. Confirm `GET /api/books` exposes `hasQuestions` consistently.

### Dependencies
- Prisma migration already in place
- child access validation helper
- representative seed or fixture content

### Acceptance criteria
- questions endpoint returns correct ordered payload without leaking answers
- comprehension endpoint persists attempts and scores correctly
- books endpoint returns `hasQuestions` for books with authored questions
- backend test fixtures exist for at least one book with multiple questions/options

### Notes for later phases
This phase enables editor preview and mobile integration, but does **not** by itself provide authoring APIs.

---

## Phase 2 — Admin authoring APIs for the book editor
**Objective:** add the write path the editor needs to create, edit, reorder, duplicate, and remove questions.

### Deliverables
Add dedicated admin/editor routes or mutations for question authoring.

### Required editor-facing operations
- list questions for a book, including authoring-only fields
- create question
- update question text/type/order
- add option
- update option text/key/order
- set correct option
- reorder questions
- reorder options
- duplicate question
- delete/archive question
- validate question set for publish readiness

### Recommended API surface
A practical MVP could use either:
- a small REST set under `/api/admin/books/[id]/questions`, or
- one bulk save endpoint plus reorder/delete mutations

Recommended minimum shape:
- `GET /api/admin/books/:bookId/questions`
- `POST /api/admin/books/:bookId/questions`
- `PATCH /api/admin/books/:bookId/questions/:questionId`
- `DELETE /api/admin/books/:bookId/questions/:questionId`
- `POST /api/admin/books/:bookId/questions/:questionId/duplicate`
- `POST /api/admin/books/:bookId/questions/reorder`

If options are managed independently:
- `POST /api/admin/books/:bookId/questions/:questionId/options`
- `PATCH /api/admin/books/:bookId/questions/:questionId/options/:optionId`
- `DELETE /api/admin/books/:bookId/questions/:questionId/options/:optionId`
- `POST /api/admin/books/:bookId/questions/:questionId/options/reorder`

### Non-functional requirements for authoring APIs
- protected by admin/ownership auth like the rest of the editor hardening work
- transactional writes for reorder/save operations
- stable IDs preserved across edits
- deterministic sort order normalization
- standard validation error shape for inline editor errors
- publish-readiness validation callable without publishing

### Dependencies
- Phase 1 backend readiness
- admin route protection and ownership model from public editor improvements

### Acceptance criteria
- editor can fully author a question set without direct database access
- save operations preserve stable question/option IDs
- reorder operations do not create duplicate or sparse `sortOrder` conflicts
- invalid states return field-level errors the UI can render

---

## Phase 3 — Book editor UX implementation
**Objective:** make question authoring practical, safe, and publish-aware in the web editor.

### Deliverables
A dedicated **Questions** tab in the book editor.

### Required information architecture
Top-level editor navigation should include:
- `Content`
- `Audio`
- `Questions`
- `Publish`

### Required Questions tab sections
1. **Question list / outline**
2. **Question editor form**
3. **Validation panel**
4. **Reader preview**
5. **Publish readiness state**

### Core workflows
Authors must be able to:
1. create a question
2. edit prompt text
3. add/remove/reorder options
4. mark exactly one correct option
5. reorder questions
6. duplicate a question
7. delete/archive a question
8. preview the mobile-style end-of-book flow
9. save draft changes without publishing

### Editor guardrails
- warn when question count exceeds recommended mobile-friendly range
- prevent publish when required fields are missing
- prevent multiple correct answers
- prevent zero correct answers
- prevent duplicate `optionKey` values within a question
- show explicit unsaved changes state
- support cancel/revert before publish

### Recommended validation rules
Per question:
- prompt required
- `questionType` required and limited to supported types
- minimum 2 options
- exactly 1 correct option
- no empty option text
- unique option keys
- contiguous sort order after reorder

At book level:
- all questions valid before publish
- no orphaned options
- preview reflects published order

### Non-functional requirements
- keyboard-friendly reorder/edit flow for internal users
- optimistic but recoverable saves
- no data loss on tab switching or page navigation
- clear draft vs published state
- responsive enough for desktop editing of long books
- auditability of who changed question content if public authoring is planned later

### Dependencies
- Phase 2 authoring APIs
- editor auth/ownership hardening
- existing publish flow integration

### Acceptance criteria
- a user can author a complete question set entirely inside the editor
- validation status is visible without publishing
- preview matches the runtime question order and answer presentation
- publish flow blocks invalid question sets with actionable errors

---

## Phase 4 — Reader/mobile read path integration
**Objective:** connect authored questions to the post-completion experience without interrupting reading.

### Deliverables
- completion handoff aware of `hasQuestions`
- reader/mobile fetch path for questions
- question submission path tied to child profile and ideally reading session
- optional question availability hint in library surfaces later

### Runtime flow
1. child finishes final page
2. celebration completes
3. reader checks whether the book has questions
4. if yes, show a gentle handoff such as `Quick questions`
5. fetch `GET /api/books/:bookId/questions`
6. render one-question-at-a-time flow
7. submit answers via `POST /api/comprehension`
8. show friendly summary

### Dependencies
- Phase 1 runtime endpoints
- Phase 3 editor authoring so content exists
- mobile completion handoff implementation

### Acceptance criteria
- authored questions appear in runtime in the same order as editor preview
- completion flow remains optional and child-friendly
- submission payload includes `childProfileId`, `bookId`, and `readingSessionId` when available
- library/read surfaces can detect question availability via `hasQuestions`

---

## Phase 5 — Publish, QA, and operational release
**Objective:** ship safely with validation, analytics readiness, and a controlled rollout.

### Deliverables
- question-specific publish checklist
- test coverage across schema/API/editor/runtime
- seeded QA content
- rollout and rollback plan

### Release sequence
1. deploy schema and runtime read/submit routes
2. deploy authoring APIs behind admin/editor access only
3. deploy editor Questions tab to internal users
4. QA authored content end-to-end with seed books
5. enable mobile/web runtime handoff for books with questions
6. optionally surface `Questions at the end` chips after core flow is stable

### Acceptance criteria
- no published book exposes `correctAnswer` in client responses
- invalid editor content cannot be published
- end-to-end flow works from authored draft to attempt persistence
- rollback path exists: disable question handoff while retaining authored data

---

## Milestones

## Milestone A — Backend contract complete
**Done when:**
- question schema exists
- read/submit routes are stable
- `hasQuestions` works
- seed data exists

## Milestone B — Editor write path complete
**Done when:**
- admin authoring APIs exist
- full CRUD + reorder + validation work
- IDs and order are stable

## Milestone C — Editor UX complete
**Done when:**
- Questions tab ships internally
- preview and publish-readiness checks work
- invalid sets are blocked from publish

## Milestone D — Runtime integration complete
**Done when:**
- reader completion can branch into questions
- one-question-per-screen flow works
- results submit and summary returns

## Milestone E — Release complete
**Done when:**
- QA signoff achieved
- rollout guardrails documented
- support docs/training for editors exist

---

## Dependency map

### Hard dependencies
- editor authoring depends on question schema and secure write APIs
- mobile/runtime integration depends on authored content existing and runtime read/submit routes being stable
- public/editor rollout depends on auth/ownership hardening of admin/editor APIs

### Cross-team dependencies
- **Backend**: schema, authoring APIs, runtime contracts, validation behavior
- **Editor/Web**: Questions tab, preview, draft/publish integration, inline validation UX
- **Mobile**: completion handoff, question flow UI, submission wiring, optional question chip later
- **QA**: fixture books, end-to-end test cases, regression coverage for publish/read flows

---

## Testing strategy

## 1. Schema and persistence tests
Verify:
- question/order relations save correctly
- option reorder preserves correct-answer mapping
- attempt writes link to child/book/question/session correctly

## 2. API contract tests
Verify:
- `GET /api/books/:bookId/questions` returns ordered questions/options
- `correctAnswer` is absent from client response
- `POST /api/comprehension` scores correctly for mixed right/wrong answers
- invalid payloads return structured validation errors

## 3. Editor integration tests
Verify:
- create/edit/delete/duplicate/reorder workflows
- publish blocking on invalid content
- preview matches saved order
- unsaved-change handling on navigation

## 4. Runtime/mobile integration tests
Verify:
- `hasQuestions` correctly drives completion handoff visibility
- question flow shows one item at a time
- answer submission includes required identifiers
- result summary matches backend scoring

## 5. Regression tests
Verify:
- books without questions still complete normally
- reopening and rereading a completed book still works
- legacy reader/library paths do not break when no question content exists

---

## Decision log

### Locked decisions
1. **Use book-level end-of-book questions for MVP.**
   - Rejected for MVP: inline or page-anchored questions.
2. **Ship multiple choice first.**
   - Rejected for MVP: free response, multi-select, hotspot, page-tied prompts.
3. **Keep correct answers server-side only.**
   - Rejected: exposing correctness data in read payloads.
4. **Treat questions as optional post-completion content.**
   - Rejected: interrupting the reader mid-book.
5. **Add a dedicated Questions tab in the editor.**
   - Rejected: embedding question fields inside page/audio panels.

### Open decisions
1. **Authoring API shape**
   - Bulk save endpoint vs granular CRUD routes.
2. **Question count metadata**
   - Should books list also return `questionCount`, or keep only `hasQuestions` for now?
3. **Draft/publish behavior**
   - Can published books receive question edits immediately, or must edits remain draft until republish?
4. **Delete semantics**
   - Hard delete from authoring tables vs soft archive for audit/history.
5. **Versioning**
   - Should attempts always score against the latest published question set, or should published question revisions be snapshotted later?
6. **Editor audience**
   - Internal admins only first, or public authors later? This affects auth, quotas, moderation, and audit requirements.
7. **Metadata usage**
   - Is `metadata` needed in MVP at all, and if so, which controlled fields belong there?
8. **Reading session linkage**
   - Is `readingSessionId` required whenever questions are answered immediately after completion, or only optional for resilience/offline sync?

---

## Recommended next implementation order
1. Lock open product decisions that affect editor UX and publish rules.
2. Finish or verify backend runtime contracts and fixtures.
3. Add secure admin authoring APIs for question CRUD/reorder/validation.
4. Implement the editor Questions tab and preview.
5. Add end-of-book runtime integration and submission flow.
6. Run end-to-end QA with seeded books, then release behind controlled exposure.

---

## Final recommendation
Treat in-book questions as a **book-level, end-of-book capability** with a dedicated editor surface and strict publish validation. Build in this order:
- backend/runtime contract stability
- secure authoring APIs
- editor Questions tab with preview and readiness checks
- post-completion mobile/runtime flow
- QA and staged rollout

That sequence minimizes rework, matches the existing schema and mobile assumptions, and keeps the editor requirements explicit enough to ship without introducing page-anchor complexity too early.

# Plan: Dual-Stack Auth Remediation (Better Auth Web + Supabase Mobile)

## Task Description

Implement every fix called out in `specs/audits/dual-stack-auth-audit-2026-04-28.md` while staying compatible with the Flutter mobile client at `../storia-mobile/`. The audit identified seven findings spanning credential exposure, identity linking, missing authorization, dual-stack route adoption gaps, permissive bearer parsing, a reading-session ownership gap, and missing direct tests for the dual-stack helper. Remediate all of them in a single coordinated plan with explicit mobile compatibility validation, and structure the team so the agent definitions remain portable to a Pi (swarm) coding agent — i.e. every team member uses generic `general-purpose` agents differentiated only by name and role description, with no reliance on Claude-specific specialized agent types.

## Objective

When the plan completes:

1. `src/lib/child-auth.ts` is hardened: no public env fallback for service-role keys, verified-email-only Supabase linking, `Bearer`-scheme-only `Authorization` parsing.
2. Service-role fallback removed from every other server route that currently reads `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
3. `POST/PATCH/DELETE` on book question routes are gated by `requireAdmin()`.
4. `src/app/api/feedback/route.ts`, `src/app/api/feedback/status/route.ts`, and the parent-user branches of `src/app/api/reading-progress/route.ts` use `getAuthenticatedUser()` so mobile bearer auth works.
5. `src/app/api/reading-sessions/route.ts` verifies session ownership before update/upsert.
6. `src/lib/child-auth.test.ts` exists with the eight-case matrix from the audit, and existing route tests are updated to cover the new behaviors.
7. Mobile (`../storia-mobile/`) is regression-checked — every changed server contract is exercised against the mobile bearer flow, and no shipping mobile call site relies on the removed fallback paths.
8. Final reviewer + validator pass: typecheck clean, all unit and route tests pass, audit checklist fully ticked.

## Problem Statement

The dual-stack helper (`getAuthenticatedUser()`) is the trust boundary between web cookie auth and mobile bearer auth, and it currently has security and consistency defects: it falls back to a public env var for the service-role key, links Supabase identities to Better Auth users by unverified email, and accepts any non-empty `Authorization` header as a Supabase token. Several routes never even reach the helper — they call raw `auth.api.getSession()`, which silently breaks the mobile client. Two routes that are reachable (book-question mutations) lack admin authorization entirely. The reading-session upsert can mutate another user's row by guessed `sessionId`. None of these have direct tests, so regressions are invisible.

Because mobile is a separate Flutter app at `../storia-mobile/` with its own release cadence, every server-side change must be validated against the mobile bearer flow before merge. The mobile client confirms emails via OTP magic link or OAuth (Apple/Google), so verified-email gating is safe in principle, but must be confirmed with a mobile-compat sweep.

## Solution Approach

Sequence the work by risk: security hotfixes first (Findings 1, 2, 5), then authorization (Finding 3), then route consistency (Finding 4), then data integrity (Finding 6), then tests (Finding 7), with a dedicated mobile-compatibility validator running cross-cutting checks at the end and a final code review + automated validation gate. Findings 1/2/5 mutate the same file (`src/lib/child-auth.ts`) so they run sequentially as a single chain. Findings 3, 4, 6 touch disjoint files so they run in parallel after the security chain merges. Finding 7 (tests) lands last and depends on every prior fix.

For Finding 1, broaden the scope: the audit names only `child-auth.ts`, but `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is read in at least six other server files. Scrub all of them in the same task to prevent the same risk pattern from recurring elsewhere.

For Finding 2, require `supaUser.email` AND `supaUser.email_confirmed_at` before any email-based lookup. Defer the stronger long-term fix (explicit provider/account mapping) to a follow-up spec; document the deferral inline.

For Finding 5, accept only the case-insensitive `Bearer <token>` form on `Authorization`. Continue to accept the raw `x-supabase-access-token` header to preserve the existing mobile compatibility path.

For Finding 3, gate question mutation methods with `requireAdmin()` (already used by overlay/composite admin routes). `GET` stays public/dual-stack since reader and mobile both read questions.

For Finding 4, replace raw `auth.api.getSession()` calls with `getAuthenticatedUser()` in `feedback`, `feedback/status`, and the legacy parent-user branches of `reading-progress`.

For Finding 6, before updating an existing reading-session row, verify `existing.childProfileId === result.childProfile.id`. Optionally migrate to a composite unique key in a follow-up; the immediate fix is the ownership check.

For Finding 7, write `src/lib/child-auth.test.ts` covering the eight cases from the audit, and add route regression tests for the four modified route groups.

Team portability to Pi swarm: every task is assigned to a `general-purpose` agent. Names are role descriptors so a swarm scheduler can map them to whatever generic worker pool exists. No reliance on `feature-lead`, `infra-lead`, or other Claude-Code-only specialist types.

## Relevant Files

Use these files to complete the task:

- `specs/audits/dual-stack-auth-audit-2026-04-28.md` — source of truth for findings and recommended fixes.
- `src/lib/child-auth.ts` — primary target for Findings 1, 2, 5; also exposes `validateChildAccess`.
- `src/lib/auth.ts` — Better Auth wiring; consumed by `getAuthenticatedUser` cookie path.
- `src/lib/admin-auth.ts` — `requireAdmin()` helper used to gate Finding 3.
- `src/app/api/books/[id]/questions/route.ts` — Finding 3.
- `src/app/api/books/[id]/questions/[questionId]/route.ts` — Finding 3.
- `src/app/api/feedback/route.ts` — Finding 4.
- `src/app/api/feedback/status/route.ts` — Finding 4.
- `src/app/api/reading-progress/route.ts` — Finding 4 (legacy parent-user branches only).
- `src/app/api/reading-sessions/route.ts` — Finding 6.
- `src/app/api/admin/audio-assignments/route.ts` — Finding 1 sweep.
- `src/app/api/admin/audio-uploads/route.ts` — Finding 1 sweep.
- `src/app/api/admin/uploads/route.ts` — Finding 1 sweep.
- `src/app/api/admin/generate-narration/route.ts` — Finding 1 sweep.
- `src/app/api/admin/generate-overlay-narration/route.ts` — Finding 1 sweep.
- `src/app/api/admin/books/[id]/pronunciations/generate/route.ts` — Finding 1 sweep.
- `src/app/api/soundscapes/route.ts` — Finding 1 sweep (does not use the public fallback today, but verify and re-confirm).
- `../storia-mobile/lib/src/features/child/data/child_profile_repository.dart` — mobile bearer call site (read-only audit).
- `../storia-mobile/lib/src/data/analytics_repository.dart` — mobile bearer call site (read-only audit).
- `../storia-mobile/lib/src/features/auth/data/auth_repository.dart` — mobile auth flows (Apple, OTP, OAuth) — read-only audit to confirm `email_confirmed_at` is set on every shipping mobile sign-in path.
- `.wolf/cerebrum.md` — record the verified-email and bearer-scheme rules as Do-Not-Repeat entries when complete.
- `.wolf/buglog.json` — append a bug entry for each finding closed.

### New Files

- `src/lib/child-auth.test.ts` — direct unit tests for the dual-stack helper covering the eight-case matrix from the audit.
- `src/app/api/feedback/route.test.ts` — regression test that mobile bearer requests succeed (only if missing today; verify before creating).
- `src/app/api/reading-sessions/ownership.regression.test.ts` — regression test that update/upsert refuses to mutate a session owned by another child profile.

## Implementation Phases

### Phase 1: Security Hotfixes (sequential, all in `child-auth.ts` plus env sweep)

1. Remove the `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` fallback in `src/lib/child-auth.ts`. Sweep the other six routes that read the same fallback and remove it everywhere. Add a server-only assertion that throws on missing `SUPABASE_SERVICE_ROLE_KEY`. Document the env contract in the file header.
2. Require `supaUser.email && supaUser.email_confirmed_at` before any email-based lookup. Reject unverified Supabase identities with 401 and `code: "unauthorized"`. Keep the existing `id`-based lookup path to avoid breaking already-linked accounts.
3. Tighten bearer parsing: accept only case-insensitive `Bearer <token>` on `Authorization`. Keep raw token acceptance on `x-supabase-access-token` for the explicit compatibility header. Add a guard so a non-Bearer `Authorization` does not block the cookie fallback path.

### Phase 2: Authorization, Route Consistency, Data Integrity (parallel after Phase 1)

4. Gate `POST/PATCH/DELETE` in both question route files with `requireAdmin()`. `GET` remains as-is.
5. Replace raw `auth.api.getSession()` with `getAuthenticatedUser()` in `feedback`, `feedback/status`, and the legacy parent-user branches of `reading-progress`. Preserve existing response shapes for backwards compatibility.
6. In `reading-sessions/route.ts`, before update/upsert, verify the existing row's `childProfileId` matches `result.childProfile.id`. Return 403 if it does not.

### Phase 3: Tests (sequential after Phase 2)

7. Create `src/lib/child-auth.test.ts` covering the eight cases from the audit.
8. Update or add route tests for the routes touched in Phase 2.

### Phase 4: Mobile Compatibility, Review, Validation (sequential, gates the merge)

9. Mobile-compat audit against `../storia-mobile/`: verify every shipping bearer call uses `Bearer <token>`; verify Apple, OAuth, and OTP magic-link flows produce `email_confirmed_at`; verify no mobile call site depended on the public service-role fallback or on raw cookie auth.
10. Reviewer pass over the diff for security, dual-stack consistency, and test coverage of the audit checklist.
11. Validator runs the full validation command list; tick the audit's Remediation Checklist as each item lands.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to to the building, validating, testing, deploying, and other tasks.
  - This is critical. You're job is to act as a high level director of the team, not a builder.
  - You're role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

Portability note: every team member is assigned `Agent Type: general-purpose`. Names below are role descriptors only — a Pi swarm scheduler can map each name to any worker that can read/write code, run tests, and call shell commands. Do not introduce specialist agent types from `.claude/agents/team/*.md` (that directory does not exist in this project) because those types do not transfer to the Pi swarm.

### Team Members

- Builder
  - Name: security-builder
  - Role: Phase 1 — child-auth security hotfixes (Findings 1, 2, 5) and the multi-file `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` sweep.
  - Agent Type: general-purpose
  - Resume: true
- Builder
  - Name: authz-builder
  - Role: Phase 2 — admin-gate book-question mutation routes (Finding 3).
  - Agent Type: general-purpose
  - Resume: true
- Builder
  - Name: consistency-builder
  - Role: Phase 2 — replace raw Better Auth session reads in feedback and reading-progress legacy branches (Finding 4).
  - Agent Type: general-purpose
  - Resume: true
- Builder
  - Name: integrity-builder
  - Role: Phase 2 — reading-session upsert ownership check (Finding 6).
  - Agent Type: general-purpose
  - Resume: true
- Builder
  - Name: test-builder
  - Role: Phase 3 — write `src/lib/child-auth.test.ts` and update affected route tests (Finding 7).
  - Agent Type: general-purpose
  - Resume: true
- Validator
  - Name: mobile-compat-validator
  - Role: Phase 4 — read-only audit of `../storia-mobile/` to confirm bearer scheme, email-verified flows, and that no mobile call site depended on changed/removed behavior. Reports findings; does not modify mobile code.
  - Agent Type: general-purpose
  - Resume: false
- Reviewer
  - Name: dual-stack-reviewer
  - Role: Phase 4 — code review of all server diffs against the audit checklist. Flags anything missing.
  - Agent Type: general-purpose
  - Resume: false
- Validator
  - Name: final-validator
  - Role: Phase 4 — runs typecheck, vitest, lint; ticks remediation checklist; appends `.wolf/buglog.json` and updates `.wolf/cerebrum.md` Do-Not-Repeat with the verified-email and Bearer-scheme rules.
  - Agent Type: general-purpose
  - Resume: false

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Remove public service-role env fallback (Finding 1, full sweep)
- **Task ID**: sec-env-fallback
- **Depends On**: none
- **Assigned To**: security-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- In `src/lib/child-auth.ts`, drop the `process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` fallback. Read only `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- Sweep the same fallback out of: `src/app/api/admin/audio-assignments/route.ts`, `src/app/api/admin/uploads/route.ts`, `src/app/api/admin/generate-narration/route.ts`, `src/app/api/admin/generate-overlay-narration/route.ts`, `src/app/api/admin/books/[id]/pronunciations/generate/route.ts`. Re-grep `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` and remove every remaining server-side hit.
- Throw clearly when the server-only key is absent at first use; do not silently degrade to anonymous client.
- Add a one-line file-header comment in `child-auth.ts` documenting the env contract.
- Ensure `npx tsc --noEmit` and `npx vitest run` both pass.

### 2. Require verified Supabase email before linking (Finding 2)
- **Task ID**: sec-verified-email
- **Depends On**: sec-env-fallback
- **Assigned To**: security-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- In `resolveBySupabaseToken`, after `getSupabaseAdmin().auth.getUser(token)` resolves, require `supaUser.email` AND `supaUser.email_confirmed_at`. If either is missing, return 401 with `code: "unauthorized"` and a clear log line.
- Keep the `prisma.user.findUnique({ where: { id: supabaseId } })` path intact so already-linked accounts continue to work.
- Only run the email-based lookup branch when the email is verified.
- Add inline doc comment noting the long-term plan to migrate to explicit provider/account mapping; link to a follow-up spec stub if one exists, otherwise note it in `specs/`.

### 3. Tighten Authorization parsing to Bearer scheme only (Finding 5)
- **Task ID**: sec-bearer-parsing
- **Depends On**: sec-verified-email
- **Assigned To**: security-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- Replace `extractBearer` so the `Authorization` header only matches `^bearer\s+(.+)$` case-insensitively; return null otherwise.
- Keep the raw-token path on `x-supabase-access-token` only.
- Confirm a non-Bearer `Authorization` header (for example `Basic …`) falls through to the Better Auth cookie path instead of returning 401.

### 4. Admin-gate book-question mutations (Finding 3)
- **Task ID**: authz-question-mutations
- **Depends On**: sec-bearer-parsing
- **Assigned To**: authz-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- In `src/app/api/books/[id]/questions/route.ts` and `src/app/api/books/[id]/questions/[questionId]/route.ts`, gate `POST`, `PATCH`, and `DELETE` with `await requireAdmin()`; bail with the returned `NextResponse` when not an admin.
- Leave `GET` handlers untouched (public/mobile read).
- Update existing route tests to assert 401 for unauthenticated, 403 (or the existing forbidden shape) for non-admin authenticated, and 200/201 for admin.

### 5. Dual-stack-ify feedback and legacy reading-progress (Finding 4)
- **Task ID**: consistency-routes
- **Depends On**: sec-bearer-parsing
- **Assigned To**: consistency-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- In `src/app/api/feedback/route.ts` and `src/app/api/feedback/status/route.ts`, swap raw `auth.api.getSession()` for `getAuthenticatedUser()`. Preserve response shapes.
- In `src/app/api/reading-progress/route.ts`, replace the raw session reads in the parent-user GET and POST branches (the `if (!childProfileId)` paths) with `getAuthenticatedUser()`. Keep the existing child branch unchanged.
- Verify that returning the existing `null` shape for a missing/unauthenticated parent-user GET stays unchanged; only the 401 path becomes consistent.

### 6. Reading-session ownership check (Finding 6)
- **Task ID**: integrity-reading-sessions
- **Depends On**: sec-bearer-parsing
- **Assigned To**: integrity-builder
- **Agent Type**: general-purpose
- **Parallel**: true
- In `src/app/api/reading-sessions/route.ts`, before any update of an existing row keyed by `sessionId`, look up the existing row and verify `existing.childProfileId === validatedChildProfile.id`. Return 403 with `code: "forbidden"` if not.
- Add a brief comment noting the prefer-composite-unique-key follow-up.
- Add a regression test (`reading-sessions/ownership.regression.test.ts` or extend the existing test file) that simulates a foreign `sessionId` and asserts 403.

### 7. Direct child-auth helper tests (Finding 7)
- **Task ID**: tests-child-auth
- **Depends On**: sec-env-fallback, sec-verified-email, sec-bearer-parsing
- **Assigned To**: test-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- Create `src/lib/child-auth.test.ts` covering the eight cases from the audit:
  1. No bearer + valid Better Auth session returns the database user.
  2. `Authorization: Bearer <valid>` calls Supabase `auth.getUser()` and resolves the mapped DB user.
  3. `x-supabase-access-token` works for the compatibility header.
  4. Invalid bearer returns 401.
  5. Non-bearer `Authorization` (e.g. `Basic abc`) does not suppress valid cookie auth — cookie path resolves.
  6. Unverified Supabase email does not link to an existing Better Auth user — returns 401.
  7. `validateChildAccess()` returns 403 for a child profile owned by another user.
  8. `validateChildAccess()` returns `{ user, childProfile }` for an owned child profile.
- Mock `@/lib/prisma`, `@supabase/supabase-js`, and `@/lib/auth` at module boundaries to keep the test hermetic.

### 8. Route regression tests (Finding 7 routes)
- **Task ID**: tests-routes
- **Depends On**: authz-question-mutations, consistency-routes, integrity-reading-sessions, tests-child-auth
- **Assigned To**: test-builder
- **Agent Type**: general-purpose
- **Parallel**: false
- Update `src/app/api/reading-progress/route.test.ts` to cover bearer-token mobile flow on parent-user branches.
- Add or update tests for `feedback/route.test.ts`, `feedback/status/route.test.ts`, and the question mutation routes for admin-only behavior.
- Add the reading-session ownership regression test from task 6 if not already in place.

### 9. Mobile compatibility audit (read-only)
- **Task ID**: mobile-compat
- **Depends On**: tests-routes
- **Assigned To**: mobile-compat-validator
- **Agent Type**: general-purpose
- **Parallel**: false
- Read `../storia-mobile/lib/src/features/auth/data/auth_repository.dart` and confirm Apple, Google OAuth, and OTP magic-link flows all surface a Supabase session with `email_confirmed_at` set on first sign-in. Note any flow that does not.
- Grep `../storia-mobile/lib/` for `'authorization'` and `'Bearer'` and confirm every occurrence sends `Bearer ${accessToken}`.
- Confirm no mobile call site depends on the changed parent-user routes' previous 401 shape.
- Confirm mobile never reads a `NEXT_PUBLIC_*` service-role key (it should not — it is a Flutter app — but verify by grep).
- Produce a one-page report at `specs/mobile-compat-dual-stack-2026-04-28.md` summarizing each verification with file/line references. Do not edit mobile source.

### 10. Final code review
- **Task ID**: final-review
- **Depends On**: mobile-compat
- **Assigned To**: dual-stack-reviewer
- **Agent Type**: general-purpose
- **Parallel**: false
- Diff every changed server file against the audit's Remediation Checklist. Each unticked item must have a clear reason or a follow-up task.
- Verify error response shapes are consistent (`{ error: { code, message } }` with proper status).
- Verify nothing else in the diff was changed beyond the audit scope.
- Report any blockers; if any, route back to the appropriate builder via `Task` resume.

### 11. Validate and close
- **Task ID**: validate-all
- **Depends On**: final-review
- **Assigned To**: final-validator
- **Agent Type**: general-purpose
- **Parallel**: false
- Run all validation commands (see below); paste the summary into the task report.
- Tick every item in `specs/audits/dual-stack-auth-audit-2026-04-28.md` Remediation Checklist.
- Append a bug entry to `.wolf/buglog.json` for each finding closed (one entry per finding for traceability).
- Update `.wolf/cerebrum.md` Do-Not-Repeat with: (a) "Do not gate web-facing API routes on Supabase bearer alone" (already added in bug-130), (b) "Do not link Supabase identities to Better Auth users without `email_confirmed_at`", (c) "Do not accept non-Bearer `Authorization` as a Supabase token", (d) "Do not read service-role keys from `NEXT_PUBLIC_*` env vars".

## Acceptance Criteria

- `src/lib/child-auth.ts` reads only `process.env.SUPABASE_SERVICE_ROLE_KEY`. No file under `src/` references `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Supabase users without `email_confirmed_at` cannot link to or create Better Auth user rows; their requests return 401.
- `Authorization` headers that are not the `Bearer` scheme do not suppress the Better Auth cookie path; the cookie path still resolves the user.
- `POST/PATCH/DELETE` on `/api/books/[id]/questions` and `/api/books/[id]/questions/[questionId]` return 401 for unauthenticated and the existing forbidden status for non-admin authenticated; only admin requests succeed. `GET` is unchanged.
- `/api/feedback`, `/api/feedback/status`, and the parent-user branches of `/api/reading-progress` accept Supabase bearer tokens from mobile and Better Auth cookies from web.
- `/api/reading-sessions` rejects update/upsert attempts whose existing row's `childProfileId` does not match the authenticated child profile.
- `src/lib/child-auth.test.ts` exists with the eight-case matrix; all eight pass.
- `npx tsc --noEmit` exits 0; `npx vitest run` reports all tests passing; `npx eslint .` clean.
- `specs/mobile-compat-dual-stack-2026-04-28.md` exists with the mobile-compat report.
- `specs/audits/dual-stack-auth-audit-2026-04-28.md` Remediation Checklist is fully ticked.
- `.wolf/buglog.json` and `.wolf/cerebrum.md` updated as described.

## Validation Commands

Execute these commands to validate the task is complete:

- `npx tsc --noEmit -p tsconfig.json` — typecheck must be clean.
- `npx vitest run` — full unit and route test suite must pass.
- `npx vitest run src/lib/child-auth.test.ts` — direct helper tests must pass.
- `npx vitest run src/app/api/child-profiles src/app/api/reading-progress src/app/api/reading-sessions src/app/api/feedback src/app/api/books src/app/api/reports` — route-test sweep across affected groups.
- `npx eslint .` — lint must be clean.
- `rg -n "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" src` — must return no results.
- `rg -n "auth\.api\.getSession" src/app/api` — every remaining hit must be an admin-only route or otherwise documented as web-only.
- `rg -n "extractBearer" src/lib/child-auth.ts` — confirm only Bearer scheme is accepted.
- `rg -n "'authorization'" ../storia-mobile/lib` — confirm every value is `Bearer ${...}` (mobile-compat-validator output).

## Notes

- The audit's stronger long-term fix for Finding 2 (explicit provider/account mapping) is intentionally deferred. Capture it as a follow-up spec stub at `specs/auth-provider-account-mapping-followup.md` when sec-verified-email lands; do not implement in this plan.
- `src/lib/auth.ts` lines 35-36 currently hardcode `host: "127.0.0.1", port: 5433` in the Better Auth `pg.Pool`. This is out of scope for this plan but is a likely separate prod risk; flag it in the final review report so it can be triaged.
- All builder tasks must run `npx tsc --noEmit` and the relevant `npx vitest run <file>` locally before marking complete; final-validator runs the full sweep.
- Mobile is read-only in this plan. If the mobile-compat report finds a mobile-side gap (for example a flow that does not produce `email_confirmed_at`), open a follow-up task in `../storia-mobile/specs/` rather than editing mobile in this plan.
- Pi-swarm portability: all eight team members use `Agent Type: general-purpose`. Names are role descriptors. A swarm scheduler that supports a single generic worker class can execute this plan unchanged by mapping each name to a worker.

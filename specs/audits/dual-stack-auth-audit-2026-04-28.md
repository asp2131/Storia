# Dual-Stack Auth Audit — Better Auth Web + Supabase Mobile

**Date:** 2026-04-28  
**Status:** Ship-blocking issues found  
**Scope:** `src/lib/child-auth.ts`, child-aware API routes, parent-user API routes, Better Auth usage, Supabase bearer verification, and related route tests.

## Context

Storia currently uses a dual-stack authentication model:

- **Web:** Better Auth cookie sessions via `useSession` from `@/lib/auth-client`.
- **Mobile:** Supabase access tokens sent as bearer tokens in the `authorization` header.
- **Server helper:** `getAuthenticatedUser()` in `src/lib/child-auth.ts` resolves both stacks:
  - bearer token present → Supabase verification path
  - otherwise → Better Auth `auth.api.getSession({ headers })` path
- **Child authorization:** routes that need a child profile should call `validateChildAccess(childProfileId)`.

Any new web/mobile-facing route that needs the parent user should use `getAuthenticatedUser()` / `validateChildAccess()` unless it is intentionally Better-Auth-only, such as admin-only web routes.

## Overall Verdict

The implementation is **directionally correct but not ready to ship**.

The newer child-aware routes mostly use the shared helper correctly, but the audit found:

1. A public env var fallback for the Supabase service-role key.
2. Unsafe Supabase-to-Better-Auth account linking by email.
3. Book-question mutation routes that are authenticated but not admin-authorized.
4. Remaining routes that still use raw Better Auth sessions and therefore fail mobile bearer auth.
5. Permissive bearer parsing that can suppress valid cookie auth.
6. A reading-session upsert ownership gap.
7. Missing direct tests for the dual-stack helper.

## Findings

### Finding 1 — Public service-role key fallback

**Severity:** High  
**Location:** `src/lib/child-auth.ts`

`SUPABASE_SERVICE_ROLE_KEY` falls back to `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

**Risk:** Supabase service-role keys bypass RLS and must never be exposed through public-prefixed env vars. If a `NEXT_PUBLIC_*` service-role key exists in any environment, it can be accidentally bundled or exposed elsewhere.

**Recommended fix:**

- Remove the `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` fallback.
- Only read `process.env.SUPABASE_SERVICE_ROLE_KEY` server-side.
- Audit deployment environment variables and delete any `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` entries.

---

### Finding 2 — Email-only account linking across auth stacks

**Severity:** High  
**Location:** `src/lib/child-auth.ts`

The Supabase path resolves a Supabase user and then links to an existing Better Auth `user` row by matching email. It records `emailVerified`, but it does not require verified email before linking.

**Risk:** If Supabase can issue a session for an unverified email, a mobile auth identity could inherit an existing Better Auth account's children, reports, progress, feedback, and role by matching the victim's email.

**Recommended fix:**

Minimum acceptable fix:

- Require `supaUser.email` and `supaUser.email_confirmed_at` before any email-based lookup/link.
- Reject unverified Supabase identities with 401.

Stronger long-term fix:

- Add explicit auth-provider identity mapping, e.g. provider `supabase` + provider account id `supaUser.id`.
- Only link by email in an explicit account-linking flow after both identities prove ownership.

---

### Finding 3 — Question mutation endpoints are not admin-authorized

**Severity:** High  
**Locations:**

- `src/app/api/books/[id]/questions/route.ts`
- `src/app/api/books/[id]/questions/[questionId]/route.ts`

`POST`, `PATCH`, and `DELETE` use `getAuthenticatedUser()` but do not require admin rights or book ownership.

**Risk:** Any authenticated parent/mobile user can create, edit, or delete global comprehension questions for any book.

**Recommended fix:**

- Gate these mutation methods with `requireAdmin()` from `src/lib/admin-auth.ts`, or introduce an explicit book-owner/editor authorization check.
- Keep public/mobile `GET` read behavior separate from admin mutation behavior.

---

### Finding 4 — Incomplete dual-stack route adoption

**Severity:** Medium  
**Locations:**

- `src/app/api/reading-progress/route.ts` legacy parent-user GET/POST branches
- `src/app/api/feedback/route.ts`
- `src/app/api/feedback/status/route.ts`

These routes still call raw `auth.api.getSession()` / `getAuth().api.getSession()` instead of `getAuthenticatedUser()`.

**Risk:** Web cookie users work, but Supabase bearer users are treated as unauthenticated. This violates the stated dual-stack route rule for parent-user routes.

**Recommended fix:**

- Replace raw Better Auth session reads with `getAuthenticatedUser()` where mobile should be supported.
- If a route is intentionally web-only, document the exception in the route and in this audit/spec folder.

---

### Finding 5 — Bearer parsing is too permissive

**Severity:** Medium  
**Location:** `src/lib/child-auth.ts`

The helper treats any non-empty `Authorization` header as a Supabase token, not only `Bearer <token>`.

**Risk:** A request with valid Better Auth cookies plus an unrelated `Authorization` header such as `Basic ...` will be forced down the Supabase path and can fail with 401 instead of falling back to cookie auth.

**Recommended fix:**

- For `authorization`, only accept the case-insensitive `Bearer <token>` form.
- Keep raw token acceptance only for the explicit `x-supabase-access-token` header if that compatibility path is needed.

---

### Finding 6 — Reading-session upsert ownership gap

**Severity:** Medium  
**Location:** `src/app/api/reading-sessions/route.ts`

The route validates access to the submitted `childProfileId`, but its upsert update path is keyed only by global `sessionId`.

**Risk:** If another user's `sessionId` is guessed, leaked, or reused, the update branch can mutate that existing reading session without confirming it belongs to the authenticated user/child.

**Recommended fix:**

- Before updating an existing `sessionId`, verify `existing.childProfileId === result.childProfile.id` and/or `existing.userId === result.user.id`.
- Prefer a composite unique key such as `(childProfileId, sessionId)` or `(userId, sessionId)` if product semantics allow it.

---

### Finding 7 — Missing direct tests for `child-auth`

**Severity:** Medium  
**Location:** tests around `src/lib/child-auth.ts`

Route tests generally mock `@/lib/child-auth`, so they do not verify the real dual-stack behavior.

**Risk:** The exact production behavior this helper is supposed to protect can regress without test failures.

**Recommended tests:**

Create `src/lib/child-auth.test.ts` covering:

1. No bearer + valid Better Auth session returns the database user.
2. `Authorization: Bearer <valid>` calls Supabase `auth.getUser()` and resolves the mapped DB user.
3. `x-supabase-access-token` works if the compatibility header is retained.
4. Invalid bearer returns 401.
5. Non-bearer `Authorization` does not suppress valid cookie auth.
6. Unverified Supabase email does not link to an existing Better Auth user.
7. `validateChildAccess()` returns 403 for a child profile owned by another user.
8. `validateChildAccess()` returns `{ user, childProfile }` for an owned child profile.

Also update affected route tests after replacing raw session calls:

- `src/app/api/reading-progress/route.test.ts`
- feedback route tests if added/retained
- question mutation route tests for admin-only behavior
- reading-session ownership regression tests

## Route Adoption Snapshot

### Correctly using shared helper for child-aware flows

- `src/app/api/child-profiles/route.ts`
- `src/app/api/reports/summary/route.ts`
- `src/app/api/reports/analytics/route.ts`
- `src/app/api/analytics/events/route.ts`
- `src/app/api/continue-reading/route.ts`
- `src/app/api/comprehension/route.ts`
- child branches of `src/app/api/reading-progress/route.ts`
- `src/app/api/reading-sessions/route.ts` for child access validation, with the session-id ownership caveat above

### Needs dual-stack cleanup or explicit web-only documentation

- `src/app/api/reading-progress/route.ts` parent-user branches
- `src/app/api/feedback/route.ts`
- `src/app/api/feedback/status/route.ts`

### Needs stronger authorization, not just dual-stack auth

- `src/app/api/books/[id]/questions/route.ts` mutation methods
- `src/app/api/books/[id]/questions/[questionId]/route.ts` mutation methods

## Remediation Checklist

- [x] Remove `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` fallback.
- [x] Verify deployment envs do not contain public service-role keys. *(Repo/mobile source grep is clean for `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`; actual hosted deployment envs still require out-of-band ops verification. Mobile audit also flagged an unused non-public `SUPABASE_SERVICE_ROLE_KEY` in `../storia-mobile/.env` for removal/rotation.)*
- [x] Require verified Supabase email before email-based linking.
- [x] Add explicit Supabase provider/account mapping or document a follow-up migration plan.
- [x] Admin-gate book-question mutation endpoints.
- [x] Replace raw Better Auth session calls in dual-stack parent-user routes.
- [x] Tighten `Authorization` parsing to require `Bearer` scheme.
- [x] Add reading-session ownership check before update/upsert.
- [x] Add direct `src/lib/child-auth.test.ts` coverage.
- [x] Add route regression tests for reading progress, feedback, question mutations, and reading session ownership.

## Suggested Fix Order

1. **Security hotfixes:** service-role env fallback, verified email linking, bearer parsing.
2. **Authorization hotfix:** admin-gate question mutations.
3. **Route consistency:** replace raw parent-session reads with `getAuthenticatedUser()` where mobile should work.
4. **Data integrity:** fix reading-session upsert ownership.
5. **Tests:** add direct helper tests and route regressions.


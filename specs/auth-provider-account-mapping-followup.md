# Auth Provider/Account Mapping (Follow-up)

Status: Deferred. Tracked for a future remediation pass.

## Motivation

Today, `resolveUser` in `src/lib/child-auth.ts` links a Supabase-authenticated user to an existing Better Auth `user` row by **email** when the Supabase `id` does not already match. This is implicit identity coupling: any party who proves control of an email at Supabase silently inherits the matching Better Auth account. The 2026-04-28 audit accepted this only because `resolveBySupabaseToken` now requires `supaUser.email_confirmed_at` before reaching the linking branch — that gate is the trust anchor, not the mapping itself.

Email-based linking is brittle long-term:

- Email change on either provider quietly forks identity.
- A typo or shared-mailbox handoff could merge accounts that should stay distinct.
- There is no audit row capturing "this Better Auth user is connected to this Supabase user" — just an inferred join via column equality.

## Proposed change

Introduce explicit provider/account mapping. Two equivalent shapes:

1. **Mapping table**: `auth_provider_account` rows of `(user_id, provider, provider_account_id, linked_at)`. Linkage is set once, on first verified Supabase token, and re-checked by id on every subsequent request. Email becomes a profile attribute, not the join key.
2. **Columns on `user`**: add `supabase_id` (and similar for any future provider) with a unique index. Lighter, but less general.

In both cases, the auth flow becomes: lookup by `(provider, provider_account_id)` first; if not found, create a fresh user and record the link; never fall back to email matching at runtime.

## Migration steps (sketch)

1. Add table/columns and backfill from current `user.id == supabase id` rows.
2. Dual-write linkage on every successful Supabase resolution.
3. Switch `resolveUser` to look up by mapping; keep email-link path behind a feature flag for one release, log every hit.
4. Once flag-hit count is zero in production, delete the email-link branch and the flag.

## Why deferred

Out of scope for the dual-stack auth remediation plan (`specs/dual-stack-auth-remediation-2026-04-28.md`). That plan focuses on closing the immediate token/env/email-verification gaps. Mapping is a schema change with a multi-step migration; it deserves its own plan, its own backfill validation, and its own rollback path.

# Mobile Compatibility Audit — Dual-Stack Auth

Date: 2026-04-28  
Scope: read-only audit of `../storia-mobile` for dual-stack auth compatibility after web auth remediation. Mobile source was not edited.

## Verdict

**PASS for the web dual-stack auth gate.** The Flutter app sends Supabase access tokens as `Authorization: Bearer ...`, initializes and observes Supabase sessions, does not use a `NEXT_PUBLIC_*` service-role key in app code, and does not call the remediated parent-user routes whose legacy unauthenticated response shapes changed or were preserved.

**Caution:** `../storia-mobile/.env:6` contains a `SUPABASE_SERVICE_ROLE_KEY`. The audited Flutter runtime code under `../storia-mobile/lib/` does **not** read it, and there is no `NEXT_PUBLIC_*` service-role dependency, but the key should be removed/rotated as a mobile-repo security follow-up.

## Checks

### 1. Authorization headers use Bearer

- `../storia-mobile/lib/src/data/analytics_repository.dart:235-241` builds analytics HTTP headers and sets `'authorization': 'Bearer $accessToken'` when a Supabase access token is present.
- `../storia-mobile/lib/src/features/child/data/child_profile_repository.dart:91-103` builds child-profile HTTP headers from the current Supabase session token and sets `'authorization': 'Bearer $accessToken'`.
- `../storia-mobile/lib/src/data/providers.dart:39-45` wires analytics `currentAccessToken` to `supabase.auth.currentSession?.accessToken`.
- `../storia-mobile/lib/src/features/child/data/child_profile_repository.dart:14-24` wires child-profile auth to either an injected resolver or `supabase.auth.currentSession?.accessToken`.
- Grep evidence: `rg -n "authorization|Authorization|Bearer" ../storia-mobile/lib` found only the two HTTP header writes above; the other `Authorization` hits are Apple sign-in enum/error names in `auth_repository.dart:84-104`, not HTTP headers.

### 2. Auth flows produce Supabase sessions / email confirmation as far as code allows

- Supabase is initialized with the anon key and Flutter auth handling in `../storia-mobile/lib/main.dart:15-18`.
- Magic-link OTP uses Supabase Auth directly: `../storia-mobile/lib/src/features/auth/data/auth_repository.dart:31-40` calls `_client.auth.signInWithOtp(emailRedirectTo: 'storia://login-callback/', shouldCreateUser: ...)`.
- The app registers the callback deep link on Android at `../storia-mobile/android/app/src/main/AndroidManifest.xml:35-40` and iOS at `../storia-mobile/ios/Runner/Info.plist:25-33`.
- Google OAuth uses Supabase OAuth with the same callback URL: `../storia-mobile/lib/src/features/auth/data/auth_repository.dart:62-67`; the sign-in UI invokes it from `../storia-mobile/lib/src/features/auth/presentation/sign_in_screen.dart:155-164,222-236`.
- Native Apple sign-in exchanges the Apple identity token through Supabase: `../storia-mobile/lib/src/features/auth/data/auth_repository.dart:78-101`; the sign-in UI invokes it from `../storia-mobile/lib/src/features/auth/presentation/sign_in_screen.dart:165-175,222-236`.
- Session state comes from Supabase only: `../storia-mobile/lib/src/features/auth/data/auth_providers.dart:31-44` initializes from `_repository.currentSession` and updates from `_repository.authStateChanges`; `../storia-mobile/lib/src/features/auth/domain/auth_state.dart:3-8` treats `session != null` as authenticated.
- Limitation: `rg -n "email_confirmed_at|emailConfirmed|confirmed|email_confirm" ../storia-mobile/lib ../storia-mobile/test -g '*.dart'` returned no app-code hits. Therefore the mobile app does not itself inspect `email_confirmed_at`; confirmation is governed by Supabase Auth. The remediated backend verified-email gate remains the enforcement point if any provider returns a session without confirmation metadata.

### 3. No mobile `NEXT_PUBLIC` service-role dependency

- Runtime app code reads only `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Supabase initialization: `../storia-mobile/lib/main.dart:15-18`.
- `rg -n "NEXT_PUBLIC|SERVICE_ROLE|service_role|SUPABASE_SERVICE|SUPABASE.*ROLE" ../storia-mobile/lib ../storia-mobile/test ../storia-mobile/pubspec.yaml` returned no hits.
- As noted above, `../storia-mobile/.env:6` contains a non-`NEXT_PUBLIC` service-role key but no audited Flutter code reads it.

### 4. No reliance on changed route response shapes

- Mobile HTTP calls under `../storia-mobile/lib/` are limited to:
  - `POST /api/analytics/events` in `../storia-mobile/lib/src/data/analytics_repository.dart:243-260`, which only checks for any 2xx status and does not parse a success shape.
  - `GET/POST /api/child-profiles` in `../storia-mobile/lib/src/features/child/data/child_profile_repository.dart:30-88`, which parses `{ childProfiles }` and `{ childProfile }`; these routes were not part of the parent-user feedback/reading-progress response-shape remediation.
- Grep evidence: `rg -n "reading-progress|reading_progress|feedback|reading-sessions|reading_sessions|questions|child-profiles|analytics/events" ../storia-mobile/lib ../storia-mobile/test -g '*.dart'` found no mobile references to `/api/reading-progress`, `/api/feedback`, `/api/feedback/status`, `/api/reading-sessions`, or `/api/books/[id]/questions` routes.

## Conclusion

The mobile app is compatible with the server-side dual-stack auth changes: it authenticates through Supabase, sends `Bearer` access tokens to web API endpoints that need backend auth, and does not depend on the changed route response shapes. The only follow-up is to remove/rotate the unused service-role secret present in `../storia-mobile/.env`.

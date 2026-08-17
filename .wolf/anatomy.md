# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-08-16T20:33:56.529Z
> Files: 740 tracked | Anatomy hits: 0 | Misses: 0

## ../../../.claude/projects/-Users-akinpound-Documents-experiments-storia/memory/

- `MEMORY.md` — Storia Project Memory (~465 tok)
- `pronunciation_book_table_decision.md` (~486 tok)

## ../../../.claude/tasks/b1ac0bff-9061-44ae-be0d-880e3cda0ca8/

- `1.json` (~176 tok)
- `2.json` (~177 tok)
- `3.json` (~177 tok)

## ../storia-mobile/lib/src/data/

- `analytics_repository.dart` — Mobile analytics HTTP repository; sends Supabase access token as `Authorization: Bearer <token>` for analytics events (~5000 tok)
- `models.dart` — Class: WordTimestamp (~4251 tok)
- `providers.dart` — Mobile dependency providers, including current Supabase access-token callback passed to repositories (~1200 tok)

## ../storia-mobile/lib/src/features/auth/data/

- `auth_repository.dart` — Class: AppAuthException (~1770 tok)

## ../storia-mobile/lib/src/features/auth/presentation/widgets/

- `auth_social_buttons.dart` — / Apple / Google sign-in block shared by the sign-in and sign-up screens. (~909 tok)
- `magic_code_field.dart` — / Code-entry fallback shown once a magic link has been emailed. (~602 tok)

## ../storia-mobile/lib/src/features/child/data/

- `child_profile_repository.dart` — Mobile child-profile HTTP repository; fetch/create calls require current Supabase access token and send `Authorization: Bearer <token>` (~2200 tok)

## ../storia-mobile/lib/src/features/narration_studio/application/

- `narration_recorder.dart` — / Mic capture behind a thin port so the controller is testable without (~550 tok)
- `narration_track_selection.dart` — / Swaps a parent-recorded track into a book's pages. (~830 tok)
- `recording_controller.dart` — / Where one page sits in the record → keep → upload → aligned flow. (~2588 tok)

## ../storia-mobile/lib/src/features/narration_studio/data/

- `narration_providers.dart` — Class: NarrationTrackSelection (~778 tok)
- `narration_repository.dart` — Class: NarrationRepositoryException (~1490 tok)

## ../storia-mobile/lib/src/features/narration_studio/domain/

- `narration_track.dart` — / How much to trust a recording's word timings. (~996 tok)

## ../storia-mobile/lib/src/features/narration_studio/presentation/

- `narration_studio_screen.dart` — Stateful widget: _PageStrip (~3178 tok)
- `narration_voice_picker.dart` — / Narrator chooser for the reader's audio sheet. (~1374 tok)

## ../storia-mobile/lib/src/features/reader/

- `reader_screen.dart` — Flutter widget (~15035 tok)

## ../storia-mobile/lib/src/features/reader/overlay/

- `overlay_layout_engine.dart` — Class: OverlayLayoutEngine (~1460 tok)

## ../storia-mobile/test/features/auth/

- `magic_code_test.dart` (~1295 tok)

## ../storia-mobile/test/features/narration_studio/

- `narration_repository_test.dart` — Declares _trackJson (~1731 tok)
- `narration_track_selection_test.dart` — Declares TextOverlayConfig (~1633 tok)
- `parent_narration_highlight_test.dart` — / The feature's actual acceptance criterion: with a parent track selected, the (~1065 tok)
- `recording_controller_test.dart` — Class: _FakeRecorder (~2395 tok)

## ./

- `.dockerignore` — Docker ignore rules (~498 tok)
- `.DS_Store` (~3818 tok)
- `.gitignore` — Git ignore rules (~212 tok)
- `.mcp.json` (~43 tok)
- `.ralph_session` (~46 tok)
- `.ralph_session_history` (~45 tok)
- `@AGENT.md` — Storia - Build and Execution Instructions (~803 tok)
- `@fix_plan.md` — Storia Migration Plan (~420 tok)
- `bin/bootstrap.sh` — Local/symphony bootstrap script for installing deps, Prisma generate, and preparing env/database checks (~350 tok)
- `bin/pi-symphony.sh` — Linear ticket orchestration script that creates worktrees, bootstraps, spawns squad/agents, and logs ticket runs (~3200 tok)
- `bin/verify.sh` — Local/symphony verification wrapper for lint/type/test checks (~160 tok)
- `CLAUDE.md` — OpenWolf (~57 tok)
- `components.json` (~129 tok)
- `docker-compose.yml` — Local Postgres service for Prisma dev workflow (~180 tok)
- `Dockerfile` — Docker container definition (~566 tok)
- `eslint.config.mjs` — ESLint flat configuration (~124 tok)
- `next-env.d.ts` — / <reference types="next" /> (~72 tok)
- `next.config.ts` — Declares nextConfig (~154 tok)
- `package-lock.json` — npm lock file (~111362 tok)
- `package.json` — Node.js package manifest (~504 tok)
- `postcss.config.mjs` — Declares config (~26 tok)
- `progress.json` (~41 tok)
- `PROMPT.md` — Ralph Development Instructions (~774 tok)
- `README.md` — Project documentation (~802 tok)
- `schema.sql` — Database schema (~821 tok)
- `tsconfig.json` — TypeScript configuration (~192 tok)
- `tsconfig.tsbuildinfo` (~155219 tok)
- `vitest.config.ts` — Vitest test configuration (~95 tok)
- `WORKFLOW.md` — Configuration consumed by ./bin/pi-symphony.sh — a Pi-native Linear orchestrator (~3482 tok)

## .claude/worktrees/agent-a440932b/src/app/api/books/

- `route.ts` — Next.js API route: GET (~2380 tok)

## .claude/worktrees/agent-a440932b/src/app/api/books/[id]/pronunciations/

- `route.ts` — ManifestEntry is the simplified shape the reader consumes. (~1030 tok)

## .claude/worktrees/agent-a440932b/src/hooks/

- `useBookData.ts` — True iff at least one page has a non-empty wordPronunciations map. (~3075 tok)
- `usePronunciationManifest.test.tsx` — --------------------------------------------------------------------------- (~2855 tok)
- `usePronunciationManifest.ts` — The three states described in WR-4.8 / FR-WEB-15. (~819 tok)

## .claude/worktrees/agent-a440932b/src/lib/

- `pronunciation.ts` — Exports WordPronunciationEntry, WordPronunciationMap, PronunciationPlaybackMode, resolvePronunciatio (~393 tok)

## .claude/worktrees/agent-a440932b/src/test/

- `setup.ts` — MockResizeObserver: src (~323 tok)

## .wolf/

- `anatomy.md` — Auto-maintained file map and token estimates for project navigation (~9100 tok)
- `buglog.json` — OpenWolf bug log with historical failures/fixes and root-cause notes (~25000 tok)
- `cerebrum.md` — Project learning memory: user preferences, key learnings, do-not-repeat items, and decisions (~6400 tok)
- `memory.md` — Session/action timeline log; recent entries identify where the previous coding session left off (~13000 tok)
- `OPENWOLF.md` — OpenWolf operating protocol for context, navigation, memory, cerebrum, and bug logging (~1190 tok)

## Discovered during 2026-04-28 auth audit

- `src/app/api/analytics/events/route.test.ts` — Tests for analytics event route validation/auth (~218 tok)
- `src/app/api/analytics/events/route.ts` — Child-authorized analytics event ingestion endpoint (~349 tok)
- `src/app/api/books/[id]/questions/[questionId]/route.ts` — Question answer route with auth and scoring logic (~948 tok)
- `src/app/api/child-profiles/route.test.ts` — Vitest coverage for child profile GET/POST auth/validation paths (~1300 tok)
- `src/app/api/comprehension/route.test.ts` — Vitest coverage for comprehension POST auth/access/scoring paths (~1500 tok)
- `src/app/api/continue-reading/route.test.ts` — Vitest coverage for continue-reading GET auth and latest progress selection (~650 tok)
- `src/app/api/feedback/route.test.ts` — Vitest coverage for feedback POST dual-stack auth via Supabase bearer and Better Auth cookie paths (~1200 tok)
- `src/app/api/feedback/route.ts` — Feedback submission route using dual-stack authenticated parent user (~188 tok)
- `src/app/api/feedback/status/route.test.ts` — Vitest coverage for feedback status dual-stack auth and legacy unauthenticated modal shape (~1200 tok)
- `src/app/api/feedback/status/route.ts` — Feedback status route using dual-stack authenticated parent user (~181 tok)
- `src/app/api/reading-progress/dual-stack-auth.route.test.ts` — Vitest coverage proving parent-user reading-progress GET/POST accepts Supabase bearer and Better Auth cookie auth (~1300 tok)
- `src/app/api/reading-progress/route.test.ts` — Vitest coverage for reading-progress GET/POST legacy + child-aware auth paths (~1250 tok)
- `src/app/api/reading-sessions/route.test.ts` — Vitest coverage for reading session POST auth/access/upsert paths (~800 tok)
- `src/app/api/reports/analytics.reader-flow.integration.test.ts` — Integration tests for reader analytics flow and report aggregation (~1531 tok)
- `src/app/api/reports/analytics/route.test.ts` — Tests for analytics report auth/queries (~582 tok)
- `src/app/api/reports/analytics/route.ts` — Child-authorized analytics report endpoint (~819 tok)
- `src/app/api/reports/summary/route.test.ts` — Vitest coverage for reports summary auth/access/query behavior (~1100 tok)
- `src/lib/admin-auth.ts` — Admin-only Better Auth helper/guard for admin routes (~222 tok)

## Discovered during 2026-04-30 brainstorming visual companion

- `.superpowers/brainstorm/51927-1777563562/content/press-proof-layout-options.html` — Visual companion mockup comparing three landing-page press/proof layout approaches for Equitech and ALTA podcast links (~900 tok)
- `.superpowers/brainstorm/51927-1777563562/content/waiting-in-terminal.html` — Visual companion waiting screen generated during landing-page brainstorming (~80 tok)
- `.superpowers/brainstorm/51927-1777563562/state/server-info` — Visual companion server metadata with local URL/ports (~50 tok)
- `src/components/StoriaCalmLanding.css` — Styling for the calm landing page sections, story cards, community image grid, CTA, and responsive behavior (~11000 tok)

## Discovered during 2026-04-30 landing cleanup

- `src/components/LandingAnimations.tsx` — Landing animation helpers/effects used by the landing experience (~1200 tok)
- `src/components/StoriaCalmLanding.tsx` — Main calm landing page component with GSAP interactions, story cards, impact copy, founder/community photos, captions, and signup CTA (~9000 tok)

## Discovered during 2026-04-30 landing design spec

- `docs/superpowers/specs/2026-04-30-landing-cleanup-design.md` — Approved landing-page cleanup design covering copy accuracy, story-card preview UX, community caption updates, and Equitech/ALTA press strip (~900 tok)

## Discovered during 2026-04-30 landing implementation plan

- `docs/superpowers/plans/2026-04-30-landing-cleanup.md` — Implementation plan for landing cleanup covering TSX copy/press markup, CSS preview/press styling, and QA verification tasks (~2400 tok)

## Discovered during 2026-04-30 visual companion LAN retry

- `.superpowers/brainstorm/69668-1777565783/content/press-proof-layout-options.html` — Visual companion press/proof layout options served from LAN-bound retry server (~900 tok)
- `.superpowers/brainstorm/69668-1777565783/content/waiting-design-confirmation.html` — Visual companion waiting screen after selecting press-strip option B (~60 tok)
- `.superpowers/brainstorm/69668-1777565783/state/server-info` — LAN-bound visual companion server metadata using host 0.0.0.0 and URL host 192.168.1.177 (~60 tok)

## Discovered during 2026-04-30 visual companion restart

- `.superpowers/brainstorm/51927-1777563562/state/server-stopped` — Prior visual companion stop marker showing idle timeout (~20 tok)
- `.superpowers/brainstorm/68211-1777565610/content/press-proof-layout-options.html` — Republished visual companion A/B/C mockup for Equitech article and ALTA podcast placement after idle timeout (~900 tok)
- `.superpowers/brainstorm/68211-1777565610/state/server-info` — Restarted visual companion server metadata with local URL/port (~50 tok)

## Discovered during 2026-07-17 mascot image swap


## _build/

- `.DS_Store` (~1640 tok)

## _build/dev/lib/bandit/.mix/

- `compile.elixir` (~4711 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/bandit/ebin/

- `bandit.app` (~1462 tok)
- `Elixir.Bandit.Adapter.beam` (~4726 tok)
- `Elixir.Bandit.Application.beam` (~591 tok)
- `Elixir.Bandit.beam` — Declares supervisor (~4959 tok)
- `Elixir.Bandit.Clock.beam` (~1170 tok)
- `Elixir.Bandit.Compression.beam` (~2555 tok)
- `Elixir.Bandit.DelegatingHandler.beam` (~2761 tok)
- `Elixir.Bandit.Extractor.beam` (~1879 tok)
- `Elixir.Bandit.Headers.beam` (~1756 tok)
- `Elixir.Bandit.HTTP1.Handler.beam` (~4210 tok)
- `Elixir.Bandit.HTTP1.Socket.beam` (~796 tok)
- `Elixir.Bandit.HTTP2.Connection.beam` (~6455 tok)
- `Elixir.Bandit.HTTP2.Errors.beam` (~1162 tok)
- `Elixir.Bandit.HTTP2.Errors.ConnectionError.beam` (~1062 tok)
- `Elixir.Bandit.HTTP2.Errors.StreamError.beam` (~1059 tok)
- `Elixir.Bandit.HTTP2.FlowControl.beam` (~700 tok)
- `Elixir.Bandit.HTTP2.Frame.beam` (~1398 tok)
- `Elixir.Bandit.HTTP2.Frame.Continuation.beam` (~919 tok)
- `Elixir.Bandit.HTTP2.Frame.Data.beam` (~1128 tok)
- `Elixir.Bandit.HTTP2.Frame.Flags.beam` (~783 tok)
- `Elixir.Bandit.HTTP2.Frame.Goaway.beam` (~942 tok)
- `Elixir.Bandit.HTTP2.Frame.Headers.beam` (~1586 tok)
- `Elixir.Bandit.HTTP2.Frame.Ping.beam` (~942 tok)
- `Elixir.Bandit.HTTP2.Frame.Priority.beam` (~926 tok)
- `Elixir.Bandit.HTTP2.Frame.PushPromise.beam` (~522 tok)
- `Elixir.Bandit.HTTP2.Frame.RstStream.beam` (~895 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Continuation.beam` (~971 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Data.beam` (~1046 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Goaway.beam` (~761 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Headers.beam` (~1085 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Ping.beam` (~739 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Priority.beam` (~757 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.RstStream.beam` (~718 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.Settings.beam` (~1046 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.Bandit.HTTP2.Frame.WindowUpdate.beam` (~729 tok)
- `Elixir.Bandit.HTTP2.Frame.Serializable.beam` (~1332 tok)
- `Elixir.Bandit.HTTP2.Frame.Settings.beam` (~1586 tok)
- `Elixir.Bandit.HTTP2.Frame.Unknown.beam` (~775 tok)
- `Elixir.Bandit.HTTP2.Frame.WindowUpdate.beam` (~937 tok)
- `Elixir.Bandit.HTTP2.Handler.beam` (~4895 tok)
- `Elixir.Bandit.HTTP2.Settings.beam` (~685 tok)
- `Elixir.Bandit.HTTP2.Stream.beam` (~1226 tok)
- `Elixir.Bandit.HTTP2.StreamCollection.beam` (~1465 tok)
- `Elixir.Bandit.HTTP2.StreamProcess.beam` (~1581 tok)
- `Elixir.Bandit.HTTPError.beam` (~1048 tok)
- `Elixir.Bandit.HTTPTransport.Bandit.HTTP1.Socket.beam` (~6727 tok)
- `Elixir.Bandit.HTTPTransport.Bandit.HTTP2.Stream.beam` (~7285 tok)
- `Elixir.Bandit.HTTPTransport.beam` (~2153 tok)
- `Elixir.Bandit.InitialHandler.beam` (~3515 tok)
- `Elixir.Bandit.Logger.beam` (~995 tok)
- `Elixir.Bandit.PhoenixAdapter.beam` (~1518 tok)
- `Elixir.Bandit.Pipeline.beam` — Declares to (~3878 tok)
- `Elixir.Bandit.PrimitiveOps.WebSocket.beam` (~894 tok)
- `Elixir.Bandit.SocketHelpers.beam` (~1158 tok)
- `Elixir.Bandit.Telemetry.beam` (~2312 tok)
- `Elixir.Bandit.Trace.beam` (~2856 tok)
- `Elixir.Bandit.TransportError.beam` (~1047 tok)
- `Elixir.Bandit.WebSocket.Connection.beam` (~5215 tok)
- `Elixir.Bandit.WebSocket.Frame.beam` (~2850 tok)
- `Elixir.Bandit.WebSocket.Frame.Binary.beam` (~746 tok)
- `Elixir.Bandit.WebSocket.Frame.ConnectionClose.beam` (~1052 tok)
- `Elixir.Bandit.WebSocket.Frame.Continuation.beam` (~783 tok)
- `Elixir.Bandit.WebSocket.Frame.Ping.beam` (~863 tok)
- `Elixir.Bandit.WebSocket.Frame.Pong.beam` (~859 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.Bandit.WebSocket.Frame.Binary.beam` (~743 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.Bandit.WebSocket.Frame.ConnectionClose.beam` (~834 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.Bandit.WebSocket.Frame.Continuation.beam` (~724 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.Bandit.WebSocket.Frame.Ping.beam` (~693 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.Bandit.WebSocket.Frame.Pong.beam` (~694 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.Bandit.WebSocket.Frame.Text.beam` (~738 tok)
- `Elixir.Bandit.WebSocket.Frame.Serializable.beam` (~1337 tok)
- `Elixir.Bandit.WebSocket.Frame.Text.beam` (~742 tok)
- `Elixir.Bandit.WebSocket.Handler.beam` (~3947 tok)
- `Elixir.Bandit.WebSocket.Handshake.beam` (~1736 tok)
- `Elixir.Bandit.WebSocket.PerMessageDeflate.beam` (~2816 tok)
- `Elixir.Bandit.WebSocket.Socket.beam` (~1440 tok)
- `Elixir.Bandit.WebSocket.Socket.ThousandIsland.Socket.beam` (~1178 tok)
- `Elixir.Bandit.WebSocket.UpgradeValidation.beam` (~1327 tok)

## _build/dev/lib/bcrypt_elixir/.mix/

- `compile.elixir` (~2438 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/bcrypt_elixir/ebin/

- `bcrypt_elixir.app` (~117 tok)
- `Elixir.Bcrypt.Base.beam` (~1500 tok)
- `Elixir.Bcrypt.beam` (~1895 tok)
- `Elixir.Bcrypt.Stats.beam` (~1100 tok)

## _build/dev/lib/bcrypt_elixir/priv/bcrypt_nif.so.dSYM/Contents/

- `Info.plist` (~172 tok)

## _build/dev/lib/bcrypt_elixir/priv/bcrypt_nif.so.dSYM/Contents/Resources/Relocations/aarch64/

- `bcrypt_nif.so.yml` (~52 tok)

## _build/dev/lib/castore/.mix/

- `compile.elixir` (~2344 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/castore/ebin/

- `castore.app` (~90 tok)
- `Elixir.CAStore.beam` (~499 tok)

## _build/dev/lib/certifi/

- `mix.rebar.config` (~159 tok)

## _build/dev/lib/certifi/.mix/

- `compile.fetch` (~0 tok)

## _build/dev/lib/certifi/ebin/

- `certifi_pt.beam` (~899 tok)
- `certifi.app` (~137 tok)
- `certifi.beam` (~57182 tok)

## _build/dev/lib/comeonin/.mix/

- `compile.elixir` (~2427 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/comeonin/ebin/

- `comeonin.app` (~126 tok)
- `Elixir.Comeonin.beam` (~1218 tok)
- `Elixir.Comeonin.BehaviourTestHelper.beam` (~1549 tok)
- `Elixir.Comeonin.PasswordHash.beam` (~519 tok)

## _build/dev/lib/db_connection/.mix/

- `compile.elixir` (~3168 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/db_connection/ebin/

- `db_connection.app` (~493 tok)
- `Elixir.DBConnection.App.beam` (~684 tok)
- `Elixir.DBConnection.Backoff.beam` — Declares not (~1770 tok)
- `Elixir.DBConnection.beam` (~14993 tok)
- `Elixir.DBConnection.Connection.beam` — Declares cancel_timer (~6315 tok)
- `Elixir.DBConnection.ConnectionError.beam` (~1235 tok)
- `Elixir.DBConnection.ConnectionPool.beam` (~5653 tok)
- `Elixir.DBConnection.ConnectionPool.Pool.beam` — Declares supervisor (~1180 tok)
- `Elixir.DBConnection.EncodeError.beam` (~1038 tok)
- `Elixir.DBConnection.Holder.beam` (~6033 tok)
- `Elixir.DBConnection.LogEntry.beam` (~1239 tok)
- `Elixir.DBConnection.Ownership.beam` (~1582 tok)
- `Elixir.DBConnection.Ownership.Manager.beam` (~6966 tok)
- `Elixir.DBConnection.Ownership.Proxy.beam` (~4606 tok)
- `Elixir.DBConnection.OwnershipError.beam` (~757 tok)
- `Elixir.DBConnection.Pool.beam` (~575 tok)
- `Elixir.DBConnection.PrepareStream.beam` (~630 tok)
- `Elixir.DBConnection.Query.beam` (~1570 tok)
- `Elixir.DBConnection.Stream.beam` (~620 tok)
- `Elixir.DBConnection.Task.beam` (~1021 tok)
- `Elixir.DBConnection.TelemetryListener.beam` (~2022 tok)
- `Elixir.DBConnection.TransactionError.beam` (~791 tok)
- `Elixir.DBConnection.Util.beam` (~800 tok)
- `Elixir.DBConnection.Watcher.beam` (~1771 tok)
- `Elixir.Enumerable.DBConnection.PrepareStream.beam` (~710 tok)
- `Elixir.Enumerable.DBConnection.Stream.beam` (~696 tok)

## _build/dev/lib/decimal/.mix/

- `compile.elixir` (~2537 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/decimal/ebin/

- `decimal.app` (~144 tok)
- `Elixir.Decimal.beam` (~20304 tok)
- `Elixir.Decimal.Context.beam` (~1329 tok)
- `Elixir.Decimal.Error.beam` (~1181 tok)
- `Elixir.Decimal.Macros.beam` (~528 tok)
- `Elixir.Inspect.Decimal.beam` (~588 tok)
- `Elixir.String.Chars.Decimal.beam` (~544 tok)

## _build/dev/lib/dns_cluster/.mix/

- `compile.elixir` (~2382 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/dns_cluster/ebin/

- `dns_cluster.app` (~104 tok)
- `Elixir.DNSCluster.beam` (~3520 tok)
- `Elixir.DNSCluster.Resolver.beam` (~960 tok)

## _build/dev/lib/dotenvy/.mix/

- `compile.elixir` (~2678 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/dotenvy/ebin/

- `dotenvy.app` (~153 tok)
- `Elixir.Dotenvy.beam` (~3719 tok)
- `Elixir.Dotenvy.Error.beam` (~1120 tok)
- `Elixir.Dotenvy.Parser.beam` (~3669 tok)
- `Elixir.Dotenvy.Parser.Opts.beam` (~579 tok)
- `Elixir.Dotenvy.Transformer.beam` (~1815 tok)

## _build/dev/lib/ecto/.mix/

- `compile.elixir` (~5044 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/ecto/ebin/

- `ecto.app` (~1462 tok)
- `Elixir.Ecto.Adapter.beam` (~1094 tok)
- `Elixir.Ecto.Adapter.Queryable.beam` (~1355 tok)
- `Elixir.Ecto.Adapter.Schema.beam` (~872 tok)
- `Elixir.Ecto.Adapter.Storage.beam` (~563 tok)
- `Elixir.Ecto.Adapter.Transaction.beam` (~563 tok)
- `Elixir.Ecto.Application.beam` (~558 tok)
- `Elixir.Ecto.Association.beam` (~8205 tok)
- `Elixir.Ecto.Association.BelongsTo.beam` (~3330 tok)
- `Elixir.Ecto.Association.Has.beam` (~4971 tok)
- `Elixir.Ecto.Association.HasThrough.beam` (~1860 tok)
- `Elixir.Ecto.Association.ManyToMany.beam` — Declares could (~6894 tok)
- `Elixir.Ecto.Association.NotLoaded.beam` (~649 tok)
- `Elixir.Ecto.beam` (~4661 tok)
- `Elixir.Ecto.CastError.beam` (~982 tok)
- `Elixir.Ecto.ChangeError.beam` (~1027 tok)
- `Elixir.Ecto.Changeset.beam` — Declares add_error (~33770 tok)
- `Elixir.Ecto.Changeset.Relation.beam` — Declares for (~8742 tok)
- `Elixir.Ecto.ConstraintError.beam` (~1348 tok)
- `Elixir.Ecto.Embedded.beam` — Declares given (~4613 tok)
- `Elixir.Ecto.Enum.beam` — Declares Elixir (~3007 tok)
- `Elixir.Ecto.InvalidChangesetError.beam` (~1655 tok)
- `Elixir.Ecto.InvalidURLError.beam` (~924 tok)
- `Elixir.Ecto.MigrationError.beam` (~1036 tok)
- `Elixir.Ecto.Multi.beam` (~7780 tok)
- `Elixir.Ecto.MultiplePrimaryKeyError.beam` (~1062 tok)
- `Elixir.Ecto.MultipleResultsError.beam` (~944 tok)
- `Elixir.Ecto.NoPrimaryKeyFieldError.beam` (~887 tok)
- `Elixir.Ecto.NoPrimaryKeyValueError.beam` (~875 tok)
- `Elixir.Ecto.NoResultsError.beam` (~906 tok)
- `Elixir.Ecto.ParameterizedType.beam` (~1427 tok)
- `Elixir.Ecto.Query.API.beam` (~4703 tok)
- `Elixir.Ecto.Query.beam` — Declares for (~14900 tok)
- `Elixir.Ecto.Query.BooleanExpr.beam` (~595 tok)
- `Elixir.Ecto.Query.Builder.beam` — Declares parameterized (~18154 tok)
- `Elixir.Ecto.Query.Builder.Combination.beam` (~881 tok)
- `Elixir.Ecto.Query.Builder.CTE.beam` (~1823 tok)
- `Elixir.Ecto.Query.Builder.Distinct.beam` (~1400 tok)
- `Elixir.Ecto.Query.Builder.Dynamic.beam` (~2179 tok)
- `Elixir.Ecto.Query.Builder.Filter.beam` (~3311 tok)
- `Elixir.Ecto.Query.Builder.From.beam` (~3540 tok)
- `Elixir.Ecto.Query.Builder.GroupBy.beam` (~2124 tok)
- `Elixir.Ecto.Query.Builder.Join.beam` (~4650 tok)
- `Elixir.Ecto.Query.Builder.LimitOffset.beam` (~1654 tok)
- `Elixir.Ecto.Query.Builder.Lock.beam` (~1001 tok)
- `Elixir.Ecto.Query.Builder.OrderBy.beam` (~3673 tok)
- `Elixir.Ecto.Query.Builder.Preload.beam` — Declares expecting (~3586 tok)
- `Elixir.Ecto.Query.Builder.Select.beam` (~7688 tok)
- `Elixir.Ecto.Query.Builder.Update.beam` (~2940 tok)
- `Elixir.Ecto.Query.Builder.Windows.beam` (~3358 tok)
- `Elixir.Ecto.Query.ByExpr.beam` (~584 tok)
- `Elixir.Ecto.Query.CastError.beam` (~828 tok)
- `Elixir.Ecto.Query.CompileError.beam` (~1044 tok)
- `Elixir.Ecto.Query.DynamicExpr.beam` (~587 tok)
- `Elixir.Ecto.Query.FromExpr.beam` (~602 tok)
- `Elixir.Ecto.Query.JoinExpr.beam` (~620 tok)
- `Elixir.Ecto.Query.LimitExpr.beam` (~589 tok)
- `Elixir.Ecto.Query.Planner.beam` (~33816 tok)
- `Elixir.Ecto.Query.QueryExpr.beam` (~576 tok)
- `Elixir.Ecto.Query.SelectExpr.beam` (~607 tok)
- `Elixir.Ecto.Query.Tagged.beam` (~569 tok)
- `Elixir.Ecto.Query.Values.beam` — Declares for (~1515 tok)
- `Elixir.Ecto.Query.WindowAPI.beam` (~1764 tok)
- `Elixir.Ecto.Query.WithExpr.beam` (~574 tok)
- `Elixir.Ecto.Queryable.Atom.beam` (~836 tok)
- `Elixir.Ecto.Queryable.beam` (~1599 tok)
- `Elixir.Ecto.Queryable.BitString.beam` (~698 tok)
- `Elixir.Ecto.Queryable.Ecto.Query.beam` (~533 tok)
- `Elixir.Ecto.Queryable.Ecto.SubQuery.beam` (~690 tok)
- `Elixir.Ecto.Queryable.Tuple.beam` (~750 tok)
- `Elixir.Ecto.QueryError.beam` (~1161 tok)
- `Elixir.Ecto.Repo.Assoc.beam` (~2244 tok)
- `Elixir.Ecto.Repo.beam` (~7550 tok)
- `Elixir.Ecto.Repo.Preloader.beam` (~11257 tok)
- `Elixir.Ecto.Repo.Queryable.beam` (~8703 tok)
- `Elixir.Ecto.Repo.Registry.beam` (~1762 tok)
- `Elixir.Ecto.Repo.Schema.beam` — Declares error_message (~17422 tok)
- `Elixir.Ecto.Repo.Supervisor.beam` — Declares module_info (~4076 tok)
- `Elixir.Ecto.Repo.Transaction.beam` (~1384 tok)
- `Elixir.Ecto.Schema.beam` (~16903 tok)
- `Elixir.Ecto.Schema.Loader.beam` — Declares for (~1713 tok)
- `Elixir.Ecto.Schema.Metadata.beam` (~769 tok)
- `Elixir.Ecto.StaleEntryError.beam` (~1081 tok)
- `Elixir.Ecto.SubQuery.beam` (~639 tok)
- `Elixir.Ecto.SubQueryError.beam` (~1002 tok)
- `Elixir.Ecto.Type.beam` (~13637 tok)
- `Elixir.Ecto.UUID.beam` (~9809 tok)
- `Elixir.Inspect.Ecto.Association.NotLoaded.beam` (~712 tok)
- `Elixir.Inspect.Ecto.Changeset.beam` (~1254 tok)
- `Elixir.Inspect.Ecto.Query.beam` (~6380 tok)
- `Elixir.Inspect.Ecto.Query.DynamicExpr.beam` (~1304 tok)
- `Elixir.Inspect.Ecto.Schema.Metadata.beam` (~764 tok)
- `Elixir.Jason.Encoder.Ecto.Association.NotLoaded.beam` (~931 tok)
- `Elixir.Jason.Encoder.Ecto.Schema.Metadata.beam` (~882 tok)
- `Elixir.Mix.Ecto.beam` (~2332 tok)
- `Elixir.Mix.Tasks.Ecto.beam` (~760 tok)
- `Elixir.Mix.Tasks.Ecto.Create.beam` (~1205 tok)
- `Elixir.Mix.Tasks.Ecto.Drop.beam` (~1569 tok)
- `Elixir.Mix.Tasks.Ecto.Gen.Repo.beam` (~1888 tok)

## _build/dev/lib/ecto_sql/.mix/

- `compile.elixir` (~3593 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/ecto_sql/ebin/

- `ecto_sql.app` (~590 tok)
- `Elixir.Collectable.Ecto.Adapters.SQL.Stream.beam` (~760 tok)
- `Elixir.Ecto.Adapter.Migration.beam` (~828 tok)
- `Elixir.Ecto.Adapter.Structure.beam` (~662 tok)
- `Elixir.Ecto.Adapters.MyXQL.beam` (~8002 tok)
- `Elixir.Ecto.Adapters.Postgres.beam` — Declares lc_collate (~8975 tok)
- `Elixir.Ecto.Adapters.Postgres.Connection.beam` — Declares generated (~25453 tok)
- `Elixir.Ecto.Adapters.SQL.Application.beam` (~599 tok)
- `Elixir.Ecto.Adapters.SQL.beam` (~14711 tok)
- `Elixir.Ecto.Adapters.SQL.Connection.beam` (~1113 tok)
- `Elixir.Ecto.Adapters.SQL.Sandbox.beam` (~4547 tok)
- `Elixir.Ecto.Adapters.SQL.Sandbox.Connection.beam` (~1746 tok)
- `Elixir.Ecto.Adapters.SQL.Stream.beam` (~684 tok)
- `Elixir.Ecto.Adapters.Tds.beam` (~4723 tok)
- `Elixir.Ecto.Migration.beam` (~10230 tok)
- `Elixir.Ecto.Migration.Command.beam` (~640 tok)
- `Elixir.Ecto.Migration.Constraint.beam` (~684 tok)
- `Elixir.Ecto.Migration.Index.beam` (~797 tok)
- `Elixir.Ecto.Migration.Reference.beam` (~741 tok)
- `Elixir.Ecto.Migration.Runner.beam` (~8056 tok)
- `Elixir.Ecto.Migration.SchemaMigration.beam` — Declares virtual_type (~2275 tok)
- `Elixir.Ecto.Migration.Table.beam` (~681 tok)
- `Elixir.Ecto.Migrator.beam` (~10748 tok)
- `Elixir.Enumerable.Ecto.Adapters.SQL.Stream.beam` (~779 tok)
- `Elixir.Mix.EctoSQL.beam` (~1313 tok)
- `Elixir.Mix.Tasks.Ecto.Dump.beam` (~1774 tok)
- `Elixir.Mix.Tasks.Ecto.Gen.Migration.beam` (~2085 tok)
- `Elixir.Mix.Tasks.Ecto.Load.beam` (~2443 tok)
- `Elixir.Mix.Tasks.Ecto.Migrate.beam` (~1914 tok)
- `Elixir.Mix.Tasks.Ecto.Migrations.beam` (~1445 tok)
- `Elixir.Mix.Tasks.Ecto.Rollback.beam` (~1905 tok)

## _build/dev/lib/elixir_make/.mix/

- `compile.elixir` (~2693 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/elixir_make/ebin/

- `elixir_make.app` (~204 tok)
- `Elixir.ElixirMake.Artefact.beam` (~4389 tok)
- `Elixir.ElixirMake.Compiler.beam` (~3214 tok)
- `Elixir.ElixirMake.Downloader.beam` (~460 tok)
- `Elixir.ElixirMake.Downloader.Httpc.beam` (~1581 tok)
- `Elixir.ElixirMake.Precompiler.beam` (~953 tok)
- `Elixir.Mix.Tasks.Compile.ElixirMake.beam` — Declares Elixir (~2621 tok)
- `Elixir.Mix.Tasks.ElixirMake.Checksum.beam` (~2686 tok)
- `Elixir.Mix.Tasks.ElixirMake.Precompile.beam` (~1915 tok)

## _build/dev/lib/esbuild/.mix/

- `compile.elixir` (~2528 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/esbuild/ebin/

- `Elixir.Esbuild.beam` (~4637 tok)
- `Elixir.Esbuild.NpmRegistry.beam` (~2817 tok)
- `Elixir.Mix.Tasks.Esbuild.beam` (~1058 tok)
- `Elixir.Mix.Tasks.Esbuild.Install.beam` (~955 tok)
- `esbuild.app` (~159 tok)

## _build/dev/lib/ex_aws/.mix/

- `compile.elixir` (~3567 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/ex_aws/ebin/

- `Elixir.ExAws.Auth.beam` (~4321 tok)
- `Elixir.ExAws.Auth.Credentials.beam` (~693 tok)
- `Elixir.ExAws.Auth.Signatures.beam` (~608 tok)
- `Elixir.ExAws.Auth.Utils.beam` (~1092 tok)
- `Elixir.ExAws.beam` (~1371 tok)
- `Elixir.ExAws.Behaviour.beam` (~524 tok)
- `Elixir.ExAws.Config.AuthCache.AuthConfigAdapter.beam` (~464 tok)
- `Elixir.ExAws.Config.AuthCache.beam` (~2952 tok)
- `Elixir.ExAws.Config.beam` (~3050 tok)
- `Elixir.ExAws.Config.Defaults.beam` (~5626 tok)
- `Elixir.ExAws.CredentialsIni.File.beam` (~602 tok)
- `Elixir.ExAws.CredentialsIni.Provider.beam` (~484 tok)
- `Elixir.ExAws.Error.beam` (~1028 tok)
- `Elixir.ExAws.InstanceMeta.beam` (~1913 tok)
- `Elixir.ExAws.InstanceMetaTokenProvider.beam` (~2259 tok)
- `Elixir.ExAws.JSON.Codec.beam` (~580 tok)
- `Elixir.ExAws.JSON.JSX.beam` (~720 tok)
- `Elixir.ExAws.Operation.beam` (~1435 tok)
- `Elixir.ExAws.Operation.ExAws.Operation.JSON.beam` (~1179 tok)
- `Elixir.ExAws.Operation.ExAws.Operation.Query.beam` (~1119 tok)
- `Elixir.ExAws.Operation.ExAws.Operation.RestQuery.beam` (~1023 tok)
- `Elixir.ExAws.Operation.ExAws.Operation.S3.beam` (~2331 tok)
- `Elixir.ExAws.Operation.JSON.beam` (~898 tok)
- `Elixir.ExAws.Operation.Query.beam` (~687 tok)
- `Elixir.ExAws.Operation.RestQuery.beam` (~689 tok)
- `Elixir.ExAws.Operation.S3.beam` (~705 tok)
- `Elixir.ExAws.PodIdentity.beam` (~1757 tok)
- `Elixir.ExAws.Request.beam` (~3314 tok)
- `Elixir.ExAws.Request.Hackney.beam` (~807 tok)
- `Elixir.ExAws.Request.HttpClient.beam` (~728 tok)
- `Elixir.ExAws.Request.Req.beam` (~969 tok)
- `Elixir.ExAws.Request.Url.beam` (~1853 tok)
- `Elixir.ExAws.Utils.beam` (~3325 tok)
- `ex_aws.app` (~590 tok)

## _build/dev/lib/ex_aws_s3/.mix/

- `compile.elixir` (~2780 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/ex_aws_s3/ebin/

- `Elixir.ExAws.Operation.ExAws.Operation.S3DeleteAllObjects.beam` (~991 tok)
- `Elixir.ExAws.Operation.ExAws.S3.Download.beam` (~1308 tok)
- `Elixir.ExAws.Operation.ExAws.S3.Upload.beam` (~1180 tok)
- `Elixir.ExAws.Operation.S3DeleteAllObjects.beam` (~640 tok)
- `Elixir.ExAws.S3.beam` (~14157 tok)
- `Elixir.ExAws.S3.Download.beam` (~1728 tok)
- `Elixir.ExAws.S3.Lazy.beam` (~1412 tok)
- `Elixir.ExAws.S3.Parsers.beam` (~869 tok)
- `Elixir.ExAws.S3.Upload.beam` (~2243 tok)
- `Elixir.ExAws.S3.Utils.beam` — Declares Elixir (~5198 tok)
- `ex_aws_s3.app` (~215 tok)

## _build/dev/lib/expo/.mix/

- `compile.elixir` (~3249 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.erlang` (~58 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/expo/ebin/

- `Elixir.Expo.Message.beam` (~1883 tok)
- `Elixir.Expo.Message.Plural.beam` (~2399 tok)
- `Elixir.Expo.Message.Singular.beam` (~2142 tok)
- `Elixir.Expo.Messages.beam` (~1781 tok)
- `Elixir.Expo.MO.beam` (~1661 tok)
- `Elixir.Expo.MO.Composer.beam` (~1908 tok)
- `Elixir.Expo.MO.InvalidFileError.beam` (~1208 tok)
- `Elixir.Expo.MO.Parser.beam` (~2191 tok)
- `Elixir.Expo.MO.UnsupportedVersionError.beam` (~1297 tok)
- `Elixir.Expo.PluralForms.beam` (~2418 tok)
- `Elixir.Expo.PluralForms.Known.beam` (~1872 tok)
- `Elixir.Expo.PluralForms.SyntaxError.beam` (~1254 tok)
- `Elixir.Expo.PluralForms.Tokenizer.beam` (~1339 tok)
- `Elixir.Expo.PO.beam` (~1518 tok)
- `Elixir.Expo.PO.Composer.beam` (~2528 tok)
- `Elixir.Expo.PO.DuplicateMessagesError.beam` (~1523 tok)
- `Elixir.Expo.PO.Parser.beam` (~3773 tok)
- `Elixir.Expo.PO.SyntaxError.beam` (~1260 tok)
- `Elixir.Expo.PO.Tokenizer.beam` (~3413 tok)
- `Elixir.Expo.Util.beam` (~983 tok)
- `Elixir.Inspect.Expo.Message.Plural.beam` (~792 tok)
- `Elixir.Inspect.Expo.Message.Singular.beam` (~793 tok)
- `Elixir.Inspect.Expo.PluralForms.beam` (~643 tok)
- `Elixir.Mix.Tasks.Expo.Msgfmt.beam` (~1319 tok)
- `Elixir.Mix.Tasks.Expo.Msguniq.beam` (~1385 tok)
- `expo_plural_forms_parser.beam` (~8757 tok)
- `expo_po_parser.beam` (~13620 tok)
- `expo.app` (~426 tok)

## _build/dev/lib/file_system/.mix/

- `compile.elixir` (~2633 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/file_system/ebin/

- `Elixir.FileSystem.Backend.beam` (~1622 tok)
- `Elixir.FileSystem.Backends.FSInotify.beam` (~3588 tok)
- `Elixir.FileSystem.Backends.FSMac.beam` (~3662 tok)
- `Elixir.FileSystem.Backends.FSPoll.beam` — Declares directory (~2583 tok)
- `Elixir.FileSystem.Backends.FSWindows.beam` (~3472 tok)
- `Elixir.FileSystem.beam` (~662 tok)
- `Elixir.FileSystem.Worker.beam` (~1817 tok)
- `file_system.app` (~196 tok)

## _build/dev/lib/finch/.mix/

- `compile.elixir` (~2982 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/finch/ebin/

- `Elixir.Finch.beam` (~6787 tok)
- `Elixir.Finch.Error.beam` (~804 tok)
- `Elixir.Finch.HTTP1.Conn.beam` (~4286 tok)
- `Elixir.Finch.HTTP1.Pool.beam` (~4023 tok)
- `Elixir.Finch.HTTP1.Pool.State.beam` (~596 tok)
- `Elixir.Finch.HTTP1.PoolMetrics.beam` (~1357 tok)
- `Elixir.Finch.HTTP2.Pool.beam` (~11552 tok)
- `Elixir.Finch.HTTP2.PoolMetrics.beam` (~1262 tok)
- `Elixir.Finch.HTTP2.RequestStream.beam` (~1597 tok)
- `Elixir.Finch.Pool.beam` (~816 tok)
- `Elixir.Finch.PoolManager.beam` (~3162 tok)
- `Elixir.Finch.Request.beam` (~2297 tok)
- `Elixir.Finch.Response.beam` (~631 tok)
- `Elixir.Finch.SSL.beam` (~652 tok)
- `Elixir.Finch.Telemetry.beam` (~1442 tok)
- `finch.app` (~270 tok)

## _build/dev/lib/gen_smtp/

- `mix.rebar.config` (~363 tok)

## _build/dev/lib/gen_smtp/.mix/

- `compile.fetch` (~0 tok)

## _build/dev/lib/gen_smtp/ebin/

- `binstr.beam` (~2606 tok)
- `gen_smtp_client.beam` (~10125 tok)
- `gen_smtp_server_session.beam` (~15770 tok)
- `gen_smtp_server.beam` (~1428 tok)
- `gen_smtp.app` (~187 tok)
- `mimemail.beam` (~19932 tok)
- `smtp_rfc5322_parse.beam` (~8155 tok)
- `smtp_rfc5322_scan.beam` (~6989 tok)
- `smtp_rfc822_parse.beam` (~5003 tok)
- `smtp_server_example.beam` (~4352 tok)
- `smtp_socket.beam` (~3601 tok)
- `smtp_util.beam` — Declares longnames (~3704 tok)

## _build/dev/lib/gettext/.mix/

- `compile.elixir` (~3123 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/gettext/ebin/

- `Elixir.Gettext.Application.beam` (~549 tok)
- `Elixir.Gettext.Backend.beam` (~1549 tok)
- `Elixir.Gettext.beam` (~5772 tok)
- `Elixir.Gettext.Compiler.beam` (~7414 tok)
- `Elixir.Gettext.Error.beam` (~1065 tok)
- `Elixir.Gettext.Extractor.beam` (~4880 tok)
- `Elixir.Gettext.ExtractorAgent.beam` (~2890 tok)
- `Elixir.Gettext.Fuzzy.beam` (~1400 tok)
- `Elixir.Gettext.Interpolation.beam` (~648 tok)
- `Elixir.Gettext.Interpolation.Default.beam` (~2297 tok)
- `Elixir.Gettext.Macros.beam` (~5916 tok)
- `Elixir.Gettext.Merger.beam` (~4587 tok)
- `Elixir.Gettext.MissingBindingsError.beam` (~1397 tok)
- `Elixir.Gettext.Plural.beam` (~2827 tok)
- `Elixir.Gettext.Plural.UnknownLocaleError.beam` (~939 tok)
- `Elixir.Gettext.PluralFormError.beam` (~1372 tok)
- `Elixir.Mix.Tasks.Compile.Gettext.beam` (~487 tok)
- `Elixir.Mix.Tasks.Gettext.Extract.beam` (~1904 tok)
- `Elixir.Mix.Tasks.Gettext.Merge.beam` (~4219 tok)
- `gettext.app` (~372 tok)

## _build/dev/lib/guardian/.mix/

- `compile.elixir` (~3568 tok)
- `compile.elixir_scm` (~11 tok)
- `compile.fetch` (~0 tok)

## _build/dev/lib/guardian/ebin/

- `Elixir.Guardian.beam` — Declares Elixir (~5604 tok)
- `Elixir.Guardian.Config.beam` (~550 tok)
- `Elixir.Guardian.MalformedReturnValueError.beam` (~1052 tok)
- `Elixir.Guardian.Permissions.AtomEncoding.beam` (~811 tok)
- `Elixir.Guardian.Permissions.beam` (~3044 tok)
- `Elixir.Guardian.Permissions.BitwiseEncoding.beam` (~900 tok)
- `Elixir.Guardian.Permissions.PermissionEncoding.beam` (~466 tok)
- `Elixir.Guardian.Permissions.PermissionNotFoundError.beam` (~1056 tok)
- `Elixir.Guardian.Permissions.Plug.beam` (~1328 tok)
- `Elixir.Guardian.Permissions.TextEncoding.beam` (~840 tok)
- `Elixir.Guardian.Plug.beam` (~5290 tok)
- `Elixir.Guardian.Plug.EnsureAuthenticated.beam` (~1075 tok)
- `Elixir.Guardian.Plug.EnsureNotAuthenticated.beam` (~782 tok)
- `Elixir.Guardian.Plug.ErrorHandler.beam` (~537 tok)
- `Elixir.Guardian.Plug.Keys.beam` (~1217 tok)
- `Elixir.Guardian.Plug.LoadResource.beam` (~1084 tok)
- `Elixir.Guardian.Plug.Pipeline.beam` (~2478 tok)
- `Elixir.Guardian.Plug.SlidingCookie.beam` (~1502 tok)
- `Elixir.Guardian.Plug.UnauthenticatedError.beam` (~1054 tok)
- `Elixir.Guardian.Plug.VerifyCookie.beam` (~1515 tok)
- `Elixir.Guardian.Plug.VerifyHeader.beam` (~2057 tok)
- `Elixir.Guardian.Plug.VerifySession.beam` (~1456 tok)
- `Elixir.Guardian.Token.beam` (~868 tok)
- `Elixir.Guardian.Token.Jwt.beam` — Declares token_type (~4509 tok)
- `Elixir.Guardian.Token.Jwt.SecretFetcher.beam` (~788 tok)
- `Elixir.Guardian.Token.Jwt.SecretFetcher.SecretFetcherDefaultImpl.beam` (~718 tok)
- `Elixir.Guardian.Token.Jwt.Verify.beam` (~1306 tok)
- `Elixir.Guardian.Token.Verify.beam` (~1627 tok)
- `Elixir.Guardian.UUID.beam` (~3038 tok)

## prisma/

- `migrations/20250205_add_user_reading_progress/migration.sql` — Creates Better Auth-era user reading progress table and indexes; no RLS/policies (~300 tok)
- `migrations/20260411023443_add_proof_test_models/migration.sql` — Creates child profiles, child book progress, reading sessions, book questions/options, and question attempts; no RLS/policies (~1800 tok)
- `migrations/20260417120000_add_mobile_analytics_events/migration.sql` — Creates mobile analytics events table/indexes/FKs; no RLS/policies (~600 tok)
- `schema.prisma` — Declares String (~5238 tok)
- `seed.ts` — prisma: main (~3664 tok)

## scripts/

- `backfill-book-pronunciations.ts` — Backfill script: migrate per-page `pages.word_pronunciations` JSON into the (~2700 tok)
- `backfill-pronunciation-metadata.ts` — Backfill `syllables`, `phonetic_display`, and `breakdown_segments` for any (~1477 tok)
- `backfill-pronunciations.ts` — Pronunciation backfill script (Phase 2 — Ticket 2.4). (~1862 tok)
- `ensure-local-db.sh` — Starts local Postgres container, waits for readiness, recreates `storia_dev` if missing (~220 tok)
- `storage-gc.mjs` — Storage GC for the `storia-storage` bucket: lists every object, rebuilds the referenced-path set from pages/books/page_audio_assignments/page_overlay_narrations/book_pronunciations/soundscapes, buckets the difference into tiers A–D, and deletes only with `--delete --tier`. Never touches `audio/**` or `pdfs/**`. (~1794 tok)

## specs/

- `auth-provider-account-mapping-followup.md` — Auth Provider/Account Mapping (Follow-up) (~594 tok)
- `dual-stack-auth-remediation-2026-04-28.md` — Plan: Dual-Stack Auth Remediation (Better Auth Web + Supabase Mobile) (~6424 tok)
- `in-book-questions-phased-plan.md` — Phased implementation plan and decision log for book-attached end-of-book questions across backend, editor, and mobile (~3600 tok)
- `mobile-compat-dual-stack-2026-04-28.md` — Read-only Flutter mobile auth compatibility audit for dual-stack auth remediation, covering Bearer headers, Supabase sessions, service-role env usage, and route-shape dependencies (~1100 tok)
- `parent-recorded-narration-sync.html` — Plan: Parent-Recorded Narration with Synced Word Highlighting (~15004 tok)
- `pronunciation-rich-metadata-and-timing.md` — Plan: Pronunciation Rich Metadata + Per-Segment Audio Timing (~5038 tok)
- `proof-test-schema-and-routes.md` — Plan: Proof-Test Schema Changes & Server Routes (~5188 tok)
- `public-book-editor-improvements.md` — Public Book Editor — Required Improvements (~2089 tok)
- `web-reader-pronunciation-functional-requirements.md` — Web Reader Pronunciation Functional Requirements (~4131 tok)
- `word-pronunciation-cross-platform-spec.md` — Product spec, phased engineering tickets, and schema/API proposal for cross-platform broken-down word pronunciation across Storia web and mobile (~5200 tok)

## specs/audits/

- `specs/audits/dual-stack-auth-audit-2026-04-28.md` — Audit findings for Better Auth web + Supabase mobile dual-stack auth implementation, route adoption, security gaps, and test plan (~2200 tok)

## src/app/

- `HomeClient.tsx` — MorphogenesisHero — renders form (~5295 tok)
- `page.tsx` — metadata (~1161 tok)

## src/app/admin/

- `actions.ts` — Exports createBookDraft (~356 tok)

## src/app/admin/(dashboard)/

- `layout.tsx` — dynamic (~2615 tok)

## src/app/admin/(editor)/books/[id]/edit/

- `page.tsx` — Book editor shell that mounts shared audio elements and composes meta/page/audio/overlay/pronunciation panels around `BookEditorContext`. (~220 tok)

## src/app/admin/books/[id]/pages/[pageNumber]/overlay-editor/

- `page.tsx` — Standalone overlay editor route that fetches/saves one page overlay and destroys the per-page overlay store on exit. (~815 tok)

## src/app/admin/login/

- `page.tsx` — dynamic — renders form (~2433 tok)

## src/app/admin/reports/

- `page.tsx` — Admin reports dashboard client page that fetches headline/trend/top-books/feedback sections from `/api/admin/reports/*` endpoints (~1800 tok)

## src/app/api/admin/audio-assignments/

- `route.ts` — Delete Storage files from their public URLs (best-effort, won't fail the request). (~3050 tok)

## src/app/api/admin/books/

- `route.ts` — Next.js API route: GET, POST (~766 tok)

## src/app/api/admin/books/[id]/pages/[pageNumber]/ocr/

- `route.test.ts` — Vitest coverage for OCR route validation, Replicate mocking, empty-text handling, and timeout paths. (~2800 tok)
- `route.ts` — Next.js API route: POST — runs Replicate OCR on an uploaded illustration, parses detected text, persists `page_overlay_text_entries`. (~3010 tok)

## src/app/api/admin/books/[id]/pages/[pageNumber]/overlay-text/

- `route.test.ts` — Vitest coverage for overlay-text GET and PATCH (replace semantics, include/exclude preservation). (~1500 tok)
- `route.ts` — Next.js API route: GET/PATCH for `page_overlay_text_entries` CRUD. (~1800 tok)

## src/app/api/admin/books/[id]/pronunciations/

- `route.test.ts` — Vitest coverage for editor pronunciation review data aggregation, filter validation, and search/pagination. (~2200 tok)
- `route.ts` — Next.js API route: GET (~1565 tok)

## src/app/api/admin/books/[id]/pronunciations/generate/

- `route.test.ts` — Vitest coverage for standalone pronunciation generation summary/coverage responses and input validation. (~1900 tok)
- `route.ts` — Standalone pronunciation generation endpoint (Phase 2 — Ticket 2.1 & 2.4). (~3169 tok)

## src/app/api/admin/generate-narration/

- `route.ts` — Next.js API route: POST (~3040 tok)

## src/app/api/admin/generate-overlay-narration/

- `route.ts` — Next.js API route: POST (~3010 tok)

## src/app/api/admin/reports/

- `routes.test.ts` — API routes: GET (1 endpoints) (~2016 tok)

## src/app/api/admin/reports/feedback/

- `route.ts` — Next.js API route: GET (~516 tok)

## src/app/api/admin/reports/headline/

- `route.ts` — Next.js API route: GET (~568 tok)

## src/app/api/admin/reports/timeline/

- `route.ts` — Next.js API route: GET (~577 tok)

## src/app/api/admin/reports/top-books/

- `route.ts` — Next.js API route: GET (~623 tok)

## src/app/api/admin/reports/trend/

- `route.ts` — Next.js API route: GET (~386 tok)

## src/app/api/admin/uploads/

- `route.ts` — Next.js API route: POST (~907 tok)

## src/app/api/auth/[...all]/

- `route.ts` — Next.js API route (~230 tok)

## src/app/api/books/

- `route.ts` — Next.js API route: GET with child-aware progress, hasNarration, hasQuestions, hasPronunciations (~3400 tok)

## src/app/api/books/[bookId]/questions/

- `route.ts` — Next.js API route: GET (~365 tok)

## src/app/api/books/[id]/narrations/

- `route.ts` — GET /api/books/[id]/narrations (~413 tok)

## src/app/api/books/[id]/pronunciations/

- `route.test.ts` — Declares makeRow (~1938 tok)
- `route.ts` — Next.js API route: GET (~1487 tok)

## src/app/api/books/[id]/questions/

- `route.ts` — Next.js API route: GET (~360 tok)

## src/app/api/books/[id]/reader/

- `route.ts` — Next.js API route: GET (~1529 tok)

## src/app/api/child-profiles/

- `route.ts` — Next.js API route: GET/POST child profiles with auth, validation (~1100 tok)

## src/app/api/comprehension/

- `route.ts` — Next.js API route: POST (~1569 tok)

## src/app/api/continue-reading/

- `route.ts` — Next.js API route: GET (~596 tok)

## src/app/api/narrations/pages/

- `route.test.ts` — The route only ever touches `request.formData()`, so the form is handed over (~2109 tok)
- `route.ts` — POST /api/narrations/pages (~1672 tok)

## src/app/api/narrations/tracks/

- `route.ts` — GET /api/narrations/tracks?bookId=123 — the caller's own tracks. (~1002 tok)

## src/app/api/narrations/tracks/[trackId]/

- `route.ts` — PATCH /api/narrations/tracks/[trackId] — rename, or mark ready. (~951 tok)

## src/app/api/reading-progress/

- `route.ts` — Next.js API route: GET/POST with child-aware + legacy user-based progress (~3500 tok)

## src/app/api/reading-sessions/

- `route.ts` — Next.js API route: POST reading session with upsert by sessionId (~1800 tok)

## src/app/api/reports/summary/

- `route.test.ts` — API routes: GET (1 endpoints) (~2523 tok)
- `route.ts` — Next.js API route: GET (~3133 tok)

## src/app/books/[id]/reader/

- `page.tsx` — BookReader (~10974 tok)

## src/app/reports/

- `ReportsClient.test.tsx` — useSessionMock (~2553 tok)
- `ReportsClient.tsx` — RANGE_OPTIONS (~8501 tok)

## src/components/

- `IntegratedIllustration.test.tsx` — overlay (~1644 tok)
- `IntegratedIllustration.tsx` — usePreloadImage (~3803 tok)
- `MorphogenesisHero.tsx` — APP_STORE_URL (~7286 tok)
- `StoriaCalmLanding.tsx` — MANIFESTO_WORDS (~8413 tok)

## src/components/editor/

- `AudioLibraryPanel.tsx` — Book editor side panel for browsing audio assets, assigning narration/soundscape to pages, and preview playback state. (~2378 tok)
- `BookMetaPanel.tsx` — Book editor header panel for title/author inline editing plus save/publish status/actions. (~560 tok)
- `NarrationPanel.tsx` — Book editor panel for per-page narration generation, preview, and progress/error controls. (~1036 tok)
- `OverlayEditorPanel.tsx` — Wraps overlay editor launch/composite status for the active page inside the main editor. (~657 tok)
- `OverlayTextPanel.tsx` — Editable overlay-text list for OCR-detected on-image text: edit, reorder, include/exclude from narration, retry OCR. (~520 tok)
- `PronunciationPanel.tsx` — pageStatusDot (~8274 tok)

## src/components/text-overlay/

- `DraggableTextOverlayEditor.tsx` — OVERLAY_EDITOR_AUTOSAVE_DEBOUNCE_MS (~3859 tok)
- `Toolbar.tsx` — Overlay editor toolbar showing save/composite status and actions like add text, undo/redo, and composite export. (~668 tok)

## src/contexts/

- `BookEditorContext.overlay-narration.integration.test.tsx` — Integration tests for provider narration generation branches, especially overlay multivoice and selected-text flows. (~661 tok)
- `BookEditorContext.overlay-regression.test.tsx` — Regression tests for overlay store remapping/preservation across page reorder and delete operations. (~498 tok)
- `BookEditorContext.tsx` — Central editor orchestration provider for pages, dirty/autosave flows, audio assignment/generation, overlay composite state, and reader-style previews. (~4422 tok)

## src/hooks/

- `useAdminReports.test.tsx` — Vitest/React Query coverage that admin reports hooks fetch `/api/admin/reports/*` and never legacy child-scoped `/api/reports/summary|analytics` endpoints (~700 tok)
- `useAdminReports.ts` — React Query hooks for admin reports dashboard sections; fetches `/api/admin/reports/*` endpoints with range/limit/category params (~320 tok)
- `useBookData.ts` — React Query hooks for editor book/pages/audio CRUD, narration generation, and shared API types used by `BookEditorContext`. (~1689 tok)
- `useOverlayEditor.ts` — Zustand-backed overlay editor hook exports and selectors used by the draggable text canvas. (~114 tok)
- `usePronunciationManifest.test.tsx` — Covers manifest absent, present, and fetch-failure states for the shipping hook (~1900 tok)
- `usePronunciationManifest.ts` — Exports PronunciationManifestResult, usePronunciationManifest (~708 tok)
- `useSoundLibrary.ts` — React Query hooks for sound library browsing plus audio upload helpers for the editor. (~181 tok)
- `useWordPronunciation.test.tsx` — waitForMountEffectsToSettle (~6953 tok)
- `useWordPronunciation.ts` — WR-9.4: called exactly once when the first `AudioBufferSourceNode.start()` (~6529 tok)

## src/lib/

- `admin-reports-prisma.test.ts` — Vitest coverage for dedicated admin reports Prisma connection selection/fallback (~500 tok)
- `admin-reports-prisma.ts` — Dedicated admin reports Prisma client using ADMIN_REPORTS_DATABASE_URL when configured, otherwise shared Prisma fallback (~220 tok)
- `auth-client.ts` — Create client instance using type assertion to bypass TypeScript issues (~310 tok)
- `auth.ts` — DEBUG: Log the actual DATABASE_URL at import time (~1520 tok)
- `child-auth.test.ts` — Direct dual-stack auth helper tests for Better Auth cookies, Supabase Bearer/raw token parsing, verified-email linking, and child access authorization (~2500 tok)
- `child-auth.ts` — Env contract: requires SUPABASE_SERVICE_ROLE_KEY (server-only) and SUPABASE_URL (or NEXT_PUBLIC_SUPA (~1856 tok)
- `elevenlabs.ts` — Extract the storage file path from a Supabase public URL. (~3200 tok)
- `mobile-compat/normalize.ts` — Converts web overlay shadow fields into the mobile Flutter overlay JSON shape before persistence. (~189 tok)
- `overlayText.test.ts` — Vitest coverage for Replicate OCR output parser (preamble strip, quoted-line extraction, empty case) and narration-input assembly. (~800 tok)
- `overlayText.ts` — Pure helpers for overlay text: `parseReplicateOcrOutput`, `assemblePageNarrationText`, `extractPageNarrationTokens`, `includedOverlayText`. (~520 tok)
- `prisma.ts` — Shared PrismaClient singleton using DATABASE_URL; logs query/error/warn in development and error in production (~150 tok)
- `pronunciation.test.ts` — Declares WordPronunciationEntry (~2227 tok)
- `pronunciation.ts` — True if the entry has at least one usable audio URL. (~1632 tok)
- `pronunciationAnalytics.test.ts` — PronunciationAnalyticsEvent: makeUmamiSpy (~1922 tok)
- `pronunciationAnalytics.ts` — Pronunciation analytics helper — Part 1 of WR-9 / FR-WEB-37–39. (~1374 tok)
- `pronunciationGeneration.test.ts` — BookPronunciationRow: fakeSupabase, makeRow (~5861 tok)
- `pronunciationGeneration.ts` — Shared pronunciation generation pipeline (Phase 2 — Ticket 2.1 / 2.2 / 2.3). (~5385 tok)
- `pronunciationMetadata.test.ts` — Declares segs (~1756 tok)
- `pronunciationMetadata.ts` — Pure helpers for pronunciation metadata: chunk segmentation, syllabification, (~2293 tok)
- `pronunciationReview.test.ts` — Vitest coverage for per-word review aggregation, metadata shaping, and filter/pagination behavior. (~1500 tok)
- `pronunciationReview.ts` — Shape of a row returned from `prisma.book_pronunciations.findMany` (subset of (~3566 tok)
- `pronunciationValidation.test.ts` — ValidationResult: mapOf (~3700 tok)
- `pronunciationValidation.ts` — Publish-time pronunciation manifest validator (Ticket 1.3). (~1807 tok)
- `saveCoordinator.ts` — Barrel export for the editor SaveCoordinator boundary in `src/lib/editor/saveCoordinator.ts` (~10 tok)

## src/lib/editor/

- `saveCoordinator.test.ts` — Boundary tests for SaveCoordinator debounce reset, retry/error, and overlay-before-book ordering (~2200 tok)
- `saveCoordinator.ts` — Pure editor save coordinator with debounced autosave, dirty/status snapshots, retry, and overlay-before-book save ordering (~3650 tok)

## src/lib/narration/

- `alignRecording.test.ts` — TOKENS: args (~1577 tok)
- `alignRecording.ts` — Turns a recorded audio file plus the page's reference words into a timestamp (~1446 tok)
- `fallbackTiming.test.ts` — Declares result (~528 tok)
- `fallbackTiming.ts` — Deterministic duration-proportional word timings. (~541 tok)
- `referenceWords.test.ts` — PARITY FIXTURE — mirrored by the Dart test in storia-mobile (~747 tok)
- `referenceWords.ts` — Canonical render-order tokenizer for a page's words. (~948 tok)
- `storage.ts` — Storage helpers for parent-recorded narration. (~1000 tok)
- `tracks.ts` — Shared serialization + ownership checks for the narration routes. (~993 tok)

## src/lib/reports/

- `agg.default-client.test.ts` — Vitest coverage that default reportAgg uses the admin reports Prisma client for platform-wide headline metrics (~800 tok)
- `agg.test.ts` — Mock: makePrisma (~2538 tok)
- `agg.ts` — Exports VALID_RANGES, ReportRange, ParsedRange, HeadlineData + 9 more (~4649 tok)
- `csv.test.ts` — Declares Row (~354 tok)
- `csv.ts` — Exports CsvCell, CsvColumn, toCsvRow, toCsv (~186 tok)
- `eventCatalog.test.ts` — API routes: DELETE (2 endpoints) (~2228 tok)
- `eventCatalog.ts` — Translate a row from one analytics-bearing table into one or more (~3451 tok)
- `timeline.default-client.test.ts` — Vitest coverage that loadTimeline uses the admin reports Prisma client for cross-parent admin visibility (~850 tok)
- `timeline.test.ts` — Mock: makePrisma, isoMinusMin (~1905 tok)
- `timeline.ts` — Exports TIMELINE_DEFAULT_LIMIT, TIMELINE_MAX_LIMIT, TimelineFilters, TimelinePage, loadTimeline (~1567 tok)

## src/stores/

- `overlayEditorRegistry.ts` — Registry helpers that lazily create, destroy, and remap per-page overlay editor Zustand stores. (~184 tok)
- `overlayEditorStore.ts` — Zustand state/actions for overlay elements, selection, undo/redo, dirty flags, autosave status, and container measurements. (~377 tok)

---
# Configuration consumed by ./bin/pi-symphony.sh — a Pi-native Linear orchestrator
# inspired by OpenAI Symphony but using Pi (`pi chain ...`) instead of Codex.
# These keys are documentation; the script reads env vars (LINEAR_API_KEY,
# PROJECT_SLUG, WORKSPACES, POLL_S, MAX_PARALLEL, PI_CHAIN, AGENT_RUNNER,
# AGENT_FALLBACKS). Override at launch:
#   PROJECT_SLUG=... POLL_S=15 MAX_PARALLEL=2 ./bin/pi-symphony.sh
runner: pi-symphony
tracker:
  kind: linear
  project_slug: "storia-web-ccc39fafc20d"
  active_states:
    - Todo
    - In Progress
  review_state: In Review
  terminal_states:
    - Done
    - Canceled
    - Duplicate
    - Backlog
polling:
  interval_s: 15
workspace:
  root: ~/code/storia-web-symphony-workspaces
agent:
  max_concurrent_agents: 2
  pi_chain: plan-build-review
  bootstrap: ./bin/bootstrap.sh
  verify: ./bin/verify.sh
  e2e: ./bin/e2e.sh
---

## How this gets dispatched

`./bin/pi-symphony.sh` polls Linear for tickets in `Todo`, creates an isolated git worktree under `~/code/storia-web-symphony-workspaces/<ID>`, and invokes the configured agent runner (default: `pi chain plan-build-review`) with the ticket title + URL + description as input. Optional `AGENT_FALLBACKS=claude,opencode` support can try Claude Code or OpenCode if the primary runner is unavailable or fails. This file is the SOP that agents should follow inside that worktree. Pi's planner agent should `read` this file as part of its planning step.

Ticket fields the runner injects into the pi prompt:

- Identifier (e.g. `STO-123`)
- Title
- URL
- Description

## Operating mode

1. This is an unattended pi-symphony orchestration session. Do not ask a human to perform follow-up work unless there is a true external blocker.
2. Work only inside the provided git-worktree copy of `storia`. Do not touch files outside the worktree.
3. Keep changes narrowly scoped to the Linear ticket. Avoid unrelated refactors.
4. Use one persistent Linear workpad comment as the source of truth for plan, acceptance criteria, validation, notes, and blockers. Marker header: `## Symphony Workpad`.
5. Final response must report completed actions and blockers only. Do not include optional next steps for the user.

## Unattended decision policy

Linear tickets processed by `pi-symphony` are pre-authorized for bounded product and technical decisions. If another repo skill or workflow says to ask for design/spec/plan approval or offers an interactive choice between safe execution modes, treat this policy plus the Linear ticket as that approval unless the decision meets the blocker criteria below.

Agents may choose an approach and continue when all of these are true:

- the choice stays within the Linear ticket scope,
- existing product behavior and public data contracts are preserved unless the ticket asks to change them,
- the implementation is localized and reversible,
- the decision can be validated with tests, typecheck/lint, or a smoke check,
- it does not require secrets, payment/billing changes, destructive data migrations, legal/policy judgment, or broad product expansion.

When multiple approaches are plausible:

1. Choose the narrowest safe implementation.
2. Prefer backward-compatible data/API shapes.
3. Prefer inline/local execution over spawning extra agents unless the task is clearly parallelizable.
4. Avoid coupling unrelated systems.
5. Add or update validation for the chosen behavior when practical.
6. Record the decision, rejected alternatives, and rationale in the workpad/PR instead of pausing for approval.

Only mark a ticket blocked when requirements are contradictory, required credentials/services are unavailable, destructive data-loss risk exists, security/privacy/payment/legal policy is unclear, or the ticket cannot be completed without materially expanding scope.

## Linear access

The runner (`bin/pi-symphony.sh`) handles Linear state transitions, workpad comment creation, and PR opening. Pi agents do not need direct Linear API access. If pi needs to add notes during execution, write them to the workpad section of the working branch's commit message — the runner appends them.

## Repo context

Loratone (web) is a Next.js 16 app for Loratone Kids — App Router, React 19, Prisma + Postgres, Better Auth, Supabase, Tailwind, GSAP/Three/Framer Motion for the reader UI, Vitest for tests.

Important repo files and conventions:

- `CLAUDE.md` points at `.wolf/OPENWOLF.md` — the OpenWolf context system. **Read it first.**
- `.wolf/anatomy.md` is the file-by-file map of the repo. Read before opening unfamiliar files.
- `.wolf/cerebrum.md` holds project preferences, learnings, and the Do-Not-Repeat list. Read before generating code.
- `.wolf/buglog.json` records known fixes — read before fixing any bug, append after fixing.
- `package.json` defines scripts: `dev`, `build`, `lint`, `test` (vitest), `db:up`, `db:prepare`, `db:seed`. The `predev` hook runs `db:prepare` automatically.
- `prisma/schema.prisma` is the data model. Migrations live under `prisma/migrations/`. Run `npx prisma generate` after schema edits.
- `next.config.ts` and `tsconfig.json` are the Next.js and TypeScript configs.
- `vitest.config.ts` configures unit tests. New tests follow the colocation pattern used in `src/`.
- `src/` is the source root (App Router under `src/app/`, shared code under `src/lib/`, components under `src/components/`).
- `bin/bootstrap.sh` is the canonical env setup. `bin/verify.sh` is the canonical pre-handoff check (tsc + lint + test).
- `.pi/` contains the Pi Coding Agent harness: orchestrator, teams, pipelines, and skills. `.claude/` mirrors agent + skill content for Claude Code.
- `specs/` and `docs/` hold feature plans and architecture notes — read the matching one before non-trivial feature work.
- `scripts/` contains repo maintenance scripts (e.g. `ensure-local-db.sh`, pronunciation backfills). Don't duplicate them; extend.
- The repo uses **OpenWolf rules** (see `.claude/rules/openwolf.md`): update `.wolf/anatomy.md` after writing files, append to `.wolf/memory.md`, log corrections to `.wolf/cerebrum.md`, and log bugs to `.wolf/buglog.json`.

## Available repo harnesses

### Pi Coding Agent CLI

This repo includes a minimal tracked Pi Coding Agent harness. Use the `pi` CLI for repo-local planning, audits, or specialized work.

Available chains (see `.pi/agents/agent-chain.yaml`):

```bash
pi chain plan-build-review "Plan, build, and review the Linear issue"
pi chain plan-build         "Faster: plan + build, no review"
pi chain full-review        "Scout → plan → build → review"
pi chain scout-flow         "Triple-scout deep recon"
pi chain plan-review-plan   "Iterate on a plan via critique"
```

The runner has already invoked the configured agent runner to start this session. Use additional `pi chain` invocations only if the ticket genuinely needs a different chain (e.g. `scout-flow` for unfamiliar code paths).

### Playwright CLI self-verification

`playwright-cli` is available globally for browser-verifiable flows, screenshots, traces, and WebM video proof. Loratone is a web app — Playwright is the primary visual-proof tool.

```bash
playwright-cli open http://localhost:3000
playwright-cli tracing-start
playwright-cli video-start
# perform browser actions
playwright-cli video-stop --filename=recordings/<flow>.webm
playwright-cli tracing-stop
```

Prefer Vitest unit tests for pure logic. Use Playwright when the change has a visual or end-to-end surface. Record artifact paths in the workpad and PR.

## Status map (matches the live Linear workflow on this project)

- `Backlog` -> out of scope for this workflow; do not modify.
- `Todo` -> runner moves to `In Progress` and dispatches pi.
- `In Progress` -> pi is working in the worktree. Resume only if a local worktree exists.
- `In Review` -> agent finished (with PR opened) or is blocked. Humans drive merge/feedback from here.
- `Done`, `Canceled`, `Duplicate` -> terminal; do nothing.

> Note: this Linear setup has no `Rework`, `Merging`, or `Human Review` states. PR review feedback should be addressed by re-opening or commenting on the existing PR; if you need a Rework flow, add the state in Linear and set `STATE_REWORK=Rework` in the runner env.

## Step 0: Route by ticket state

1. The runner has already moved the ticket to `In Progress` and created a fresh `## Symphony Workpad` comment. Read both the ticket body and the existing workpad before doing anything else.
2. If state is `Backlog`, do not modify; stop. (You should not see Backlog tickets — the runner filters them.)
3. If a PR is already attached to the ticket, inspect PR comments/reviews/checks before new changes.
4. Record a compact environment stamp in the workpad:

```text
<hostname>:<abs-workdir>@<short-sha>
```

## Step 1: Plan before editing

Before code changes:

1. Read the ticket body and all comments.
2. Read `.wolf/anatomy.md` for the file map, then `.wolf/cerebrum.md` for preferences. If a matching plan exists in `specs/` or `docs/`, read it before designing.
3. If the ticket is a bug, read `.wolf/buglog.json` for known fixes before debugging. After fixing, append a new entry.
4. Update the workpad with:
   - plan checklist,
   - acceptance criteria,
   - validation checklist,
   - risks/confusions,
   - current environment stamp.
5. Reproduce or confirm the current behavior before changing code whenever possible.
6. Run `git fetch origin` and merge/rebase latest `origin/main` before implementation when safe; record the result.
7. Keep the workpad current throughout execution. Do not create separate progress comments.

## Step 2: Implementation rules

1. Match existing Next.js App Router patterns in `src/app/`. Server components by default; client components only when needed (`"use client"` at the top).
2. Database access goes through Prisma (`src/lib/prisma` or equivalent). Don't bypass with raw `pg` unless the existing code already does.
3. Auth uses Better Auth — see `src/lib/auth` (and any `auth.ts` files). Don't reimplement session logic.
4. Style with Tailwind. Reuse design tokens and shared components from `src/components/` before creating new ones.
5. Don't introduce new state libraries — the repo uses React Query (`@tanstack/react-query`) and React 19 hooks. Animations: GSAP, Framer Motion, or Motion (already installed).
6. Keep server/client boundaries clean. Don't import server-only modules (`fs`, `pg`, `prisma`) into client components.
7. If the ticket touches auth, payments, Supabase, audio/TTS, reader runtime, or Three.js scenes, read matching `specs/` or `docs/` notes first.
8. If meaningful out-of-scope improvements are found, file a separate Linear Backlog issue instead of expanding scope.
9. After file writes, follow `.claude/rules/openwolf.md`: update `.wolf/anatomy.md` and append to `.wolf/memory.md`.

## Step 3: Validation requirements

Choose the narrowest validation that proves the change, then run broader checks before handoff when practical.

Primary web validation (canonical pre-handoff gate):

```bash
./bin/verify.sh    # tsc --noEmit + npm run lint + npm test
./bin/e2e.sh       # playwright E2E tests (mandatory — must pass before PR)
```

Targeted runs while iterating:

```bash
npx tsc --noEmit
npm run lint
npm test -- src/path/to/specific.test.ts
```

Manual smoke / preview when a ticket is UI-relevant:

```bash
npm run dev        # localhost:3000 (Next.js dev server)
npm run build      # production build incl. prisma generate + next build
```

### Mandatory: Playwright video proof + E2E tests

Every symphony ticket MUST produce:

1. **E2E tests passing** — `./bin/e2e.sh` runs Playwright specs in `e2e/` and is enforced by the runner. A failing E2E test is a blocker; no PR is opened.
2. **At least one Playwright `.webm` video** recording the changed flow. File it at `recordings/<TICKET-ID>-<flow>.webm`.

```bash
npm run dev &
# Wait for server to be ready, then:
mkdir -p recordings
playwright-cli open http://localhost:3000
playwright-cli tracing-start
playwright-cli video-start
# drive the changed flow end-to-end
playwright-cli video-stop --filename=recordings/<TICKET-ID>-<flow>.webm
playwright-cli tracing-stop
playwright-cli close
```

Rules:

- Backend-only / non-UI tickets still need a video demonstrating the smallest user-visible surface impacted, or `REQUIRE_VIDEO=0` set with written justification in the workpad.
- The video must reflect post-change behavior. Re-record if the agent re-runs.
- Record exact filename(s) in the workpad `### Validation` section and in the PR body.
- Do not commit `recordings/` unless asked — it is for symphony artifacts and PR review only.

Database-touching changes:

```bash
npm run db:up                          # start local Postgres via docker compose
npx prisma migrate dev --name <change> # if schema changed
npm run db:seed                        # if seeded data is needed
```

Record exact commands and outcomes in the workpad. If validation fails, fix or document a true blocker before handoff.

## PR and review flow

1. Commit logical changes with clear messages.
2. Push a branch for the ticket.
3. Open or update a GitHub PR and link it to the Linear issue.
4. Add the `symphony` label to the PR when possible.
5. Before moving to `In Review`:
   - all acceptance criteria are checked,
   - required validation is checked with command evidence,
   - **at least one `recordings/<TICKET-ID>-*.webm` Playwright video exists and is referenced in the PR body and workpad** (or `REQUIRE_VIDEO=0` is set with a written justification),
   - PR checks are green or blocker is documented,
   - PR comments/reviews have no outstanding actionable feedback,
   - the workpad reflects the latest plan, validation, and handoff notes.
6. Move the Linear issue to `In Review` only after the completion bar is met.

## PR feedback sweep protocol

When a PR exists:

1. Gather top-level PR comments, inline review comments, review summaries, and check results.
2. Treat every actionable human or bot comment as blocking until addressed in code/tests/docs or explicitly answered with justified pushback.
3. Update the workpad checklist with each feedback item and resolution.
4. Re-run relevant validation after feedback changes.
5. Repeat until no outstanding actionable feedback remains.

## Blocked-access escape hatch

Use this only for missing required tools, auth, permissions, secrets, or external services that cannot be resolved in-session.

If blocked:

1. Keep or create the workpad.
2. Record:
   - what is missing,
   - why it blocks acceptance/validation,
   - exact human action required to unblock.
3. Move to `In Review` only when the blocker prevents further autonomous progress.

## Workpad template

Use this exact structure and update it in place:

````md
## Symphony Workpad

```text
<hostname>:<abs-path>@<short-sha>
```

### Plan

- [ ] 1. Parent task
  - [ ] 1.1 Child task
  - [ ] 1.2 Child task
- [ ] 2. Parent task

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

### Validation

- [ ] `<command>` — expected proof

### Notes

- <timestamped short progress note>

### Confusions

- <only include when something was unclear during execution>
````

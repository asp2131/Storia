# AGENTS.md

Cold-start guide for autonomous agents working in Storia web.

## Boot

```bash
./bin/bootstrap.sh
```

The bootstrap is idempotent: it installs npm dependencies, provisions `.env.local` and `.env` from an existing local env file or `.env.example`, and runs `prisma generate` when available.

## Verify before handoff

```bash
./bin/verify.sh
```

This runs TypeScript, ESLint, and Vitest. Use targeted commands while iterating, then run the full gate when practical.

## Repo map

- `src/app/` — Next.js App Router pages and API routes.
- `src/components/` — shared UI components.
- `src/lib/` — auth, Prisma, Supabase/storage, and server/client utilities.
- `prisma/` — schema, migrations, and seed data.
- `scripts/` — maintenance/backfill scripts.
- `bin/` — setup, verification, and Symphony/Linear runner scripts.
- `.pi/` — minimal repo-local Pi Coding Agent harness.
- `WORKFLOW.md` — Linear/Symphony orchestration SOP.
- `.wolf/` — OpenWolf memory and generated context. Do not edit unless explicitly asked.

## Conventions

- Keep changes narrow to the ticket; avoid unrelated refactors.
- Do not commit secrets. Local `.env*` files are ignored; `.env.example` is the only env file intended for git.
- Use existing Next.js App Router, Prisma, Better Auth, Supabase, Tailwind, and Vitest patterns.
- Keep server/client boundaries clean: do not import server-only modules into client components.
- Run `npx prisma generate` after Prisma schema changes.
- For bug fixes, inspect `.wolf/buglog.json` and `.wolf/cerebrum.md` for known project pitfalls, but do not modify `.wolf` files unless the ticket explicitly calls for it.

## Agent harness

Primary unattended flow:

```bash
pi chain plan-build-review "<ticket or task text>"
```

Other local chains are defined in `.pi/agents/agent-chain.yaml`. `bin/pi-symphony.sh` invokes the chain from Linear tickets and runs `./bin/verify.sh` before opening a PR.

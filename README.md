# Storia

Storia is an immersive reading platform that combines ebooks, narration, and soundscapes into a single reader experience.

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Prisma + PostgreSQL (Supabase-compatible)
- Better Auth
- Supabase Storage for PDFs/audio/media
- Replicate for narration generation
- Vitest + Testing Library for tests

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (for the local Postgres container) or a PostgreSQL database/Supabase project
- Supabase storage bucket(s)
- Replicate API token (for narration features)

### Install

```bash
./bin/bootstrap.sh
```

`bootstrap.sh` is idempotent. It installs npm dependencies, provisions `.env.local` and `.env` from `STORIA_ENV_FILE`, an existing main-worktree env file, or `.env.example`, then runs `prisma generate` when available. Use `npm install` directly only when you intentionally want to bypass the repo setup script.

### Environment Variables

Create `.env.local` in the project root (or run `./bin/bootstrap.sh` to create/link `.env.local` and `.env` automatically):

```bash
# Database (required by Prisma + auth)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (client + server)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=storia-storage

# Optional dedicated soundscape paths
SUPABASE_SOUNDSCAPE_BUCKET=storia-storage
SUPABASE_SOUNDSCAPE_BASE_PATH=audio/curated
NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BUCKET=storia-storage
NEXT_PUBLIC_SUPABASE_SOUNDSCAPE_BASE_PATH=audio/curated

# Narration / AI
REPLICATE_API_TOKEN=<replicate-token>
# Optional fallback key name used in some routes
REPLICATE_KEY=<replicate-token>

# Auth / email
RESEND_API_KEY=<resend-key>
RESEND_FROM_EMAIL=Storia <onboarding@resend.dev>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>

# Optional analytics
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<website-id>
NEXT_PUBLIC_UMAMI_URL=https://cloud.umami.is/script.js
```

### Database Setup

For local development, `npm run dev` now auto-starts a Dockerized Postgres instance on `localhost:5433`, recreates the `storia_dev` database if it was deleted, and applies Prisma migrations.

```bash
npm run dev
```

Useful database commands:

```bash
npm run db:up      # start local Postgres only
npm run db:down    # stop the local Postgres stack
npm run db:logs    # tail Postgres logs
npm run db:seed    # seed local data
```

If you prefer managing the database manually instead of Docker:

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

### Run the App

```bash
npm run dev
```

Open `http://localhost:3000`.

## Common Commands

```bash
# One-shot setup for humans and agent worktrees
./bin/bootstrap.sh

# Pre-handoff verification gate
./bin/verify.sh

# Development
npm run dev

# Production build
npm run build
npm run start

# Linting
npm run lint

# Testing
npm run test
npm run test:watch

# Linear/Symphony runner (requires LINEAR_API_KEY)
./bin/pi-symphony.sh --once

# Database seed
npm run db:seed
```

## Agent Harness (Pi Coding Agent)

This repo tracks a minimal `.pi/` harness so fresh clones and Symphony-created worktrees can run the same local agent chains. Runtime/session/cache data under `.pi/agent-sessions`, `.pi/agent`, `.pi/cache`, `.pi/logs`, `.pi/tmp`, and `.pi/worktrees` stays ignored.

Useful commands:

```bash
pi chain plan-build-review "Plan/build/review: <ticket>"
pi chain plan-build "Plan/build only: <ticket>"
pi chain scout-flow "Explore: <area>"
```

`bin/pi-symphony.sh` polls Linear, creates isolated worktrees, runs `./bin/bootstrap.sh`, dispatches the configured agent runner, then runs `./bin/verify.sh` before opening a PR.

Default runner configuration:

```bash
AGENT_RUNNER=pi \
PI_CHAIN=plan-build-review \
./bin/pi-symphony.sh --once
```

Optional fallback runners are supported without shell `eval`; runner commands are invoked as fixed argv arrays. Supported names are `pi`, `claude`, and `opencode`:

```bash
AGENT_RUNNER=pi \
AGENT_FALLBACKS=claude,opencode \
./bin/pi-symphony.sh
```

For Claude Code fallback, install and authenticate the `claude` CLI. For OpenCode fallback, install and authenticate the `opencode` CLI. Fallback prompts instruct the alternate runner to follow `AGENTS.md` and `WORKFLOW.md` in the current worktree.

## Background Worker (Audio Preprocessing)

For long-running narration/audio jobs, run the worker separately:

```bash
API_BASE_URL=http://localhost:3000 \
WORKER_SECRET_TOKEN=dev-secret \
node worker/audio-worker.js
```

Docker-based local setup is available in `worker/docker-compose.yml`.

## Project Structure

- `src/app` - App Router pages and API routes
- `src/components` - Shared UI components
- `src/lib` - Server/client utilities (auth, Prisma, Supabase, storage)
- `prisma` - Prisma schema, migrations, and seed scripts
- `worker` - Background audio preprocessing worker
- `docs` - Product, architecture, and implementation docs
- `bin` - Bootstrap, verification, and Linear/Symphony runner scripts
- `.pi` - Minimal tracked Pi Coding Agent harness (runtime data ignored)

## Docs

- `docs/IMPLEMENTATION_QUICKSTART.md`
- `docs/AUDIO_PREPROCESSING_ARCHITECTURE.md`
- `docs/TEXT_OVERLAY_SETUP.md`
- `docs/front-end-spec.md`
- `docs/prd.md`

## Notes

- This repository currently contains legacy docs that reference previous architecture choices; prefer the docs linked above for the current Next.js stack.
- Keep secrets in local/hosted environment variables and never commit them to git. `.env.example` is a template only; local `.env*` files remain ignored.

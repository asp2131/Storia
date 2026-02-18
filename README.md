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
- PostgreSQL database (or Supabase project)
- Supabase storage bucket(s)
- Replicate API token (for narration features)

### Install

```bash
npm install
```

### Environment Variables

Create `.env.local` in the project root (or use your preferred env loading setup):

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

# Database seed
npm run db:seed
```

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

## Docs

- `docs/IMPLEMENTATION_QUICKSTART.md`
- `docs/AUDIO_PREPROCESSING_ARCHITECTURE.md`
- `docs/TEXT_OVERLAY_SETUP.md`
- `docs/front-end-spec.md`
- `docs/prd.md`

## Notes

- This repository currently contains legacy docs that reference previous architecture choices; prefer the docs linked above for the current Next.js stack.
- Keep secrets in local/hosted environment variables and never commit them to git.

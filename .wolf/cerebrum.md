# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-03-25

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->
- User asked to use a team of agents for implementation/audits instead of solo execution when possible.

## Key Learnings

- **Project:** frontend
- **Description:** Storia is an immersive reading platform that combines ebooks, narration, and soundscapes into a single reader experience.
- Overlay editor state is keyed by `page.id` for saved pages and `page-${number}` for unsaved pages, so any renumber operation (reorder/delete) must remap registry keys for unsaved pages.
- Reorder flows that only change active page index to follow the same logical page should preserve the current overlay store (do not destroy on index-only navigation).
- In Vitest React context tests, mocked hook return objects should be stable references across renders; recreating `data` arrays each render can trigger sync effects repeatedly and cause render-loop/OOM behavior.
- Local dev now boots Prisma against a Dockerized Postgres on `localhost:5433`; `npm run dev` runs `db:prepare` first to ensure `storia_dev` exists and apply migrations before Next starts.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- 2026-03-25: Keep per-page overlay stores in a registry and remap keys on reorder/delete; for reorder-induced active-page index shifts, preserve current store to avoid deleting remapped keys or losing unsaved overlay edits.
- 2026-03-27: Replaced naive JS MP3 buffer concatenation with ffmpeg-static (child_process.execFile). Chose over: (a) @ffmpeg/ffmpeg WASM — browser-only, can't run in Vercel serverless, (b) Xing header stripping — insufficient, frame parameter mismatches between silence and real audio still break browsers, (c) sequential playback — would require Flutter mobile reader changes. ffmpeg concat filter decodes all inputs to PCM and re-encodes, producing spec-compliant output.
- 2026-04-07: Local development uses a root `docker-compose.yml` Postgres service plus `scripts/ensure-local-db.sh`, wired into `predev`/`db:prepare`. Chose `localhost:5433` instead of `5432` because the host already had port 5432 allocated, and the workflow needs to auto-recreate `storia_dev` if the database is dropped.

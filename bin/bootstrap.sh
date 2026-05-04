#!/usr/bin/env bash
# bootstrap.sh — one-shot dev env setup for storia (web).
# Used by pi-symphony's per-worktree setup and by humans on a fresh clone.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "[bootstrap] repo: $repo_root"

if ! command -v node >/dev/null 2>&1; then
  echo "[bootstrap] node not on PATH. Install Node.js (see .tool-versions) and re-run." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[bootstrap] npm not on PATH." >&2
  exit 1
fi

# Reuse parent repo's node_modules via npm ci when lockfile present, else npm install.
if [ -f package-lock.json ]; then
  echo "[bootstrap] npm ci"
  npm ci --no-audit --no-fund
else
  echo "[bootstrap] npm install"
  npm install --no-audit --no-fund
fi

# Prisma client generate (offline, no DB required). Skip if prisma not present.
if [ -d prisma ] && [ -x node_modules/.bin/prisma ]; then
  echo "[bootstrap] prisma generate"
  npx prisma generate >/dev/null
fi

# Seed .env from parent repo if missing — symphony worktrees inherit parent secrets.
if [ ! -f .env ] && [ -f "$repo_root/../.env" ]; then
  echo "[bootstrap] copying parent .env into worktree (symlink)"
  ln -s "$repo_root/../.env" .env
fi

echo "[bootstrap] done"

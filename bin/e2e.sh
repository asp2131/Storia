#!/usr/bin/env bash
# e2e.sh — Run Playwright E2E tests and collect artifacts.
# Called by verify.sh (or manually) after services are up.
#
# Prerequisites (started by bootstrap.sh or the caller):
#   - Postgres on localhost:5433 (storia_dev DB)
#   - Mailpit on localhost:8025/1025
#   - Next.js dev server on localhost:3000
#
# Output:
#   test-results/          — videos, traces, screenshots on failure
#   playwright-report/     — HTML report
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

die() { echo "[e2e] $*" >&2; exit 1; }

# Check prerequisites
if ! command -v npx >/dev/null; then die "npx not on PATH"; fi
if ! curl -sf http://localhost:3000 > /dev/null 2>&1; then
  die "Next.js dev server not running on localhost:3000; start with 'npm run dev'"
fi
if ! curl -sf http://localhost:8025 > /dev/null 2>&1; then
  die "Mailpit not running on localhost:8025; start with 'docker compose up -d mailpit'"
fi

echo "[e2e] Running Playwright E2E tests..."
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
npx playwright test \
  --project=chromium \
  --workers=2 \
  --reporter=html \
  --trace=on-first-retry \
  2>&1

echo "[e2e] done"
echo "[e2e] HTML report: $repo_root/playwright-report/index.html"
echo "[e2e] Videos/screenshots: $repo_root/test-results/"

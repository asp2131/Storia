#!/usr/bin/env bash
# verify.sh — pre-handoff check. pi-symphony runs this before moving a Linear
# ticket to In Review.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if ! command -v npm >/dev/null 2>&1; then
  echo "[verify] npm not on PATH" >&2
  exit 1
fi

echo "[verify] tsc --noEmit"
npx --no-install tsc --noEmit

echo "[verify] npm run lint"
npm run lint --silent

echo "[verify] npm test"
npm test --silent

echo "[verify] ✓ passed"

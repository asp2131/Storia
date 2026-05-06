#!/usr/bin/env bash
# bootstrap.sh — one-shot dev env setup for Storia web.
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

find_main_worktree() {
  git worktree list --porcelain 2>/dev/null | awk '
    /^worktree / {
      path = substr($0, 10)
      if (path != "") {
        print path
        exit
      }
    }
  '
}

find_env_source() {
  if [ -n "${STORIA_ENV_FILE:-}" ]; then
    if [ -f "$STORIA_ENV_FILE" ]; then
      printf '%s\n' "$STORIA_ENV_FILE"
      return 0
    fi
    echo "[bootstrap] STORIA_ENV_FILE is set but not readable: $STORIA_ENV_FILE" >&2
    return 1
  fi

  local candidate main_worktree
  for candidate in "$repo_root/.env.local" "$repo_root/.env"; do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  main_worktree="$(find_main_worktree || true)"
  if [ -n "$main_worktree" ] && [ "$main_worktree" != "$repo_root" ]; then
    for candidate in "$main_worktree/.env.local" "$main_worktree/.env"; do
      if [ -f "$candidate" ]; then
        printf '%s\n' "$candidate"
        return 0
      fi
    done
  fi

  if [ -f "$repo_root/.env.example" ]; then
    printf '%s\n' "$repo_root/.env.example"
    return 0
  fi

  return 1
}

provision_env_file() {
  local source_file="$1" target_file="$2"

  if [ -e "$target_file" ] || [ -L "$target_file" ]; then
    echo "[bootstrap] env exists: $target_file"
    return 0
  fi

  if [ "$source_file" = "$repo_root/$target_file" ]; then
    return 0
  fi

  if [ "$(basename -- "$source_file")" = ".env.example" ]; then
    echo "[bootstrap] creating $target_file from .env.example"
    cp "$source_file" "$target_file"
  else
    echo "[bootstrap] linking $target_file -> $source_file"
    ln -s "$source_file" "$target_file" 2>/dev/null || cp "$source_file" "$target_file"
  fi
}

provision_env() {
  local env_source
  if ! env_source="$(find_env_source)"; then
    echo "[bootstrap] no env source found; create .env.local or set STORIA_ENV_FILE if runtime commands need secrets" >&2
    return 0
  fi

  provision_env_file "$env_source" .env.local
  provision_env_file "$env_source" .env
}

provision_env

# Prefer deterministic installs when the lockfile is valid. If a feature branch has a
# temporarily stale lockfile, fall back to a package.json-based install without
# rewriting package-lock.json so the agent can still run verification. Set
# BOOTSTRAP_STRICT_LOCK=1 to make stale locks fatal (CI-style behavior).
if [ -f package-lock.json ]; then
  npm_ci_check_log="$(mktemp -t storia-npm-ci-check.XXXXXX)"
  if npm ci --dry-run --ignore-scripts --no-audit --no-fund >"$npm_ci_check_log" 2>&1; then
    rm -f "$npm_ci_check_log"
    echo "[bootstrap] npm ci"
    if ! npm ci --no-audit --no-fund; then
      if [ "${BOOTSTRAP_STRICT_LOCK:-0}" = "1" ]; then
        echo "[bootstrap] npm ci failed and BOOTSTRAP_STRICT_LOCK=1; aborting" >&2
        exit 1
      fi
      echo "[bootstrap] npm ci failed; falling back to npm install --package-lock=false"
      npm install --no-audit --no-fund --package-lock=false
    fi
  else
    if [ "${BOOTSTRAP_STRICT_LOCK:-0}" = "1" ]; then
      cat "$npm_ci_check_log" >&2
      rm -f "$npm_ci_check_log"
      echo "[bootstrap] package-lock.json is not usable for npm ci and BOOTSTRAP_STRICT_LOCK=1; aborting" >&2
      exit 1
    fi
    rm -f "$npm_ci_check_log"
    echo "[bootstrap] package-lock.json is not usable for npm ci; using npm install --package-lock=false"
    npm install --no-audit --no-fund --package-lock=false
  fi
else
  echo "[bootstrap] npm install"
  npm install --no-audit --no-fund
fi

# Prisma client generate (offline, no DB required). Skip if prisma not present.
if [ -d prisma ] && [ -x node_modules/.bin/prisma ]; then
  echo "[bootstrap] prisma generate"
  npx prisma generate >/dev/null
fi

# Install Playwright browsers if e2e is available
if [ -f playwright.config.ts ] && [ -d e2e ]; then
  echo "[bootstrap] installing playwright chromium"
  npx playwright install chromium 2>/dev/null || true
fi

echo "[bootstrap] done"

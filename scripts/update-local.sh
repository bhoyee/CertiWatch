#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

# Ignore whitespace/line-ending-only diffs here (Windows checkouts without a normalized
# .gitattributes history can otherwise show the whole repo as "modified" with nothing real
# changed) - only block on genuine content differences, staged or unstaged.
if ! git diff -w --quiet || ! git diff -w --cached --quiet; then
  echo "You have real uncommitted changes - commit, stash, or discard them first:" >&2
  git diff -w --stat
  git diff -w --cached --stat
  exit 1
fi

echo "==> Pulling latest main..."
git pull --ff-only origin main

echo "==> Starting Postgres so migrations have something to apply to..."
docker compose up -d postgres
for i in $(seq 1 20); do
  if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Applying database migrations..."
if command -v dotnet >/dev/null 2>&1; then
  # The dockerized Postgres is exposed on 15432 (not the default 5432) to avoid clashing with a
  # host-installed Postgres, so migrate.sh's default appsettings connection string is overridden here.
  ConnectionStrings__postgres="Host=localhost;Port=15432;Username=postgres;Password=postgres;Database=certiwatch" \
    scripts/migrate.sh
else
  echo "WARNING: 'dotnet' not found on PATH in this shell - skipping migrations." >&2
  echo "  This only matters if a recent update added/changed database tables; it's not needed" >&2
  echo "  just to pick up frontend/UI changes. If you're on Windows, check whether this script" >&2
  echo "  is running under WSL (which has its own PATH, separate from Windows) rather than Git" >&2
  echo "  Bash - the paths in the log above starting with /mnt/c/... mean it's WSL. Install the" >&2
  echo "  .NET 8 SDK there, or re-run this from Git Bash instead, to enable this step." >&2
fi

echo "==> Rebuilding and restarting containers (one service at a time)..."
# Building services one at a time - rather than a single `docker compose up --build` - is the
# real fix for a recurring problem: Compose's build graph (bake or not, COMPOSE_BAKE=false isn't
# honored on every Compose version) treats the whole file as one unit, so an unrelated failure in
# one image cancels every other image's build too. The worker/paddleocr images run `apt-get
# install` against deb.debian.org at build time, which has repeatedly failed on flaky/blocked
# Docker networking here - that has nothing to do with api/frontend, which don't hit apt-get at
# all, so there's no reason a Debian mirror hiccup should stop them from updating.
# api/frontend first since they're what you actually look at day to day; worker/paddleocr after.
FAILED=""
for svc in api frontend worker paddleocr; do
  echo "--- $svc ---"
  if docker compose build "$svc" && docker compose up -d "$svc"; then
    echo "$svc: OK"
  else
    echo "WARNING: $svc failed to build/start - leaving its previous container (if any) running." >&2
    FAILED="$FAILED $svc"
  fi
done

echo "==> Recent logs:"
docker compose logs --tail=30

if [ -n "$FAILED" ]; then
  echo "==> Done, but these services did NOT update:$FAILED" >&2
  echo "  If that includes worker/paddleocr, it's almost certainly deb.debian.org being" >&2
  echo "  unreachable from Docker's network again - not a code problem. Try restarting Docker" >&2
  echo "  Desktop (or 'wsl --shutdown' then reopen it) and re-running this script." >&2
  exit 1
fi

echo "==> Done. Everything rebuilt successfully."

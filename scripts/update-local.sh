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

echo "==> Rebuilding and restarting containers..."
# COMPOSE_BAKE=false keeps builds scoped per-service instead of batching every image into one
# buildx bake call - otherwise an unrelated failure in one service (e.g. the worker/paddleocr
# apt-get steps hitting a transient network blip) cancels every other image's build too,
# including the frontend, even though nothing was actually wrong with it.
COMPOSE_BAKE=false docker compose up --build -d

echo "==> Done. Recent logs:"
docker compose logs --tail=30

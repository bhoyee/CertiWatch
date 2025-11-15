#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

CONN=${POSTGRES_URL:-postgres://postgres:postgres@localhost:5432/certiwatch}

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to seed the database" >&2
  exit 1
fi

psql "$CONN" -f scripts/seed.sql

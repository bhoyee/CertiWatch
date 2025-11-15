#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for dev infrastructure" >&2
  exit 1
fi

docker compose -f infra/docker-compose.dev.yml up -d

trap "kill 0" EXIT

dotnet watch --project apps/api run &
API_PID=$!

dotnet watch --project apps/worker run &
WORKER_PID=$!

dotnet watch --project apps/agent run &
AGENT_PID=$!

if [ ! -d apps/frontend/node_modules ]; then
  npm install --prefix apps/frontend
fi
npm run dev --prefix apps/frontend

wait $API_PID $WORKER_PID $AGENT_PID

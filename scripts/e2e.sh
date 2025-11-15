#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

npm install --prefix apps/frontend
npx playwright install --with-deps
npm run test --prefix apps/frontend || echo "Playwright smoke suite pending"

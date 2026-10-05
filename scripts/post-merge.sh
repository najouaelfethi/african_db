#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

npm ci
export NODE_PATH="$PROJECT_ROOT/lib/db/node_modules${NODE_PATH:+:$NODE_PATH}"
npm run db:push

#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

npm ci
npm run typecheck --workspace=@workspace/african-air-db
npm test --workspace=@workspace/african-air-db
npm run build --workspace=@workspace/african-air-db

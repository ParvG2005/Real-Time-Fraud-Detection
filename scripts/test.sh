#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose run --rm --no-deps -v "$PWD/backend/tests:/tests:ro" backend python -m pytest /tests -q -o cache_dir=/tmp/pytest-cache
docker compose run --rm --no-deps -v "$PWD/ml-service/tests:/tests:ro" ml-service python -m pytest /tests -q -o cache_dir=/tmp/pytest-cache
python3 scripts/verify.py
npm --prefix frontend run build
(cd frontend && npm run test:e2e)

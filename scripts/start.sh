#!/usr/bin/env bash
# One-command local startup. Application dependencies are installed inside Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required. Install Docker Desktop (https://www.docker.com/products/docker-desktop/), then run ./start again.\n' >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname)" == Darwin ]] && [[ -d /Applications/Docker.app ]]; then
    open -a Docker
    printf 'Waiting for Docker Desktop to start…\n'
    for attempt in {1..30}; do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
  fi
fi
if ! docker info >/dev/null 2>&1; then
  printf 'Start Docker Desktop or your Docker daemon, then run ./start again.\n' >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  printf 'Docker Compose v2 is required (included with Docker Desktop).\n' >&2
  exit 1
fi
run_setup_python() {
  if command -v python3 >/dev/null 2>&1 && [[ "${FRAUDSHIELD_DOCKER_SETUP:-0}" != 1 ]]; then
    python3 "$1"
  else
    docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace python:3.12-alpine python "$1"
  fi
}
run_setup_python scripts/setup-env.py
printf '\nBuilding and starting the complete local stack…\n'
docker compose up -d --build --wait --wait-timeout 180
printf '\nFraudShield AI is ready.\n'
run_setup_python scripts/show-login.py
printf 'API documentation: http://localhost:8080/docs\nStop and preserve your data: ./stop\n\n'
if [[ "${NO_OPEN_BROWSER:-0}" != 1 ]]; then
  if [[ "$(uname)" == Darwin ]]; then
    open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
    xdg-open http://localhost:3000 >/dev/null 2>&1 &
  fi
fi

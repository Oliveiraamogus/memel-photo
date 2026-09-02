#!/usr/bin/env bash
# Pull latest code, rebuild/restart the Docker stack, and configure Garage.
#
# Usage: ./scripts/deploy.sh [--no-pull]

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

PULL=1
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    -h|--help)
      echo "Usage: $0 [--no-pull]"
      echo "  Pull latest code, run docker compose up -d --build, then garage-init.sh."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [ "$PULL" -eq 1 ]; then
  echo "Pulling latest code..."
  git pull --ff-only
fi

echo "Building and starting services..."
if ! docker compose up -d --build; then
  echo >&2
  echo "Deploy failed. If migrate exited 1, check:" >&2
  echo "  docker compose logs migrate" >&2
  exit 1
fi

echo
echo "Configuring Garage buckets and CORS..."
"$(dirname "$0")/garage-init.sh"

echo
docker compose ps
echo
echo "Deploy complete."

#!/usr/bin/env bash
# Creates the derived bucket and grants the app key access to it.
#
# The originals bucket and the app key are created by garage itself from
# GARAGE_DEFAULT_* on first boot (`server --single-node --default-bucket`).
# Garage has no shell in its image, so the CLI is driven through docker exec,
# which is also what keeps a second process off the LMDB metadata directory.
#
# Safe to run repeatedly.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

garage() {
  docker compose exec -T garage /garage "$@"
}

echo "Waiting for garage to report a healthy node..."
for _ in $(seq 1 30); do
  if garage status >/dev/null 2>&1; then break; fi
  sleep 2
done

garage status

echo "Creating bucket ${S3_BUCKET_DERIVED} (ignore 'already exists')..."
garage bucket create "${S3_BUCKET_DERIVED}" || true

echo "Granting ${S3_ACCESS_KEY_ID} read/write on ${S3_BUCKET_DERIVED}..."
garage bucket allow --read --write --owner "${S3_BUCKET_DERIVED}" --key "${S3_ACCESS_KEY_ID}"

echo
echo "Buckets now configured:"
garage bucket info "${S3_BUCKET_ORIGINALS}"
garage bucket info "${S3_BUCKET_DERIVED}"

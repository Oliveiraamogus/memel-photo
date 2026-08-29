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

# S3 API from the Docker host (Garage port must be published, e.g. 3900:3900).
S3_API_ENDPOINT="${GARAGE_INIT_ENDPOINT:-http://127.0.0.1:3900}"

configure_bucket_cors() {
  local bucket=$1
  local cors_file
  cors_file="$(mktemp)"
  # Browsers PUT originals directly to Garage; without CORS the XHR fails with a
  # generic "network error" even when the presigned URL is valid.
  cat > "${cors_file}" <<'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 86400
    }
  ]
}
EOF
  echo "Configuring CORS on ${bucket}..."
  docker run --rm --network host \
    -e AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
    -e AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
    -e AWS_DEFAULT_REGION="${S3_REGION}" \
    -e AWS_ENDPOINT_URL="${S3_API_ENDPOINT}" \
    -v "${cors_file}:/cors.json:ro" \
    amazon/aws-cli:latest \
    s3api put-bucket-cors --bucket "${bucket}" --cors-configuration "file:///cors.json"
  rm -f "${cors_file}"
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

configure_bucket_cors "${S3_BUCKET_ORIGINALS}"
configure_bucket_cors "${S3_BUCKET_DERIVED}"

echo
echo "Buckets now configured:"
garage bucket info "${S3_BUCKET_ORIGINALS}"
garage bucket info "${S3_BUCKET_DERIVED}"

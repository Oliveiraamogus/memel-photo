#!/usr/bin/env bash
# Round-trips a small object through both buckets with awscli, which is the
# quickest way to prove the keys, the endpoint and the bucket grants all line up
# before the app ever runs.
#
# Uses the awscli container image so nothing has to be installed on the host.

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

# Reach garage over the published loopback port rather than the compose network,
# so this also proves the port publishing works.
ENDPOINT="${1:-http://127.0.0.1:3900}"

aws() {
  docker run --rm --network host \
    -e AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
    -e AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
    -e AWS_DEFAULT_REGION="${S3_REGION}" \
    -e AWS_ENDPOINT_URL="${ENDPOINT}" \
    -v "$PWD/.verify:/work" -w /work \
    amazon/aws-cli:latest "$@"
}

mkdir -p .verify
echo "photo-memel storage check $(date -Iseconds)" > .verify/probe.txt

echo "== Buckets visible to the app key =="
aws s3 ls

for bucket in "${S3_BUCKET_ORIGINALS}" "${S3_BUCKET_DERIVED}"; do
  echo
  echo "== ${bucket}: put, get, delete =="
  aws s3 cp probe.txt "s3://${bucket}/_healthcheck/probe.txt"
  aws s3 cp "s3://${bucket}/_healthcheck/probe.txt" "roundtrip-${bucket}.txt"
  diff -q probe.txt "roundtrip-${bucket}.txt" && echo "  content matches"
  aws s3 rm "s3://${bucket}/_healthcheck/probe.txt"
done

echo
echo "== Presigned GET (what the browser will receive) =="
aws s3 cp probe.txt "s3://${S3_BUCKET_DERIVED}/_healthcheck/presign.txt" >/dev/null
aws s3 presign "s3://${S3_BUCKET_DERIVED}/_healthcheck/presign.txt" --expires-in 60
echo "  ^ open that URL; it should return the probe text, then expire in 60s"
echo "  (note it is signed for ${ENDPOINT}; browsers must use S3_ENDPOINT_PUBLIC)"

rm -rf .verify
echo
echo "Storage OK."

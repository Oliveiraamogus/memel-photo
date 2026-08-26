#!/usr/bin/env bash
# Offsite backup: originals and a database dump to Backblaze B2.
#
# Run from cron on the Docker host, e.g.
#   30 3 * * * /opt/photo-memel/backup/offsite-backup.sh >> /var/log/photo-backup.log 2>&1
#
# Only originals are synced. Derivatives are regenerable from them, and paying
# to store four AVIF sizes of every photo forever is paying for nothing.
#
# Set up the remotes first:
#   rclone config   # create "b2" (Backblaze) and "garage" (S3, using .env creds)

set -euo pipefail

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

B2_REMOTE="${B2_REMOTE:-b2:photo-memel}"
GARAGE_REMOTE="${GARAGE_REMOTE:-garage}"

echo "=== $(date -Iseconds) starting offsite backup ==="

echo "--- database dump ---"
DUMP="/tmp/photo-memel-$(date +%Y%m%d).sql.gz"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${DUMP}"

rclone copy "${DUMP}" "${B2_REMOTE}/database/" --progress
rm -f "${DUMP}"

# Keep a month of dumps; ZFS snapshots cover anything more recent.
rclone delete "${B2_REMOTE}/database/" --min-age 30d

echo "--- originals ---"
rclone sync "${GARAGE_REMOTE}:${S3_BUCKET_ORIGINALS}" "${B2_REMOTE}/originals" \
  --fast-list \
  --transfers 8 \
  --checksum \
  --stats 30s

echo "=== $(date -Iseconds) done ==="

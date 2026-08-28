# memel-photo

A self-hosted photography portfolio. Next.js + TypeScript on top of Postgres and
Garage (S3-compatible object storage), running as Docker containers.

Albums are named, permissioned views over photos. They are either **manual**
(you pick the photos and drag them into order) or **rule-based** (contents come
from tags, a date range and a minimum rating). That is what makes dated albums
and Best of file themselves.

---

## Host setup on Proxmox

The app itself only needs Docker. The storage underneath it is worth doing
properly, because a single-node Garage has no redundancy of its own.

### 1. ZFS pool and datasets

On the Proxmox host, mirror two disks and split metadata from bulk data.
Garage's index is small, random-access and wants an SSD; the objects are large
and sequential and are happy on spinning rust.

```bash
zpool create -o ashift=12 tank mirror /dev/disk/by-id/<diskA> /dev/disk/by-id/<diskB>

zfs create -o recordsize=16K -o compression=lz4 tank/garage-meta
zfs create -o recordsize=1M  -o compression=off tank/garage-data
zfs create -o recordsize=16K -o compression=lz4 tank/postgres
```

`compression=off` on the data set is deliberate: JPEG, AVIF and RAW are already
compressed, so lz4 there costs CPU and returns nothing.

If the metadata dataset lives on a separate SSD pool, create it there instead
and keep the paths straight in `.env`.

### 2. A Docker host

Create a Debian VM (or a privileged LXC) and pass the datasets in. For an LXC,
add to `/etc/pve/lxc/<id>.conf`:

```
mp0: /tank/garage-meta,mp=/mnt/garage-meta
mp1: /tank/garage-data,mp=/mnt/garage-data
mp2: /tank/postgres,mp=/mnt/postgres
```

Install Docker inside it, then clone this repo.

### 3. Snapshots and offsite backup

ZFS snapshots cover mistakes; they do not cover the machine burning down. You
want both, and `backup/` holds a working copy of each.

```bash
apt install sanoid
cp backup/sanoid.conf /etc/sanoid/sanoid.conf
systemctl enable --now sanoid.timer
```

For offsite, configure two rclone remotes — `b2` (Backblaze) and `garage` (S3,
using the keys from `.env`) — then run the backup nightly from cron:

```bash
rclone config
crontab -e
# 30 3 * * * /opt/memel-photo/backup/offsite-backup.sh >> /var/log/photo-backup.log 2>&1
```

It ships a gzipped `pg_dump` and syncs the originals bucket. Derivatives are
skipped deliberately: they regenerate from the originals, so paying to store
four AVIF sizes of every photo forever buys nothing. The database is the small
half and the important one, since album rules, ratings and every permission
grant live only there.

---

## Configuration

```bash
cp .env.example .env
```

Fill in every blank. The generator command for each secret is in the comment
next to it.

Two settings deserve care:

- **`S3_ENDPOINT_PUBLIC`** is the hostname browsers fetch images from, and it is
  what the app signs presigned URLs with. If the signing host and the fetching
  host differ, every image 403s. Point this hostname at the garage container
  through your reverse proxy before starting.
- **`DEFAULT_DATED_ALBUM_VISIBILITY`** decides what happens to a fresh import.
  It ships as `restricted` so uploads are private until you say otherwise.

Point `GARAGE_META_DIR`, `GARAGE_DATA_DIR` and `POSTGRES_DATA_DIR` at the
mounted datasets.

## First run

```bash
docker compose up -d garage postgres
./scripts/garage-init.sh      # creates the derived bucket, grants the app key
./scripts/verify-storage.sh   # round-trips an object through both buckets

docker compose up -d          # migrate runs, then web and worker start
docker compose run --rm worker node_modules/.bin/tsx src/scripts/seed.ts
```

The seed script creates your admin account from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` and the Best of album. There is no public signup: every other
account is created by you from `/admin/users`.

## Reverse proxy

Two hostnames point at this stack:

| Hostname                | Forwards to      | Why                                      |
| ----------------------- | ---------------- | ---------------------------------------- |
| `APP_URL`               | `127.0.0.1:3000` | the site                                 |
| `S3_ENDPOINT_PUBLIC`    | `127.0.0.1:3900` | image bytes, fetched by presigned URL    |

Garage is not exposed directly; only the reverse proxy talks to it. Allow large
request bodies on the S3 hostname, since browsers upload originals straight to
it.

## Development

Run **Postgres + Garage in Docker**, and the **web app + worker on your machine**.
That way you edit code and hot-reload without rebuilding images.

### 1. Prerequisites

- Node 22+ (24 is fine)
- Docker with Compose
- This repo cloned on your laptop (not only on the Proxmox CT)

### 2. Local `.env`

```bash
cp .env.example .env
```

Generate secrets as in the comments, then use **localhost** values (the app runs on the host, not inside Compose):

```bash
SITE_TITLE=Memel Photos (dev)
APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000

POSTGRES_USER=photos
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=photos
# Host is localhost — not "postgres" — because Next runs on your machine.
DATABASE_URL=postgres://photos:<SAME_PASSWORD>@127.0.0.1:5432/photos

ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=dev-password
ADMIN_NAME=Admin

# … Garage / S3 secrets as usual …

S3_ENDPOINT_INTERNAL=http://127.0.0.1:3900
S3_ENDPOINT_PUBLIC=http://127.0.0.1:3900

GARAGE_META_DIR=./data/garage-meta
GARAGE_DATA_DIR=./data/garage-data
POSTGRES_DATA_DIR=./data/postgres
```

Do **not** copy the Proxmox `.env` as-is: `DATABASE_URL` / S3 hosts there point at Docker service names and the CT IP.

### 3. Start dependencies + install

```bash
mkdir -p data/garage-meta data/garage-data data/postgres
npm install

docker compose up -d postgres garage
./scripts/garage-init.sh
./scripts/verify-storage.sh   # optional; needs amazon/aws-cli pull or local awscli

npm run db:migrate            # or: npm run db:push
npm run db:seed
```

### 4. Run the app (two terminals)

```bash
npm run dev       # http://localhost:3000
npm run worker    # image processing / membership jobs
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Uploads and login stay on this machine; the Proxmox stack is untouched.

### 5. Checks without Docker

```bash
npm run check
```

Uses in-memory Postgres (PGlite). Good for ACL / membership / publish-guard before you even start Garage.

### 6. Reset local data

```bash
docker compose down
rm -rf data/postgres data/garage-meta data/garage-data
# then step 3 again
```

**Note:** `web` / `worker` Compose services are for the server. Locally you only need `postgres` + `garage`.

## How membership works

Every read query goes through `album_photo_resolved`, a materialised table
holding the contents of each album. A pg-boss job recomputes it whenever
something a rule depends on changes: tags, ratings, capture dates, album rules
or manual overrides.

Reads never evaluate rules. That matters because every permission check has to
answer "which albums contain this photo", and getting that wrong means showing
someone a photo they should not see.

If it ever looks stale, `/admin` has a rebuild action, or:

```bash
docker compose run --rm worker node_modules/.bin/tsx src/scripts/rebuild-membership.ts
```

## Publishing safeguards

Anything that puts a photo into a public album publishes it, including indirect
routes like adding a tag or raising a rating past a Best of threshold. Before
saving tags, ratings or rules, the admin UI shows exactly which photos change
visibility and waits for confirmation, and any publicly visible photo carries a
badge naming the album responsible.

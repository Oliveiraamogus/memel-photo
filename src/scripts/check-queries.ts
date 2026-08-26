/**
 * Checks the read queries behind /all and the album page: that a photo in
 * several visible albums appears exactly once, that keyset paging walks the
 * library without dropping or repeating anything, and that the tag filter and
 * sort orders do what they say.
 *
 * Run with `npx tsx src/scripts/check-queries.ts`.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { visibleAlbumIds } from "@/lib/acl";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { album, albumPhoto, photo, photoTag, tag } from "@/lib/db/schema";
import { recomputeAllAlbums } from "@/lib/membership";
import { type StreamCursor, albumPhotos, streamPhotos } from "@/lib/photos";

const client = new PGlite();
const db = drizzle(client, { schema }) as unknown as Database;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const sqlFile = readFileSync("drizzle/0000_init.sql", "utf8");
for (const statement of sqlFile.split("--> statement-breakpoint").map((s) => s.trim())) {
  if (statement) await client.exec(statement);
}

/* ---------------------------------------------------------------- fixtures */

const [landscapes] = await db
  .insert(album)
  .values({ slug: "landscapes", title: "Landscapes", visibility: "public", source: "manual" })
  .returning();

const [favourites] = await db
  .insert(album)
  .values({ slug: "favourites", title: "Favourites", visibility: "public", source: "manual" })
  .returning();

const [hidden] = await db
  .insert(album)
  .values({ slug: "hidden", title: "Hidden", visibility: "restricted", source: "manual" })
  .returning();

const [seaTag] = await db.insert(tag).values({ name: "Sea", slug: "sea" }).returning();

// 25 photos, one per day, so paging has something to walk.
const inserted = await db
  .insert(photo)
  .values(
    Array.from({ length: 25 }, (_, i) => ({
      originalKey: `originals/p${i}.jpg`,
      filename: `p${i}.jpg`,
      status: "ready" as const,
      takenAt: new Date(Date.UTC(2026, 0, i + 1, 12)),
      adminRatingHalf: (i % 21) as number,
    })),
  )
  .returning();

// The first photo is deliberately in two visible albums at once.
await db.insert(albumPhoto).values([
  ...inserted.map((p, i) => ({ albumId: landscapes.id, photoId: p.id, sortIndex: i })),
  { albumId: favourites.id, photoId: inserted[0].id, sortIndex: 0 },
]);

// And one photo exists only in a restricted album.
const [secret] = await db
  .insert(photo)
  .values({
    originalKey: "originals/secret.jpg",
    filename: "secret.jpg",
    status: "ready",
    takenAt: new Date(Date.UTC(2026, 5, 1, 12)),
    adminRatingHalf: 20,
  })
  .returning();
await db.insert(albumPhoto).values({ albumId: hidden.id, photoId: secret.id });

await db.insert(photoTag).values({ photoId: inserted[3].id, tagId: seaTag.id });

await recomputeAllAlbums(db);

const visibleIds = await visibleAlbumIds(null, db);

/* ------------------------------------------------------------------ stream */

console.log("\nStream:");

const firstPage = await streamPhotos(visibleIds, { limit: 100 }, db);
const ids = firstPage.map((p) => p.id);
check(
  "a photo in two visible albums appears exactly once",
  ids.filter((id) => id === inserted[0].id).length === 1,
);
check("photos from restricted albums stay out", !ids.includes(secret.id));
check("every visible photo is present", ids.length === 25, `${ids.length}`);
check(
  "newest first by default",
  new Date(firstPage[0].taken_at!) > new Date(firstPage[1].taken_at!),
);

/* ------------------------------------------------------------------ paging */

console.log("\nKeyset paging:");

async function walk(sort: "date-desc" | "date-asc" | "rating") {
  const seen: string[] = [];
  let cursor: StreamCursor = null;
  for (let page = 0; page < 20; page += 1) {
    const rows = await streamPhotos(visibleIds, { sort, limit: 7, cursor }, db);
    if (rows.length === 0) break;
    seen.push(...rows.map((r) => r.id));
    const last = rows.at(-1)!;
    cursor = {
      id: last.id,
      takenAt: last.taken_at,
      ratingHalf: last.admin_rating_half,
    };
  }
  return seen;
}

for (const sort of ["date-desc", "date-asc", "rating"] as const) {
  const seen = await walk(sort);
  const unique = new Set(seen);
  check(
    `${sort}: pages cover every photo exactly once`,
    seen.length === 25 && unique.size === 25,
    `${seen.length} rows, ${unique.size} unique`,
  );
}

const rated = await streamPhotos(visibleIds, { sort: "rating", limit: 100 }, db);
check(
  "rating sort puts the highest first",
  (rated[0].admin_rating_half ?? -1) >= (rated[1].admin_rating_half ?? -1),
);

/* --------------------------------------------------------------- filtering */

console.log("\nFiltering:");

const tagged = await streamPhotos(visibleIds, { tagSlug: "sea", limit: 100 }, db);
check(
  "tag filter narrows to the tagged photo",
  tagged.length === 1 && tagged[0].id === inserted[3].id,
  `${tagged.length} rows`,
);

const noneVisible = await streamPhotos([], { limit: 10 }, db);
check("a viewer with no visible albums sees nothing", noneVisible.length === 0);

/* ------------------------------------------------------------------ albums */

console.log("\nAlbum ordering:");

const curated = await albumPhotos(landscapes.id, { sort: "curated" }, db);
check(
  "album order follows the manual sequence",
  curated[0].id === inserted[0].id && curated[24].id === inserted[24].id,
);

const byDate = await albumPhotos(landscapes.id, { sort: "date-desc" }, db);
check("album can be re-sorted by date", byDate[0].id === inserted[24].id);

const byRating = await albumPhotos(landscapes.id, { sort: "rating" }, db);
check(
  "album can be re-sorted by rating",
  (byRating[0].admin_rating_half ?? 0) >= (byRating[1].admin_rating_half ?? 0),
);

await client.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

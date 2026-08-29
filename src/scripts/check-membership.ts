/**
 * Exercises the membership resolver and the access rules against an in-memory
 * Postgres. This is the part of the system where a mistake means quietly
 * showing someone a photo they should not see, so it gets real assertions
 * rather than a smoke test.
 *
 * Run with `npx tsx src/scripts/check-membership.ts`.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { albumAccess, photoAccess, visibleAlbums } from "@/lib/acl";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  album,
  albumAccess as albumAccessTable,
  albumPhoto,
  albumPhotoResolved,
  albumRuleTag,
  group,
  groupMember,
  photo,
  photoTag,
  tag,
  user,
} from "@/lib/db/schema";
import { ensureDatedAlbum, recomputeAllAlbums, restoreDatedAlbumWindows, unfiledPhotoIds } from "@/lib/membership";
import { startOfUtcDay } from "@/lib/slug";

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

const ADMIN = "user-admin";
const FAMILY_MEMBER = "user-family";
const OUTSIDER = "user-outsider";

await db.insert(user).values([
  { id: ADMIN, name: "Admin", email: "admin@example.com", role: "admin" },
  { id: FAMILY_MEMBER, name: "Sister", email: "sister@example.com", role: "viewer" },
  { id: OUTSIDER, name: "Outsider", email: "outsider@example.com", role: "viewer" },
]);

const [familyGroup] = await db
  .insert(group)
  .values({ name: "Family", slug: "family" })
  .returning();
await db.insert(groupMember).values({ groupId: familyGroup.id, userId: FAMILY_MEMBER });

const [portraitTag] = await db
  .insert(tag)
  .values({ name: "Portrait", slug: "portrait" })
  .returning();

const day = new Date("2026-08-18T10:00:00Z");

const [publicPortraits] = await db
  .insert(album)
  .values({
    slug: "portraits",
    title: "Portraits",
    visibility: "public",
    kind: "collection",
    source: "rule",
  })
  .returning();
await db.insert(albumRuleTag).values({ albumId: publicPortraits.id, tagId: portraitTag.id });

const [vacation] = await db
  .insert(album)
  .values({
    slug: "family-vacation-2026",
    title: "Family Vacation 2026",
    visibility: "restricted",
    kind: "collection",
    source: "manual",
    // Private album, but its best frames may surface publicly.
    contributesToBestOf: true,
  })
  .returning();
await db.insert(albumAccessTable).values({
  albumId: vacation.id,
  groupId: familyGroup.id,
  canDownloadOriginals: true,
});

const [bestOf] = await db
  .insert(album)
  .values({
    slug: "best-of",
    title: "Best of",
    visibility: "public",
    kind: "best_of",
    source: "rule",
    ruleMinRatingHalf: 16,
    sortOrder: -1000,
  })
  .returning();

const photos = await db
  .insert(photo)
  .values([
    // Public via the portrait rule, and rated high enough for Best of.
    {
      originalKey: "originals/p1.jpg",
      filename: "p1.jpg",
      status: "ready",
      takenAt: day,
      adminRatingHalf: 18,
    },
    // Same day, too low-rated for Best of.
    {
      originalKey: "originals/p2.jpg",
      filename: "p2.jpg",
      status: "ready",
      takenAt: day,
      adminRatingHalf: 12,
    },
    // Private, but in the album that opted in to contributing.
    {
      originalKey: "originals/p3.jpg",
      filename: "p3.jpg",
      status: "ready",
      takenAt: new Date("2026-07-01T09:00:00Z"),
      adminRatingHalf: 20,
    },
    // Rated 10 stars but only ever in a restricted album that has NOT opted in.
    {
      originalKey: "originals/p4.jpg",
      filename: "p4.jpg",
      status: "ready",
      takenAt: new Date("2026-06-02T09:00:00Z"),
      adminRatingHalf: 20,
    },
  ])
  .returning();

const [p1, p2, p3, p4] = photos;
await db.insert(photoTag).values({ photoId: p1.id, tagId: portraitTag.id });
await db.insert(albumPhoto).values({ albumId: vacation.id, photoId: p3.id, sortIndex: 0 });

// Dated albums, as an upload would create them.
const datedAug = await ensureDatedAlbum(day, db);
const datedJul = await ensureDatedAlbum(new Date("2026-07-01T09:00:00Z"), db);
const datedJun = await ensureDatedAlbum(new Date("2026-06-02T09:00:00Z"), db);

await recomputeAllAlbums(db);

async function contents(albumId: string) {
  const rows = await db
    .select({ photoId: albumPhotoResolved.photoId })
    .from(albumPhotoResolved)
    .where(eq(albumPhotoResolved.albumId, albumId))
    .orderBy(asc(albumPhotoResolved.sortIndex));
  return rows.map((r) => r.photoId);
}

/* ------------------------------------------------------------ rule albums */

console.log("\nRule albums:");

const augContents = await contents(datedAug!);
check(
  "dated album collects both photos from its day",
  augContents.length === 2 && augContents.includes(p1.id) && augContents.includes(p2.id),
  augContents.join(","),
);

const junContents = await contents(datedJun!);
check(
  "a different day's album does not collect them",
  junContents.length === 1 && junContents[0] === p4.id,
);

const portraitContents = await contents(publicPortraits.id);
check(
  "tag rule collects only the tagged photo",
  portraitContents.length === 1 && portraitContents[0] === p1.id,
  portraitContents.join(","),
);

const vacationContents = await contents(vacation.id);
check(
  "manual album holds exactly what was filed",
  vacationContents.length === 1 && vacationContents[0] === p3.id,
);

/* ---------------------------------------------------------------- best of */

console.log("\nBest of:");

let bestOfContents = await contents(bestOf.id);
check(
  "includes a high-rated photo from a public album",
  bestOfContents.includes(p1.id),
);
check(
  "includes a high-rated photo from a private album that opted in",
  bestOfContents.includes(p3.id),
);
check(
  "excludes a photo rated below the threshold",
  !bestOfContents.includes(p2.id),
);
check(
  "excludes a 10-star photo whose only album never opted in",
  !bestOfContents.includes(p4.id),
);
check(
  "orders by rating, best first",
  bestOfContents[0] === p3.id && bestOfContents[1] === p1.id,
  bestOfContents.join(","),
);

// The per-photo escape hatch.
await db.insert(albumPhoto).values({ albumId: bestOf.id, photoId: p1.id, mode: "exclude" });
await recomputeAllAlbums(db);
bestOfContents = await contents(bestOf.id);
check("an exclude override removes a photo", !bestOfContents.includes(p1.id));

// And the pin, for something the rule missed.
await db
  .insert(albumPhoto)
  .values({ albumId: bestOf.id, photoId: p2.id, mode: "include" });
await recomputeAllAlbums(db);
bestOfContents = await contents(bestOf.id);
check("a pin adds a photo the rule missed", bestOfContents.includes(p2.id));

// Lowering the rating should drop it back out.
await db.update(photo).set({ adminRatingHalf: 4 }).where(eq(photo.id, p3.id));
await recomputeAllAlbums(db);
bestOfContents = await contents(bestOf.id);
check("lowering a rating removes the photo", !bestOfContents.includes(p3.id));
await db.update(photo).set({ adminRatingHalf: 20 }).where(eq(photo.id, p3.id));
await recomputeAllAlbums(db);

/* ------------------------------------------------------------ permissions */

console.log("\nPermissions:");

const anonP1 = await photoAccess(null, p1.id, db);
check("anonymous may view a photo in a public album", anonP1.canView);
check("anonymous never gets originals", !anonP1.canDownloadOriginals);

const anonP4 = await photoAccess(null, p4.id, db);
check("anonymous may not view a photo only in a restricted album", !anonP4.canView);

// p4 is the genuinely private one: its only album is restricted and never
// opted in to Best of. p3 is deliberately not used here, because contributing
// to Best of is meant to make it publicly viewable (asserted below).
const outsiderP4 = await photoAccess(OUTSIDER, p4.id, db);
check(
  "a signed-in user with no grant may not view a restricted photo",
  !outsiderP4.canView,
);

const familyP3 = await photoAccess(FAMILY_MEMBER, p3.id, db);
check("a group member may view the photo granted to their group", familyP3.canView);
check("and may download its original", familyP3.canDownloadOriginals);

// p3 is also in Best of, which is public. Most permissive wins for viewing,
// but Best of must not be a back door to the original file.
const anonP3 = await photoAccess(null, p3.id, db);
check(
  "Best of makes a contributed photo publicly viewable",
  anonP3.canView,
);
check(
  "but Best of never grants the original",
  !anonP3.canDownloadOriginals,
);

const vacationForOutsider = await albumAccess(OUTSIDER, vacation, db);
check("album access denies a user without a grant", !vacationForOutsider.canView);

const vacationForFamily = await albumAccess(FAMILY_MEMBER, vacation, db);
check("album access allows a granted group member", vacationForFamily.canView);

const [datedAlbumRow] = await db.select().from(album).where(eq(album.id, datedAug!)).limit(1);
const adminDated = await albumAccess(ADMIN, datedAlbumRow, db);
check("an admin may view a restricted dated album", adminDated.canView);
check("and may download its original", adminDated.canDownloadOriginals);
const outsiderDated = await albumAccess(OUTSIDER, datedAlbumRow, db);
check("an outsider still cannot view that dated album", !outsiderDated.canView);

/* ---------------------------------------------------------------- listings */

console.log("\nListing:");

await db.update(album).set({ visibility: "unlisted" }).where(eq(album.id, datedJul!));
await recomputeAllAlbums(db);

const anonList = await visibleAlbums(null, db);
const anonSlugs = anonList.map((a) => a.slug);
check(
  "anonymous sees public albums",
  anonSlugs.includes("best-of") && anonSlugs.includes("portraits"),
  anonSlugs.join(","),
);
check(
  "anonymous does not see restricted albums",
  !anonSlugs.includes("family-vacation-2026"),
);
check("unlisted albums are never listed", !anonSlugs.includes("2026-07-01"));
check("Best of sorts first", anonList[0]?.slug === "best-of");

const familyList = await visibleAlbums(FAMILY_MEMBER, db);
check(
  "a group member sees the album shared with their group",
  familyList.map((a) => a.slug).includes("family-vacation-2026"),
);

const outsiderList = await visibleAlbums(OUTSIDER, db);
check(
  "another signed-in user does not",
  !outsiderList.map((a) => a.slug).includes("family-vacation-2026"),
);

const adminList = await visibleAlbums(ADMIN, db);
check(
  "an admin listing includes restricted dated albums",
  adminList.some((a) => a.id === datedAug),
);

/* ------------------------------------------------------ dated window repair */

console.log("\nDated windows:");

await db
  .update(album)
  .set({ ruleDateTo: startOfUtcDay(day) })
  .where(eq(album.id, datedAug!));
await recomputeAllAlbums(db);
check(
  "a collapsed until-date empties the day album",
  (await contents(datedAug!)).length === 0,
);
await restoreDatedAlbumWindows(db);
await recomputeAllAlbums(db);
const restored = await contents(datedAug!);
check(
  "restoring the day window refills the photos",
  restored.length === 2 && restored.includes(p1.id) && restored.includes(p2.id),
  restored.join(","),
);

/* ----------------------------------------------------------------- unfiled */

console.log("\nUnfiled:");

const [orphan] = await db
  .insert(photo)
  .values({ originalKey: "originals/x.jpg", filename: "x.jpg", status: "ready" })
  .returning();
await recomputeAllAlbums(db);
const unfiled = await unfiledPhotoIds(db);
check("a photo in no album is reported as unfiled", unfiled.includes(orphan.id));
check("a filed photo is not", !unfiled.includes(p1.id));

await client.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

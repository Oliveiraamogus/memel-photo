/**
 * Checks the publication safeguard: that a preview reports exactly the photos a
 * change would publish or unpublish, and that the preview leaves nothing behind.
 *
 * Run with `npx tsx src/scripts/check-publish-guard.ts`.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { album, albumRuleTag, photo, photoTag, tag } from "@/lib/db/schema";
import { recomputeAllAlbums } from "@/lib/membership";
import { previewVisibilityDelta, publicReasonsFor } from "@/lib/publish-guard";

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

const [portraitTag] = await db
  .insert(tag)
  .values({ name: "Portrait", slug: "portrait" })
  .returning();

const [publicAlbum] = await db
  .insert(album)
  .values({
    slug: "portraits",
    title: "Portraits",
    visibility: "public",
    kind: "collection",
    source: "rule",
  })
  .returning();
await db.insert(albumRuleTag).values({ albumId: publicAlbum.id, tagId: portraitTag.id });

const [privateAlbum] = await db
  .insert(album)
  .values({
    slug: "family",
    title: "Family",
    visibility: "restricted",
    kind: "collection",
    source: "rule",
    contributesToBestOf: true,
    ruleDateFrom: new Date("2026-01-01T00:00:00Z"),
    ruleDateTo: new Date("2026-12-31T23:59:59Z"),
  })
  .returning();

const [bestOf] = await db
  .insert(album)
  .values({
    slug: "best-of",
    title: "Best of",
    visibility: "public",
    kind: "best_of",
    source: "rule",
    ruleMinRatingHalf: 16,
  })
  .returning();

const [family1, family2] = await db
  .insert(photo)
  .values([
    {
      originalKey: "originals/f1.jpg",
      filename: "f1.jpg",
      status: "ready",
      takenAt: new Date("2026-03-04T10:00:00Z"),
      adminRatingHalf: 12,
    },
    {
      originalKey: "originals/f2.jpg",
      filename: "f2.jpg",
      status: "ready",
      takenAt: new Date("2026-03-04T11:00:00Z"),
      adminRatingHalf: 18,
    },
  ])
  .returning();

await recomputeAllAlbums(db);

/* ----------------------------------------------------------------- preview */

console.log("\nPreview of a rating change:");

// f2 is already public through Best of; f1 is not, and raising it past the
// threshold on an opted-in album is exactly the foot-gun worth warning about.
const reasons = await publicReasonsFor([family1.id, family2.id], db);
check("the already-public photo is reported as public", reasons.has(family2.id));
check("and names the album responsible", reasons.get(family2.id) === "Public via Best of");
check("the below-threshold photo is not public", !reasons.has(family1.id));

const ratingDelta = await previewVisibilityDelta(
  async (tx) => {
    await tx.update(photo).set({ adminRatingHalf: 18 }).where(eq(photo.id, family1.id));
  },
  db,
);

check(
  "raising a rating past the threshold is reported as publishing one photo",
  ratingDelta.becomingPublic.length === 1 &&
    ratingDelta.becomingPublic[0].id === family1.id,
  `${ratingDelta.becomingPublic.length} photo(s)`,
);
check("and names Best of as the reason", ratingDelta.becomingPublic[0]?.album_title === "Best of");
check("nothing is reported as unpublished", ratingDelta.noLongerPublic.length === 0);

const afterPreview = await db
  .select({ rating: photo.adminRatingHalf })
  .from(photo)
  .where(eq(photo.id, family1.id));
check("the preview left the rating untouched", afterPreview[0].rating === 12);

const stillNotPublic = await publicReasonsFor([family1.id], db);
check("and left membership untouched", !stillNotPublic.has(family1.id));

console.log("\nPreview of a tag change:");

const tagDelta = await previewVisibilityDelta(
  async (tx) => {
    await tx.insert(photoTag).values({ photoId: family1.id, tagId: portraitTag.id });
  },
  db,
);
check(
  "tagging a private photo into a public rule album is reported",
  tagDelta.becomingPublic.length === 1 && tagDelta.becomingPublic[0].id === family1.id,
);
check(
  "and names the album that would publish it",
  tagDelta.becomingPublic[0]?.album_title === "Portraits",
  tagDelta.becomingPublic[0]?.album_title ?? "none",
);

console.log("\nPreview of turning off the Best of opt-in:");

const optOutDelta = await previewVisibilityDelta(
  async (tx) => {
    await tx
      .update(album)
      .set({ contributesToBestOf: false })
      .where(eq(album.id, privateAlbum.id));
  },
  db,
);
check(
  "withdrawing the opt-in is reported as unpublishing the photo",
  optOutDelta.noLongerPublic.length === 1 &&
    optOutDelta.noLongerPublic[0].id === family2.id,
  `${optOutDelta.noLongerPublic.length} photo(s)`,
);

console.log("\nPreview of a harmless change:");

const noopDelta = await previewVisibilityDelta(
  async (tx) => {
    await tx.update(album).set({ title: "Family photos" }).where(eq(album.id, privateAlbum.id));
  },
  db,
);
check(
  "renaming an album publishes nothing",
  noopDelta.becomingPublic.length === 0 && noopDelta.noLongerPublic.length === 0,
);

// Guard against the preview quietly becoming a no-op that always reports zero.
const bestOfRows = await db.select().from(album).where(eq(album.id, bestOf.id));
check("Best of still exists after all the rollbacks", bestOfRows.length === 1);

await client.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

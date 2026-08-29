import { and, eq, sql } from "drizzle-orm";
import { config } from "@/lib/config";
import { type Database, db, execRows } from "@/lib/db";
import { album, albumAccess, albumPhoto, albumRuleTag, photoTag, tag, user } from "@/lib/db/schema";
import {
  datedAlbumSlug,
  datedAlbumTitle,
  endOfUtcDay,
  slugify,
  startOfUtcDay,
  uniqueSlug,
} from "@/lib/slug";

/**
 * Resolves album rules into `album_photo_resolved`, the table every read query
 * and every permission check goes through.
 *
 * Rules are never evaluated on read. Reads are constant and permission
 * sensitive, writes are rare and batched, and every permission check has to
 * answer "which albums contain this photo" — running that backwards across all
 * albums per request would be both slow and easy to get quietly wrong.
 */

/**
 * A rule album's contents: photos matching every condition, plus pinned
 * overrides, minus excluded ones.
 *
 * The tag condition is "every tag on the rule is present on the photo", written
 * as a double negative so that a rule with no tags is vacuously true rather
 * than matching nothing.
 */
function ruleMembershipSql(albumId: string, isBestOf: boolean) {
  const ordering = isBestOf
    ? sql`p.admin_rating_half desc nulls last, p.taken_at desc nulls last, p.id`
    : sql`p.taken_at asc nulls last, p.id`;

  // Best of may only draw from albums that are public or have opted in, so a
  // high rating alone can never publish a photo with no album-level decision
  // behind it.
  const bestOfClause = isBestOf
    ? sql`and exists (
          select 1
          from album_photo_resolved apr
          join album source_album on source_album.id = apr.album_id
          where apr.photo_id = p.id
            and source_album.kind <> 'best_of'
            and (source_album.visibility = 'public' or source_album.contributes_to_best_of)
        )`
    : sql``;

  return sql`
    select
      p.id as photo_id,
      (row_number() over (order by ${ordering}))::int - 1 as sort_index
    from photo p
    join album a on a.id = ${albumId}
    where p.status = 'ready'
      and not exists (
        select 1 from album_photo ex
        where ex.album_id = ${albumId} and ex.photo_id = p.id and ex.mode = 'exclude'
      )
      and (
        exists (
          select 1 from album_photo pin
          where pin.album_id = ${albumId} and pin.photo_id = p.id and pin.mode = 'include'
        )
        or (
          not exists (
            select 1 from album_rule_tag art
            where art.album_id = ${albumId}
              and not exists (
                select 1 from photo_tag pt
                where pt.photo_id = p.id and pt.tag_id = art.tag_id
              )
          )
          and (a.rule_date_from is null or p.taken_at >= a.rule_date_from)
          and (a.rule_date_to is null or p.taken_at <= a.rule_date_to)
          and (a.rule_min_rating_half is null or p.admin_rating_half >= a.rule_min_rating_half)
          and (
            (a.rule_date_from is null and a.rule_date_to is null)
            or p.taken_at is not null
          )
          ${bestOfClause}
        )
      )
  `;
}

/** A manual album's contents: exactly what was filed, in the order it was filed. */
function manualMembershipSql(albumId: string) {
  return sql`
    select ap.photo_id, ap.sort_index
    from album_photo ap
    join photo p on p.id = ap.photo_id
    where ap.album_id = ${albumId}
      and ap.mode = 'include'
      and p.status = 'ready'
  `;
}

export async function recomputeAlbum(albumId: string, database: Database = db) {
  const [row] = await database
    .select({ source: album.source, kind: album.kind })
    .from(album)
    .where(eq(album.id, albumId))
    .limit(1);

  if (!row) return;

  const members =
    row.source === "rule"
      ? ruleMembershipSql(albumId, row.kind === "best_of")
      : manualMembershipSql(albumId);

  await database.transaction(async (tx) => {
    await tx.execute(sql`delete from album_photo_resolved where album_id = ${albumId}`);
    await tx.execute(sql`
      insert into album_photo_resolved (album_id, photo_id, sort_index)
      select ${albumId}, m.photo_id, m.sort_index from (${members}) m
    `);
  });
}

/**
 * Best of reads the resolved rows of other albums, so it has to be recomputed
 * after them or it will decide membership from a stale picture.
 */
async function recomputeBestOf(database: Database = db) {
  const [bestOf] = await database
    .select({ id: album.id })
    .from(album)
    .where(eq(album.kind, "best_of"))
    .limit(1);
  if (bestOf) await recomputeAlbum(bestOf.id, database);
}

export async function recomputeAllAlbums(database: Database = db) {
  const albums = await database.select({ id: album.id, kind: album.kind }).from(album);
  for (const a of albums) {
    if (a.kind === "best_of") continue;
    await recomputeAlbum(a.id, database);
  }
  await recomputeBestOf(database);
  return albums.length;
}

/**
 * Recomputes every album whose contents this photo could have changed: manual
 * albums holding an override for it, and rule albums whose date window could
 * still admit it. Dated albums get pruned to the single matching day rather
 * than all being rebuilt.
 */
export async function recomputeForPhoto(photoId: string, database: Database = db) {
  const affected = await execRows<{ id: string }>(
    database,
    sql`
      select distinct a.id
      from album a
      left join photo p on p.id = ${photoId}
      where a.kind <> 'best_of'
        and (
          exists (
            select 1 from album_photo ap
            where ap.album_id = a.id and ap.photo_id = ${photoId}
          )
          or (
            a.source = 'rule'
            and (a.rule_date_from is null
                 or (p.taken_at is not null and a.rule_date_from <= p.taken_at))
            and (a.rule_date_to is null
                 or (p.taken_at is not null and a.rule_date_to >= p.taken_at))
          )
        )
    `,
  );

  for (const row of affected) {
    await recomputeAlbum(row.id, database);
  }

  await recomputeBestOf(database);
  return affected.length;
}

/**
 * Finds or creates the dated album covering a capture date, so an import files
 * itself. New dated albums take their visibility from configuration rather than
 * being born public.
 */
export async function ensureDatedAlbum(takenAt: Date, database: Database = db) {
  const from = startOfUtcDay(takenAt);
  const to = endOfUtcDay(takenAt);

  const [existing] = await database
    .select({ id: album.id })
    .from(album)
    .where(and(eq(album.kind, "dated"), eq(album.ruleDateFrom, from)))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await database
    .insert(album)
    .values({
      slug: datedAlbumSlug(from),
      title: datedAlbumTitle(from),
      visibility: config.defaultDatedAlbumVisibility,
      kind: "dated",
      source: "rule",
      ruleDateFrom: from,
      ruleDateTo: to,
      publishedAt: new Date(),
    })
    .onConflictDoNothing({ target: album.slug })
    .returning({ id: album.id });

  const id = created?.id
    ? created.id
    : (
        await database
          .select({ id: album.id })
          .from(album)
          .where(eq(album.slug, datedAlbumSlug(from)))
          .limit(1)
      )[0]?.id;

  if (id && created) {
    await grantAdminsOnAlbum(id, database);
    await recomputeAlbum(id, database);
  }
  return id ?? null;
}

/** Every admin gets view + originals on a newly created album. */
export async function grantAdminsOnAlbum(albumId: string, database: Database = db) {
  const admins = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"));
  if (admins.length === 0) return;
  await database
    .insert(albumAccess)
    .values(
      admins.map((admin) => ({
        albumId,
        userId: admin.id,
        canDownloadOriginals: true,
      })),
    )
    .onConflictDoNothing();
}

export async function grantAdminsOnAllAlbums(database: Database = db) {
  const albums = await database.select({ id: album.id }).from(album);
  for (const row of albums) {
    await grantAdminsOnAlbum(row.id, database);
  }
}

/**
 * Saving a dated album used to round "until" to midnight, emptying the day.
 * Rewrite every dated album's window from its start date so a rebuild can
 * refill the photos that were already uploaded.
 */
export async function restoreDatedAlbumWindows(database: Database = db) {
  const dated = await database
    .select({ id: album.id, ruleDateFrom: album.ruleDateFrom })
    .from(album)
    .where(eq(album.kind, "dated"));

  for (const row of dated) {
    if (!row.ruleDateFrom) continue;
    const from = startOfUtcDay(row.ruleDateFrom);
    const to = endOfUtcDay(row.ruleDateFrom);
    await database
      .update(album)
      .set({ ruleDateFrom: from, ruleDateTo: to, source: "rule", updatedAt: new Date() })
      .where(eq(album.id, row.id));
  }
}

/**
 * A named collection album is 1:1 with a tag. Tagging a photo with that name
 * is what puts it in the album.
 */
export async function ensureCollectionForTag(
  name: string,
  options: { visibility?: "public" | "unlisted" | "restricted" } = {},
  database: Database = db,
): Promise<{ tagId: string; albumId: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A name is required");
  const tagSlug = slugify(trimmed) || "untitled";

  let [existingTag] = await database.select().from(tag).where(eq(tag.slug, tagSlug)).limit(1);
  if (!existingTag) {
    const [inserted] = await database
      .insert(tag)
      .values({ name: trimmed, slug: tagSlug })
      .onConflictDoNothing()
      .returning();
    existingTag =
      inserted ??
      (await database.select().from(tag).where(eq(tag.slug, tagSlug)).limit(1))[0];
  }
  if (!existingTag) throw new Error("Could not create tag");

  const linked = await execRows<{ album_id: string }>(
    database,
    sql`
      select a.id as album_id
      from album a
      join album_rule_tag art on art.album_id = a.id
      where a.kind = 'collection' and art.tag_id = ${existingTag.id}
      limit 1
    `,
  );
  if (linked[0]) return { tagId: existingTag.id, albumId: linked[0].album_id };

  const taken = new Set(
    (await database.select({ slug: album.slug }).from(album)).map((row) => row.slug),
  );
  const [created] = await database
    .insert(album)
    .values({
      slug: uniqueSlug(tagSlug, taken),
      title: trimmed,
      visibility: options.visibility ?? "restricted",
      kind: "collection",
      source: "rule",
      publishedAt: new Date(),
    })
    .returning({ id: album.id });

  await database
    .insert(albumRuleTag)
    .values({ albumId: created.id, tagId: existingTag.id });
  await grantAdminsOnAlbum(created.id, database);
  await recomputeAlbum(created.id, database);
  return { tagId: existingTag.id, albumId: created.id };
}

export async function collectionTagId(albumId: string, database: Database = db) {
  const [row] = await database
    .select({ tagId: albumRuleTag.tagId })
    .from(albumRuleTag)
    .where(eq(albumRuleTag.albumId, albumId))
    .limit(1);
  return row?.tagId ?? null;
}

/** Pair every tag with a collection album; convert leftover manual collections. */
export async function backfillCollectionAlbums(database: Database = db) {
  const manuals = await database
    .select()
    .from(album)
    .where(and(eq(album.kind, "collection"), eq(album.source, "manual")));

  for (const row of manuals) {
    const tagSlug = slugify(row.title) || "untitled";
    let [existingTag] = await database.select().from(tag).where(eq(tag.slug, tagSlug)).limit(1);
    if (!existingTag) {
      const [inserted] = await database
        .insert(tag)
        .values({ name: row.title, slug: tagSlug })
        .onConflictDoNothing()
        .returning();
      existingTag =
        inserted ??
        (await database.select().from(tag).where(eq(tag.slug, tagSlug)).limit(1))[0];
    }
    if (!existingTag) continue;

    await database
      .insert(albumRuleTag)
      .values({ albumId: row.id, tagId: existingTag.id })
      .onConflictDoNothing();

    const members = await database
      .select({ photoId: albumPhoto.photoId })
      .from(albumPhoto)
      .where(and(eq(albumPhoto.albumId, row.id), eq(albumPhoto.mode, "include")));
    if (members.length > 0) {
      await database
        .insert(photoTag)
        .values(members.map((member) => ({ photoId: member.photoId, tagId: existingTag.id })))
        .onConflictDoNothing();
    }

    await database
      .update(album)
      .set({ source: "rule", updatedAt: new Date() })
      .where(eq(album.id, row.id));
  }

  const tags = await database.select({ name: tag.name }).from(tag);
  for (const row of tags) {
    await ensureCollectionForTag(row.name, {}, database);
  }
}

/** Photos in no album at all: not deleted, just unfiled and invisible publicly. */
export async function unfiledPhotoIds(database: Database = db) {
  const rows = await execRows<{ id: string }>(
    database,
    sql`
      select p.id
      from photo p
      where p.status = 'ready'
        and not exists (
          select 1 from album_photo_resolved apr where apr.photo_id = p.id
        )
      order by p.taken_at desc nulls last, p.id desc
    `,
  );
  return rows.map((r) => r.id);
}

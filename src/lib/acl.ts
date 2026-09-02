import { sql } from "drizzle-orm";
import { type Database, db, execRows } from "@/lib/db";
import type { Album } from "@/lib/db/schema";

/**
 * The album is the only unit of permission. Grants are made on albums, to a
 * group or to a person, and a photo inherits them from the albums it is in.
 *
 * Because a photo can be in several albums, inheritance is **most permissive
 * wins**: viewable if any containing album is viewable, downloadable if any of
 * those grants it. Containment always means a row in `album_photo_resolved`,
 * never a rule evaluated here.
 *
 * These functions are the only place visibility is decided. Nothing else may
 * build a photo URL.
 */

export type Access = {
  canView: boolean;
  canDownloadOriginals: boolean;
};

const DENY: Access = { canView: false, canDownloadOriginals: false };
const ADMIN: Access = { canView: true, canDownloadOriginals: true };

function isAdminSql(userId: string | null) {
  if (!userId) return sql`false`;
  return sql`exists (select 1 from "user" u where u.id = ${userId} and u.role = 'admin')`;
}

/** Grants reaching this viewer, whether made to them or to a group they are in. */
function grantSubquery(userId: string) {
  return sql`
    select acc.album_id, bool_or(acc.can_download_originals) as can_download
    from album_access acc
    where acc.user_id = ${userId}
       or acc.group_id in (
            select gm.group_id from group_member gm where gm.user_id = ${userId}
          )
    group by acc.album_id
  `;
}

/** An empty grant set, so the anonymous path stays the same shape as the rest. */
const NO_GRANTS = sql`select null::uuid as album_id, false as can_download where false`;

const grantsCte = (userId: string | null) => (userId ? grantSubquery(userId) : NO_GRANTS);

export async function albumAccess(
  userId: string | null,
  album: Pick<Album, "id" | "visibility">,
  database: Database = db,
): Promise<Access> {
  // Unlisted is viewable by anyone holding the link; it is only kept out of
  // listings. Neither public nor unlisted hands out originals on its own.
  const openToAll = album.visibility === "public" || album.visibility === "unlisted";

  if (!userId) {
    return openToAll ? { canView: true, canDownloadOriginals: false } : DENY;
  }

  const admin = await execRows<{ ok: boolean }>(
    database,
    sql`select (${isAdminSql(userId)}) as ok`,
  );
  if (admin[0]?.ok) return ADMIN;

  // One row if this viewer has a grant on the album, none if they do not.
  const rows = await execRows<{ can_download: boolean }>(
    database,
    sql`
      with grants as (${grantsCte(userId)})
      select g.can_download from grants g where g.album_id = ${album.id} limit 1
    `,
  );

  const grant = rows[0];
  if (!grant) return openToAll ? { canView: true, canDownloadOriginals: false } : DENY;

  return { canView: true, canDownloadOriginals: grant.can_download };
}

export type VisibleAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "collection" | "dated" | "rule" | "best_of";
  visibility: "public" | "unlisted" | "restricted";
  sort_order: number;
  rule_date_from: string | null;
  cover_photo_id: string | null;
  photo_count: number;
  can_download: boolean;
};

/**
 * Everything the viewer may see listed, in browser order: Best of, then
 * collections, then dated albums newest first. Unlisted albums are deliberately
 * absent, since link-only is the whole point of that value.
 */
export async function visibleAlbums(userId: string | null, database: Database = db) {
  return execRows<VisibleAlbum>(
    database,
    sql`
      with grants as (${grantsCte(userId)})
      select
        a.id,
        a.slug,
        a.title,
        a.description,
        a.kind,
        a.visibility,
        a.sort_order,
        a.rule_date_from,
        a.cover_photo_id,
        (select count(*)::int from album_photo_resolved apr where apr.album_id = a.id)
          as photo_count,
        coalesce(g.can_download, false) as can_download
      from album a
      left join grants g on g.album_id = a.id
      where a.visibility = 'public'
         or g.album_id is not null
         or (${isAdminSql(userId)})
      order by
        case a.kind when 'best_of' then 0 when 'collection' then 1 else 2 end,
        a.sort_order,
        a.rule_date_from desc nulls last,
        a.title
    `,
  );
}

/** Most permissive across every album containing the photo. */
export async function photoAccess(
  userId: string | null,
  photoId: string,
  database: Database = db,
): Promise<Access> {
  const rows = await execRows<{ can_view: boolean; can_download: boolean }>(
    database,
    sql`
      with grants as (${grantsCte(userId)}),
      containing as (
        select
          (a.visibility in ('public', 'unlisted') or g.album_id is not null
            or (${isAdminSql(userId)})) as viewable,
          (coalesce(g.can_download, false) or (${isAdminSql(userId)})) as can_download
        from album_photo_resolved apr
        join album a on a.id = apr.album_id
        left join grants g on g.album_id = a.id
        where apr.photo_id = ${photoId}
      )
      select
        coalesce(bool_or(viewable), false) as can_view,
        coalesce(bool_or(viewable and can_download), false) as can_download
      from containing
    `,
  );

  const row = rows[0];
  if (!row?.can_view) return DENY;
  return { canView: true, canDownloadOriginals: row.can_download ?? false };
}

/** Album ids the viewer may see, for use as an IN list. */
export async function visibleAlbumIds(
  userId: string | null,
  database: Database = db,
): Promise<string[]> {
  const rows = await execRows<{ id: string }>(
    database,
    sql`
      with grants as (${grantsCte(userId)})
      select a.id
      from album a
      left join grants g on g.album_id = a.id
      where a.visibility = 'public' or g.album_id is not null or (${isAdminSql(userId)})
    `,
  );
  return rows.map((r) => r.id);
}

/**
 * The albums containing a photo that this viewer can actually browse. Best of
 * shows no source album when this comes back empty, so the existence and title
 * of private albums stay private.
 */
export async function browsableAlbumsForPhoto(
  userId: string | null,
  photoId: string,
  database: Database = db,
) {
  return execRows<{ id: string; slug: string; title: string }>(
    database,
    sql`
      with grants as (${grantsCte(userId)})
      select a.id, a.slug, a.title
      from album_photo_resolved apr
      join album a on a.id = apr.album_id
      left join grants g on g.album_id = a.id
      where apr.photo_id = ${photoId}
        and a.kind <> 'best_of'
        and (a.visibility = 'public' or g.album_id is not null or (${isAdminSql(userId)}))
      order by case a.kind when 'collection' then 0 else 1 end, a.title
    `,
  );
}

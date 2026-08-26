import { inArray, sql } from "drizzle-orm";
import { thumbHashToDataURL } from "thumbhash";
import { type Database, db, execRows } from "@/lib/db";
import { photoVariant } from "@/lib/db/schema";
import { BUCKET_DERIVED, presignDownload } from "@/lib/s3";

export type PhotoRow = {
  id: string;
  width: number | null;
  height: number | null;
  thumbhash: string | null;
  caption: string | null;
  filename: string;
  taken_at: string | null;
  camera: string | null;
  lens: string | null;
  iso: number | null;
  aperture: number | null;
  shutter: string | null;
  focal_length: number | null;
  admin_rating_half: number | null;
  rating_avg: string | null;
  rating_count: number;
};

export type GalleryPhoto = PhotoRow & {
  /** AVIF candidates for the browser to choose from. */
  srcset: string;
  /** The one JPEG, for anything that cannot decode AVIF. */
  src: string;
  aspectRatio: number;
  /** Blurred stand-in shown while the real image loads. */
  placeholder: string | null;
};

/**
 * thumbhash builds the PNG by hand, with no canvas involved, so the data URL
 * can be produced here and the browser never has to ship a decoder.
 */
function placeholderFor(thumbhash: string | null): string | null {
  if (!thumbhash) return null;
  try {
    return thumbHashToDataURL(Buffer.from(thumbhash, "base64"));
  } catch {
    return null;
  }
}

const PHOTO_COLUMNS = sql`
  p.id, p.width, p.height, p.thumbhash, p.caption, p.filename, p.taken_at,
  p.camera, p.lens, p.iso, p.aperture, p.shutter, p.focal_length,
  p.admin_rating_half, p.rating_avg, p.rating_count
`;

/**
 * Attaches presigned URLs to a page of photos. Signing is a local HMAC, so this
 * costs nothing on the network, but the URLs do expire, which is why pages
 * rendering them cannot be cached indefinitely.
 */
export async function withUrls(
  rows: PhotoRow[],
  database: Database = db,
): Promise<GalleryPhoto[]> {
  if (rows.length === 0) return [];

  const variants = await database
    .select()
    .from(photoVariant)
    .where(
      inArray(
        photoVariant.photoId,
        rows.map((r) => r.id),
      ),
    );

  const byPhoto = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = byPhoto.get(variant.photoId) ?? [];
    list.push(variant);
    byPhoto.set(variant.photoId, list);
  }

  return Promise.all(
    rows.map(async (row) => {
      const list = (byPhoto.get(row.id) ?? []).sort((a, b) => a.width - b.width);
      const avif = list.filter((v) => v.format === "avif");
      const jpeg = list.find((v) => v.format === "jpg") ?? avif.at(-1);

      const srcsetParts = await Promise.all(
        avif.map(async (v) => `${await presignDownload(BUCKET_DERIVED, v.key)} ${v.width}w`),
      );

      return {
        ...row,
        srcset: srcsetParts.join(", "),
        src: jpeg ? await presignDownload(BUCKET_DERIVED, jpeg.key) : "",
        aspectRatio: row.width && row.height ? row.width / row.height : 1.5,
        placeholder: placeholderFor(row.thumbhash),
      };
    }),
  );
}

export type AlbumSort = "curated" | "date-desc" | "date-asc" | "rating";

function orderFor(sort: AlbumSort) {
  switch (sort) {
    case "date-desc":
      return sql`p.taken_at desc nulls last, p.id desc`;
    case "date-asc":
      return sql`p.taken_at asc nulls last, p.id asc`;
    case "rating":
      return sql`p.admin_rating_half desc nulls last, p.taken_at desc nulls last`;
    default:
      // The order the album itself defines: manual sequence, or the rule's.
      return sql`apr.sort_index asc`;
  }
}

export async function albumPhotos(
  albumId: string,
  options: { sort?: AlbumSort; limit?: number; offset?: number } = {},
  database: Database = db,
) {
  const { sort = "curated", limit = 500, offset = 0 } = options;

  const rows = await execRows<PhotoRow>(
    database,
    sql`
      select ${PHOTO_COLUMNS}
      from album_photo_resolved apr
      join photo p on p.id = apr.photo_id
      where apr.album_id = ${albumId}
      order by ${orderFor(sort)}
      limit ${limit} offset ${offset}
    `,
  );

  return rows;
}

export type StreamSort = "date-desc" | "date-asc" | "rating";

export type StreamCursor = {
  takenAt: string | null;
  id: string;
  ratingHalf?: number | null;
} | null;

/**
 * The flat stream behind /all. Membership is tested with EXISTS rather than a
 * join so a photo filed in three visible albums still appears exactly once,
 * and paging is keyset rather than offset so it stays fast deep into the
 * library.
 */
export async function streamPhotos(
  visibleIds: string[],
  options: {
    sort?: StreamSort;
    limit?: number;
    cursor?: StreamCursor;
    tagSlug?: string | null;
  } = {},
  database: Database = db,
) {
  const { sort = "date-desc", limit = 60, cursor = null, tagSlug = null } = options;

  if (visibleIds.length === 0) return [];

  const visibility = sql`
    exists (
      select 1
      from album_photo_resolved apr
      where apr.photo_id = p.id
        and apr.album_id in (${sql.join(
          visibleIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
    )
  `;

  const tagFilter = tagSlug
    ? sql`and exists (
          select 1 from photo_tag pt
          join tag t on t.id = pt.tag_id
          where pt.photo_id = p.id and t.slug = ${tagSlug}
        )`
    : sql``;

  // The keyset comparison has to match the ORDER BY exactly or pages overlap.
  // Row comparison treats nulls as larger, which matches `nulls last` on the
  // descending sorts and is why undated photos land at the end either way.
  let keyset = sql``;
  if (cursor) {
    if (sort === "date-desc") {
      keyset = sql`and (p.taken_at, p.id) < (${cursor.takenAt}::timestamptz, ${cursor.id}::uuid)`;
    } else if (sort === "date-asc") {
      keyset = sql`and (p.taken_at, p.id) > (${cursor.takenAt}::timestamptz, ${cursor.id}::uuid)`;
    } else {
      keyset = sql`and (
        coalesce(p.admin_rating_half, -1),
        coalesce(p.taken_at, '-infinity'::timestamptz),
        p.id
      ) < (
        ${cursor.ratingHalf ?? -1}::smallint,
        coalesce(${cursor.takenAt}::timestamptz, '-infinity'::timestamptz),
        ${cursor.id}::uuid
      )`;
    }
  }

  const order =
    sort === "date-asc"
      ? sql`p.taken_at asc nulls last, p.id asc`
      : sort === "rating"
        ? sql`coalesce(p.admin_rating_half, -1) desc,
             coalesce(p.taken_at, '-infinity'::timestamptz) desc, p.id desc`
        : sql`p.taken_at desc nulls last, p.id desc`;

  return execRows<PhotoRow>(
    database,
    sql`
      select ${PHOTO_COLUMNS}
      from photo p
      where p.status = 'ready'
        and ${visibility}
        ${tagFilter}
        ${keyset}
      order by ${order}
      limit ${limit}
    `,
  );
}

/**
 * One cover per album: the chosen cover photo if there is one, otherwise
 * whatever sits first in the album's own order.
 */
export async function albumCovers(
  albumIds: string[],
  database: Database = db,
): Promise<Map<string, GalleryPhoto>> {
  if (albumIds.length === 0) return new Map();

  const rows = await execRows<PhotoRow & { album_id: string }>(
    database,
    sql`
      select a.id as album_id, ${PHOTO_COLUMNS}
      from album a
      join lateral (
        select p.*
        from album_photo_resolved apr
        join photo p on p.id = apr.photo_id
        where apr.album_id = a.id
        order by case when p.id = a.cover_photo_id then 0 else 1 end, apr.sort_index
        limit 1
      ) p on true
      where a.id in (${sql.join(
        albumIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    `,
  );

  const withSrc = await withUrls(rows, database);
  return new Map(withSrc.map((photo, index) => [rows[index].album_id, photo]));
}

export async function photoById(photoId: string, database: Database = db) {
  const rows = await execRows<PhotoRow>(
    database,
    sql`select ${PHOTO_COLUMNS} from photo p where p.id = ${photoId} limit 1`,
  );
  return rows[0] ?? null;
}

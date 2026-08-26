import { sql } from "drizzle-orm";
import { type Database, db, execRows } from "@/lib/db";
import { type PhotoRow, withUrls } from "@/lib/photos";
import { publicReasonsFor } from "@/lib/publish-guard";

/**
 * The admin view of a set of photos: thumbnails, current tags, and whether the
 * photo is publicly visible and through which album.
 */
export async function adminPhotoView(rows: PhotoRow[], database: Database = db) {
  const withSrc = await withUrls(rows, database);
  const ids = rows.map((r) => r.id);

  const [reasons, tagRows] = await Promise.all([
    publicReasonsFor(ids, database),
    ids.length > 0
      ? execRows<{ photo_id: string; tag_id: string }>(
          database,
          sql`
            select photo_id, tag_id from photo_tag
            where photo_id in (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})
          `,
        )
      : Promise.resolve([]),
  ]);

  const tagsByPhoto = new Map<string, string[]>();
  for (const row of tagRows) {
    tagsByPhoto.set(row.photo_id, [...(tagsByPhoto.get(row.photo_id) ?? []), row.tag_id]);
  }

  return withSrc.map((photo) => ({
    photo,
    tagIds: tagsByPhoto.get(photo.id) ?? [],
    publicReason: reasons.get(photo.id) ?? null,
  }));
}

const PHOTO_COLUMNS = sql`
  p.id, p.width, p.height, p.thumbhash, p.caption, p.filename, p.taken_at,
  p.camera, p.lens, p.iso, p.aperture, p.shutter, p.focal_length,
  p.admin_rating_half, p.rating_avg, p.rating_count
`;

export async function recentPhotos(limit = 60, offset = 0, database: Database = db) {
  return execRows<PhotoRow>(
    database,
    sql`
      select ${PHOTO_COLUMNS}
      from photo p
      where p.status = 'ready'
      order by p.taken_at desc nulls last, p.created_at desc
      limit ${limit} offset ${offset}
    `,
  );
}

/** Photos that ended up in no album at all: invisible publicly, not deleted. */
export async function unfiledPhotos(limit = 200, database: Database = db) {
  return execRows<PhotoRow>(
    database,
    sql`
      select ${PHOTO_COLUMNS}
      from photo p
      where p.status = 'ready'
        and not exists (select 1 from album_photo_resolved apr where apr.photo_id = p.id)
      order by p.taken_at desc nulls last, p.created_at desc
      limit ${limit}
    `,
  );
}

export async function photosInAlbum(albumId: string, database: Database = db) {
  return execRows<PhotoRow & { mode: string | null }>(
    database,
    sql`
      select ${PHOTO_COLUMNS},
             (select ap.mode::text from album_photo ap
               where ap.album_id = ${albumId} and ap.photo_id = p.id) as mode
      from album_photo_resolved apr
      join photo p on p.id = apr.photo_id
      where apr.album_id = ${albumId}
      order by apr.sort_index
    `,
  );
}

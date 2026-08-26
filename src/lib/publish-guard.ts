import { sql } from "drizzle-orm";
import { TransactionRollbackError } from "drizzle-orm/errors";
import { type Database, db, execRows } from "@/lib/db";
import { recomputeAllAlbums } from "@/lib/membership";

/**
 * Anything that puts a photo into a public album publishes it, and with rule
 * albums the action that does so can be several steps away from the album it
 * affects: adding a tag, raising a rating past a threshold, widening a rule.
 *
 * So rather than reasoning about which change publishes what, we apply the
 * change for real inside a transaction, recompute membership, diff the set of
 * publicly visible photos, and roll the whole thing back. The answer is then
 * exactly what would have happened, with no rule logic duplicated here.
 */

export type PhotoSummary = {
  id: string;
  filename: string;
  caption: string | null;
  taken_at: string | null;
  thumbhash: string | null;
  album_title: string | null;
};

export type VisibilityDelta = {
  becomingPublic: PhotoSummary[];
  noLongerPublic: PhotoSummary[];
};

/** Photo ids reachable by an anonymous visitor, with the album responsible. */
async function publiclyVisible(database: Database) {
  const rows = await execRows<{ photo_id: string; album_title: string }>(
    database,
    sql`
      select distinct on (apr.photo_id) apr.photo_id, a.title as album_title
      from album_photo_resolved apr
      join album a on a.id = apr.album_id
      where a.visibility = 'public'
      order by apr.photo_id, a.kind = 'best_of', a.title
    `,
  );
  return new Map(rows.map((r) => [r.photo_id, r.album_title]));
}

async function summarise(
  ids: string[],
  titles: Map<string, string>,
  database: Database,
): Promise<PhotoSummary[]> {
  if (ids.length === 0) return [];
  const rows = await execRows<Omit<PhotoSummary, "album_title">>(
    database,
    sql`
      select p.id, p.filename, p.caption, p.taken_at, p.thumbhash
      from photo p
      where p.id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
      order by p.taken_at desc nulls last
      limit 200
    `,
  );
  return rows.map((row) => ({ ...row, album_title: titles.get(row.id) ?? null }));
}

export async function previewVisibilityDelta(
  apply: (tx: Database) => Promise<void>,
  database: Database = db,
): Promise<VisibilityDelta> {
  let delta: VisibilityDelta = { becomingPublic: [], noLongerPublic: [] };

  try {
    await database.transaction(async (tx) => {
      const before = await publiclyVisible(tx as unknown as Database);
      await apply(tx as unknown as Database);
      await recomputeAllAlbums(tx as unknown as Database);
      const after = await publiclyVisible(tx as unknown as Database);

      const gained = [...after.keys()].filter((id) => !before.has(id));
      const lost = [...before.keys()].filter((id) => !after.has(id));

      delta = {
        becomingPublic: await summarise(gained, after, tx as unknown as Database),
        noLongerPublic: await summarise(lost, before, tx as unknown as Database),
      };

      // Nothing about a preview should survive it.
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }

  return delta;
}

/**
 * Why a photo is public, for the badge on admin cards. Prefers a real album
 * over Best of, since "public because it is in Portraits" is more useful than
 * "public because you rated it".
 */
export async function publicReasonsFor(
  photoIds: string[],
  database: Database = db,
): Promise<Map<string, string>> {
  if (photoIds.length === 0) return new Map();

  const rows = await execRows<{ photo_id: string; title: string; kind: string }>(
    database,
    sql`
      select distinct on (apr.photo_id) apr.photo_id, a.title, a.kind::text as kind
      from album_photo_resolved apr
      join album a on a.id = apr.album_id
      where a.visibility = 'public'
        and apr.photo_id in (${sql.join(
          photoIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
      order by apr.photo_id, a.kind = 'best_of', a.title
    `,
  );

  return new Map(
    rows.map((r) => [
      r.photo_id,
      r.kind === "best_of" ? `Public via ${r.title}` : `Public in ${r.title}`,
    ]),
  );
}

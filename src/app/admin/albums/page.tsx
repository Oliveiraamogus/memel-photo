import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, execRows } from "@/lib/db";
import { createAlbum } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  source: string;
  visibility: string;
  contributes_to_best_of: boolean;
  photo_count: number;
};

export default async function AdminAlbumsPage() {
  const albums = await execRows<Row>(
    db,
    sql`
      select a.id, a.slug, a.title, a.kind::text, a.source::text, a.visibility::text,
             a.contributes_to_best_of,
             (select count(*)::int from album_photo_resolved apr where apr.album_id = a.id)
               as photo_count
      from album a
      order by
        case a.kind when 'best_of' then 0 when 'collection' then 1 else 2 end,
        a.sort_order, a.rule_date_from desc nulls last, a.title
    `,
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-medium">Albums</h1>

      <form action={createAlbum} className="panel mb-8 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="title">
            New album
          </label>
          <input id="title" name="title" className="field" placeholder="Family Vacation 2026" required />
        </div>
        <div>
          <label className="label" htmlFor="source">
            Contents
          </label>
          <select id="source" name="source" className="field" defaultValue="manual">
            <option value="manual">Picked by hand, ordered</option>
            <option value="rule">Matched by a rule</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="visibility">
            Visibility
          </label>
          <select id="visibility" name="visibility" className="field" defaultValue="restricted">
            <option value="restricted">Restricted</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <th className="py-2">Title</th>
            <th>Kind</th>
            <th>Contents</th>
            <th>Visibility</th>
            <th className="text-right">Photos</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {albums.map((album) => (
            <tr key={album.id} className="border-b border-[var(--color-line)]">
              <td className="py-2">
                <Link href={`/admin/albums/${album.id}`} className="hover:underline">
                  {album.title}
                </Link>
                {album.contributes_to_best_of && (
                  <span className="ml-2 rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] text-black">
                    feeds Best of
                  </span>
                )}
              </td>
              <td className="text-[var(--color-muted)]">{album.kind}</td>
              <td className="text-[var(--color-muted)]">{album.source}</td>
              <td className={album.visibility === "public" ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}>
                {album.visibility}
              </td>
              <td className="text-right tabular-nums">{album.photo_count}</td>
              <td className="py-2 text-right">
                <Link href={`/a/${album.slug}`} className="text-xs text-[var(--color-muted)] hover:text-white">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, execRows } from "@/lib/db";

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
        case a.kind::text when 'best_of' then 0 when 'collection' then 1 when 'rule' then 1 else 2 end,
        a.sort_order, a.rule_date_from desc nulls last, a.title
    `,
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="text-xl font-medium">Albums</h1>
        <Link href="/admin/albums/new" className="btn btn-primary">
          New album
        </Link>
      </div>

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
                <Link href={`/a/${album.slug}`} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-paper)]">
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

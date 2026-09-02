import Link from "next/link";
import { sql, type SQL } from "drizzle-orm";
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

const SORT_COLUMNS = {
  title: sql`a.title`,
  kind: sql`a.kind::text`,
  source: sql`a.source::text`,
  visibility: sql`a.visibility::text`,
  photos: sql`(select count(*)::int from album_photo_resolved apr where apr.album_id = a.id)`,
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

const DEFAULT_ORDER = sql`
  case a.kind::text when 'best_of' then 0 when 'collection' then 1 when 'rule' then 1 else 2 end,
  a.sort_order, a.rule_date_from desc nulls last, a.title
`;

function parseSort(raw: string | undefined): SortKey | null {
  if (!raw) return null;
  return raw in SORT_COLUMNS ? (raw as SortKey) : null;
}

function parseDir(raw: string | undefined): "asc" | "desc" {
  return raw === "desc" ? "desc" : "asc";
}

function orderByClause(sort: SortKey | null, dir: "asc" | "desc"): SQL {
  if (!sort) return DEFAULT_ORDER;
  const column = SORT_COLUMNS[sort];
  return dir === "desc" ? sql`${column} desc nulls last, a.title` : sql`${column} asc nulls last, a.title`;
}

function sortHref(key: SortKey, current: SortKey | null, dir: "asc" | "desc") {
  const nextDir = current === key && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams({ sort: key, dir: nextDir });
  return `/admin/albums?${params.toString()}`;
}

function SortHeader({
  label,
  column,
  current,
  dir,
  align = "left",
}: {
  label: string;
  column: SortKey;
  current: SortKey | null;
  dir: "asc" | "desc";
  align?: "left" | "right";
}) {
  const active = current === column;
  return (
    <th className={align === "right" ? "py-2 text-right" : "py-2"}>
      <Link
        href={sortHref(column, current, dir)}
        className={`inline-flex items-center gap-1 hover:text-[var(--color-paper)] ${
          active ? "text-[var(--color-paper)]" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span className="text-[10px] tabular-nums" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export default async function AdminAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const dir = parseDir(params.dir);

  const albums = await execRows<Row>(
    db,
    sql`
      select a.id, a.slug, a.title, a.kind::text, a.source::text, a.visibility::text,
             a.contributes_to_best_of,
             (select count(*)::int from album_photo_resolved apr where apr.album_id = a.id)
               as photo_count
      from album a
      order by ${orderByClause(sort, dir)}
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
            <SortHeader label="Title" column="title" current={sort} dir={dir} />
            <SortHeader label="Kind" column="kind" current={sort} dir={dir} />
            <SortHeader label="Contents" column="source" current={sort} dir={dir} />
            <SortHeader label="Visibility" column="visibility" current={sort} dir={dir} />
            <SortHeader label="Photos" column="photos" current={sort} dir={dir} align="right" />
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

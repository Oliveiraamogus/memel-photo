import Link from "next/link";
import { sql } from "drizzle-orm";
import { config } from "@/lib/config";
import { db, execRows } from "@/lib/db";
import { RebuildButton } from "./rebuild-button";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [counts] = await execRows<{
    photos: number;
    ready: number;
    processing: number;
    failed: number;
    albums: number;
    public_photos: number;
    unfiled: number;
  }>(
    db,
    sql`
      select
        (select count(*)::int from photo) as photos,
        (select count(*)::int from photo where status = 'ready') as ready,
        (select count(*)::int from photo where status = 'processing') as processing,
        (select count(*)::int from photo where status = 'failed') as failed,
        (select count(*)::int from album) as albums,
        (select count(distinct apr.photo_id)::int
           from album_photo_resolved apr
           join album a on a.id = apr.album_id
          where a.visibility = 'public') as public_photos,
        (select count(*)::int from photo p
          where p.status = 'ready'
            and not exists (select 1 from album_photo_resolved apr where apr.photo_id = p.id))
          as unfiled
    `,
  );

  const stats = [
    { label: "Photos", value: counts.photos, href: "/admin/photos" },
    { label: "Albums", value: counts.albums, href: "/admin/albums" },
    { label: "Publicly visible", value: counts.public_photos, href: "/a/best-of" },
    { label: "Unfiled", value: counts.unfiled, href: "/admin/unfiled" },
  ];

  return (
    <div>
      <h1 className="mb-8 text-xl font-medium">Overview</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="panel p-4 hover:border-white/30">
            <p className="text-2xl tabular-nums">{stat.value}</p>
            <p className="text-xs text-[var(--color-muted)]">{stat.label}</p>
          </Link>
        ))}
      </div>

      {(counts.processing > 0 || counts.failed > 0) && (
        <p className="mb-8 text-sm text-[var(--color-muted)]">
          {counts.processing > 0 && `${counts.processing} photo(s) still deriving. `}
          {counts.failed > 0 && (
            <span className="text-red-400">
              {counts.failed} failed to process — check the worker logs.
            </span>
          )}
        </p>
      )}

      <section className="panel p-5">
        <h2 className="mb-2 text-sm font-medium">Membership</h2>
        <p className="mb-4 max-w-2xl text-sm text-[var(--color-muted)]">
          Album contents are materialised, and recomputed whenever a tag, rating, capture
          date, rule or override changes. Rebuild if a job failed, or after changing a rule
          you want to be certain about. Best of currently takes photos rated{" "}
          {config.bestOfMinRatingHalf / 2} and above.
        </p>
        <RebuildButton />
      </section>
    </div>
  );
}

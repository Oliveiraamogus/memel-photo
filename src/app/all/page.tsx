import Link from "next/link";
import { asc } from "drizzle-orm";
import { visibleAlbumIds } from "@/lib/acl";
import { db } from "@/lib/db";
import { tag as tagTable } from "@/lib/db/schema";
import { type StreamSort, streamPhotos, withUrls } from "@/lib/photos";
import { getViewer } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { PhotoStream } from "./photo-stream";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

const SORTS: { value: StreamSort; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "rating", label: "Highest rated" },
];

/**
 * Every photo the viewer can reach, as one flat stream. Membership is tested
 * with EXISTS, so a photo filed in three albums they can see still appears once.
 */
export default async function AllPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string }>;
}) {
  const { sort, tag } = await searchParams;
  const viewer = await getViewer();

  const activeSort: StreamSort = SORTS.find((s) => s.value === sort)?.value ?? "date-desc";
  const activeTag = tag ?? null;

  const visibleIds = await visibleAlbumIds(viewer?.id ?? null);
  const rows = await streamPhotos(visibleIds, {
    sort: activeSort,
    limit: PAGE_SIZE + 1,
    tagSlug: activeTag,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const photos = await withUrls(page);
  const last = page.at(-1);

  const tags = await db
    .select({ slug: tagTable.slug, name: tagTable.name })
    .from(tagTable)
    .orderBy(asc(tagTable.name));

  const link = (next: { sort?: string; tag?: string | null }) => {
    const params = new URLSearchParams();
    params.set("sort", next.sort ?? activeSort);
    const nextTag = next.tag === undefined ? activeTag : next.tag;
    if (nextTag) params.set("tag", nextTag);
    return `/all?${params}`;
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light">All photos</h1>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Everything from every album you can see.
            </p>
          </div>
          <nav className="flex gap-1 text-xs">
            {SORTS.map((option) => (
              <Link
                key={option.value}
                href={link({ sort: option.value })}
                className={`btn ${activeSort === option.value ? "btn-primary" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        {tags.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-2 text-xs">
            <Link href={link({ tag: null })} className={`btn ${!activeTag ? "btn-primary" : ""}`}>
              All
            </Link>
            {tags.map((t) => (
              <Link
                key={t.slug}
                href={link({ tag: t.slug })}
                className={`btn ${activeTag === t.slug ? "btn-primary" : ""}`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        <PhotoStream
          initialPhotos={photos}
          initialCursor={
            last
              ? { id: last.id, takenAt: last.taken_at, ratingHalf: last.admin_rating_half }
              : null
          }
          initialHasMore={hasMore}
          sort={activeSort}
          tag={activeTag}
          canVote={Boolean(viewer)}
        />
      </main>
    </>
  );
}

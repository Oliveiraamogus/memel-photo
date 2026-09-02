import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { albumAccess } from "@/lib/acl";
import { db } from "@/lib/db";
import { album } from "@/lib/db/schema";
import { type AlbumSort, albumPhotos, withUrls } from "@/lib/photos";
import { getViewer } from "@/lib/session";
import { PhotoGrid } from "@/components/photo-grid";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

const SORTS: { value: AlbumSort; label: string }[] = [
  { value: "curated", label: "Album order" },
  { value: "date-desc", label: "Newest" },
  { value: "date-asc", label: "Oldest" },
  { value: "rating", label: "Rating" },
];

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const viewer = await getViewer();

  const [found] = await db.select().from(album).where(eq(album.slug, slug)).limit(1);
  if (!found) notFound();

  const access = await albumAccess(viewer?.id ?? null, found);
  // A restricted album a viewer cannot see is indistinguishable from one that
  // does not exist, so its title never leaks through a 403.
  if (!access.canView) notFound();

  // "Album order" is whatever the album itself defines: the manual sequence, or
  // the rule's own ordering, which for Best of is already rating first.
  const activeSort: AlbumSort = SORTS.find((s) => s.value === sort)?.value ?? "curated";

  const rows = await albumPhotos(found.id, { sort: activeSort });
  const photos = await withUrls(rows);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-paper)]">
              ← Albums
            </Link>
            <h1 className="mt-1 text-2xl font-light">{found.title}</h1>
            {found.description && (
              <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
                {found.description}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {photos.length} photo{photos.length === 1 ? "" : "s"}
              {access.canDownloadOriginals && " · originals available"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {access.canDownloadOriginals && photos.length > 0 && (
              <a href={`/api/albums/${slug}/download`} className="btn">
                Download album
              </a>
            )}
            <nav className="flex gap-1 text-xs">
              {SORTS.map((option) => (
                <Link
                  key={option.value}
                  href={`/a/${slug}?sort=${option.value}`}
                  className={`btn ${activeSort === option.value ? "btn-primary" : ""}`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <PhotoGrid
          photos={photos}
          canVote={Boolean(viewer)}
        />
      </main>
    </>
  );
}

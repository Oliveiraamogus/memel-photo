import { visibleAlbums } from "@/lib/acl";
import { albumCovers, albumRatingAverages } from "@/lib/photos";
import { getViewer } from "@/lib/session";
import { AlbumCard, type AlbumCardData } from "@/components/album-card";
import { SiteHeader } from "@/components/site-header";

// Personalised, so it cannot be one static page. The anonymous version is the
// one that gets the traffic and is cached at the reverse proxy (see middleware).
export const dynamic = "force-dynamic";

/**
 * The landing page is the album browser, and it is personalised: signed out it
 * shows the public albums, signed in it adds the ones granted to that person or
 * their groups. That is why there is no separate index and no "shared with me".
 */
export default async function HomePage() {
  const viewer = await getViewer();
  const albums = await visibleAlbums(viewer?.id ?? null);

  const nonEmpty = albums.filter((a) => a.photo_count > 0 || a.kind === "best_of");
  const ids = nonEmpty.map((a) => a.id);
  const [covers, ratings] = await Promise.all([
    albumCovers(ids),
    albumRatingAverages(ids),
  ]);

  const decorate = (album: (typeof nonEmpty)[number]): AlbumCardData => ({
    ...album,
    cover: covers.get(album.id) ?? null,
    ratingAvg: ratings.get(album.id) ?? null,
  });

  const bestOf = nonEmpty.filter((a) => a.kind === "best_of").map(decorate);
  const collections = nonEmpty
    .filter((a) => a.kind === "collection" || a.kind === "rule")
    .map(decorate);
  const dated = nonEmpty.filter((a) => a.kind === "dated").map(decorate);

  const byYear = new Map<string, AlbumCardData[]>();
  for (const album of dated) {
    const year = album.rule_date_from
      ? new Date(album.rule_date_from).getUTCFullYear().toString()
      : "Undated";
    byYear.set(year, [...(byYear.get(year) ?? []), album]);
  }

  const empty = nonEmpty.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1600px] px-6 py-10">
        {empty ? (
          <p className="py-24 text-center text-sm text-[var(--color-muted)]">
            Nothing published yet.
          </p>
        ) : (
          <>
            {bestOf.length > 0 && (
              <section className="mb-12">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {bestOf.map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
                </div>
              </section>
            )}

            {collections.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-4 text-sm uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  Collections
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {collections.map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
                </div>
              </section>
            )}

            {dated.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  By date
                </h2>
                {/* Grouped by year once there are enough to need it. */}
                {byYear.size > 3 ? (
                  [...byYear.entries()].map(([year, list]) => (
                    <div key={year} className="mb-8">
                      <h3 className="mb-3 text-xs text-[var(--color-muted)]">{year}</h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {list.map((album) => (
                          <AlbumCard key={album.id} album={album} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {dated.map((album) => (
                      <AlbumCard key={album.id} album={album} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

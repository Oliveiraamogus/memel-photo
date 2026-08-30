import Link from "next/link";
import type { VisibleAlbum } from "@/lib/acl";
import { StarDisplay } from "@/components/stars";
import { formatAverage } from "@/lib/rating";

export type AlbumCardData = VisibleAlbum & {
  cover: { src: string; srcset: string } | null;
  /** Mean photographer rating across rated photos in the album, in stars. */
  ratingAvg: number | null;
};


export function AlbumCard({ album }: { album: AlbumCardData }) {
  return (
    <Link
      href={`/a/${album.slug}`}
      className="panel group block overflow-hidden transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--color-thumb)]">
        {album.cover ? (
          <img
            src={album.cover.src}
            srcSet={album.cover.srcset}
            sizes="(max-width: 768px) 100vw, 33vw"
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
            Empty
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <span className="min-w-0 flex-1 truncate">{album.title}</span>
        {album.ratingAvg != null && (
          <>
            <span className="shrink-0 text-[var(--color-line)]" aria-hidden>
              |
            </span>
            <span className="shrink-0 text-[var(--color-muted)]">
              <StarDisplay average={album.ratingAvg} size={11} />
              <span className="tabular-nums text-[var(--color-muted)]">
                {album.ratingAvg != null ? `${formatAverage(album.ratingAvg)}` : "No votes yet"}
              </span>
            </span>
          </>
        )}
        <span className="shrink-0 text-[var(--color-line)]" aria-hidden>
          |
        </span>
        <span className="shrink-0 text-xs text-[var(--color-muted)]">
          {album.photo_count} photo{album.photo_count === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}

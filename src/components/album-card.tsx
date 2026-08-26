import Link from "next/link";
import type { VisibleAlbum } from "@/lib/acl";

export type AlbumCardData = VisibleAlbum & { cover: { src: string; srcset: string } | null };

export function AlbumCard({ album }: { album: AlbumCardData }) {
  return (
    <Link
      href={`/a/${album.slug}`}
      className="panel group block overflow-hidden transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[#101014]">
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
      <div className="flex items-baseline justify-between gap-3 px-4 py-3">
        <span className="truncate text-sm">{album.title}</span>
        <span className="shrink-0 text-xs text-[var(--color-muted)]">
          {album.photo_count} photo{album.photo_count === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}

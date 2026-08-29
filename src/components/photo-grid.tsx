"use client";

import { useCallback, useState } from "react";
import type { GalleryPhoto } from "@/lib/photos";
import { Lightbox } from "./lightbox";

/**
 * A justified grid: every row is filled edge to edge by letting each photo grow
 * in proportion to its aspect ratio. The trailing pseudo-element soaks up the
 * slack so a short last row does not stretch into absurd sizes.
 */
export function PhotoGrid({
  photos,
  targetRowHeight = 240,
  canVote = false,
  onOpen,
}: {
  photos: GalleryPhoto[];
  targetRowHeight?: number;
  canVote?: boolean;
  /** When set, the parent owns the lightbox (so next/prev can span groups). */
  onOpen?: (index: number) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const move = useCallback(
    (delta: number) =>
      setOpenIndex((current) => {
        if (current === null) return null;
        const next = current + delta;
        if (next < 0 || next >= photos.length) return current;
        return next;
      }),
    [photos.length],
  );

  if (photos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[var(--color-muted)]">
        Nothing here yet.
      </p>
    );
  }

  const lightboxIndex = onOpen ? null : openIndex;

  return (
    <>
      <div className="flex flex-wrap gap-2 after:grow-[999] after:content-['']">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => (onOpen ? onOpen(index) : setOpenIndex(index))}
            className="relative block cursor-zoom-in overflow-hidden bg-[var(--color-ink-soft)]"
            style={{
              flexGrow: photo.aspectRatio,
              flexBasis: `${photo.aspectRatio * targetRowHeight}px`,
              height: `${targetRowHeight}px`,
              // The blurred stand-in sits underneath, so the real image fades in
              // over something the right shape and colour instead of a hole.
              backgroundImage: photo.placeholder ? `url(${photo.placeholder})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <img
              src={photo.src}
              srcSet={photo.srcset}
              sizes="(max-width: 640px) 100vw, 40vw"
              alt={photo.caption ?? photo.filename}
              loading="lazy"
              decoding="async"
              onLoad={(event) => event.currentTarget.classList.remove("opacity-0")}
              // An image already in cache never fires load, so it has to be
              // revealed on mount or it would stay invisible over the blur.
              ref={(node) => {
                if (node?.complete) node.classList.remove("opacity-0");
              }}
              className="h-full w-full object-cover opacity-0 transition-opacity duration-500"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photo={photos[lightboxIndex]}
          hasPrevious={lightboxIndex > 0}
          hasNext={lightboxIndex < photos.length - 1}
          onPrevious={() => move(-1)}
          onNext={() => move(1)}
          onClose={close}
          canVote={canVote}
        />
      )}
    </>
  );
}

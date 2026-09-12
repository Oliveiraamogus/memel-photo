"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePhotos } from "@/app/admin/actions";
import type { GalleryPhoto } from "@/lib/photos";
import { toggleRange } from "@/lib/selection";
import { Lightbox } from "./lightbox";
import { SelectablePhoto } from "./selectable-photo";
import { SelectionBar } from "./selection-bar";

/**
 * A justified grid: every row is filled edge to edge by letting each photo grow
 * in proportion to its aspect ratio. The trailing pseudo-element soaks up the
 * slack so a short last row does not stretch into absurd sizes.
 */
export function PhotoGrid({
  photos,
  targetRowHeight = 240,
  canVote = false,
  canManage = false,
  canSetAdminRating = false,
  bestOfThreshold,
  onOpen,
  selectedIds,
  onToggleSelect,
  badgeFor,
}: {
  photos: GalleryPhoto[];
  targetRowHeight?: number;
  canVote?: boolean;
  canManage?: boolean;
  canSetAdminRating?: boolean;
  bestOfThreshold?: number;
  /** When set, the parent owns the lightbox (so next/prev can span groups). */
  onOpen?: (index: number) => void;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string, index: number, shift: boolean) => void;
  badgeFor?: (photo: GalleryPhoto) => ReactNode;
}) {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [ownedSelected, setOwnedSelected] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<number | null>(null);

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

  const selected = selectedIds ?? ownedSelected;
  const ownsSelection = canManage && !onToggleSelect;

  useEffect(() => {
    if (!ownsSelection) return;
    const ids = new Set(photos.map((photo) => photo.id));
    setOwnedSelected((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [photos, ownsSelection]);

  function handleToggle(id: string, index: number, shift: boolean) {
    if (onToggleSelect) {
      onToggleSelect(id, index, shift);
      return;
    }
    setOwnedSelected((current) =>
      toggleRange(
        current,
        photos.map((photo) => photo.id),
        index,
        shift,
        anchorRef.current,
      ),
    );
    anchorRef.current = index;
  }

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
      {ownsSelection && (
        <SelectionBar
          count={ownedSelected.size}
          onClear={() => setOwnedSelected(new Set())}
          onDelete={async () => {
            await deletePhotos([...ownedSelected]);
            setOwnedSelected(new Set());
            router.refresh();
          }}
        />
      )}

      <div className="flex flex-wrap gap-2 after:grow-[999] after:content-['']">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative overflow-hidden bg-[var(--color-ink-soft)]"
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
            <SelectablePhoto
              filename={photo.filename}
              selected={selected.has(photo.id)}
              selectable={canManage}
              onToggle={(shift) => handleToggle(photo.id, index, shift)}
              onOpen={() => (onOpen ? onOpen(index) : setOpenIndex(index))}
              badge={badgeFor?.(photo)}
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
            </SelectablePhoto>
          </div>
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
          canSetAdminRating={canSetAdminRating}
          bestOfThreshold={bestOfThreshold}
          onDeleted={() => router.refresh()}
        />
      )}
    </>
  );
}

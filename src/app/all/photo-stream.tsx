"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deletePhotos } from "@/app/admin/actions";
import type { GalleryPhoto } from "@/lib/photos";
import { toggleRange } from "@/lib/selection";
import { datedAlbumTitle } from "@/lib/slug";
import { Lightbox } from "@/components/lightbox";
import { PhotoGrid } from "@/components/photo-grid";
import { SelectionBar } from "@/components/selection-bar";

type Cursor = { id: string; takenAt: string | null; ratingHalf: number | null } | null;

function dayLabel(value: string | null) {
  if (!value) return "Undated";
  return datedAlbumTitle(new Date(value));
}

/** Groups a run of photos under date headers without reordering them. */
function groupByDay(photos: GalleryPhoto[]) {
  const groups: { label: string; photos: GalleryPhoto[] }[] = [];
  for (const photo of photos) {
    const label = dayLabel(photo.taken_at);
    const last = groups.at(-1);
    if (last?.label === label) last.photos.push(photo);
    else groups.push({ label, photos: [photo] });
  }
  return groups;
}

export function PhotoStream({
  initialPhotos,
  initialCursor,
  initialHasMore,
  sort,
  tag,
  canVote,
  canManage = false,
}: {
  initialPhotos: GalleryPhoto[];
  initialCursor: Cursor;
  initialHasMore: boolean;
  sort: string;
  tag: string | null;
  canVote: boolean;
  canManage?: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [cursor, setCursor] = useState<Cursor>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPhotos(initialPhotos);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    setOpenIndex(null);
    setSelected(new Set());
    anchorRef.current = null;
  }, [initialPhotos, initialCursor, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return;
    setLoading(true);

    const params = new URLSearchParams({ sort, cursorId: cursor.id });
    if (cursor.takenAt) params.set("cursorTakenAt", cursor.takenAt);
    if (cursor.ratingHalf != null) params.set("cursorRating", String(cursor.ratingHalf));
    if (tag) params.set("tag", tag);

    const response = await fetch(`/api/stream?${params}`);
    if (response.ok) {
      const data = await response.json();
      setPhotos((current) => [...current, ...data.photos]);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    }
    setLoading(false);
  }, [cursor, hasMore, loading, sort, tag]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  function toggleSelect(id: string, globalIndex: number, shift: boolean) {
    setSelected((current) =>
      toggleRange(
        current,
        photos.map((photo) => photo.id),
        globalIndex,
        shift,
        anchorRef.current,
      ),
    );
    anchorRef.current = globalIndex;
  }

  const grouped = sort === "rating" ? null : groupByDay(photos);

  if (photos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[var(--color-muted)]">
        Nothing here yet.
      </p>
    );
  }

  return (
    <>
      {canManage && (
        <SelectionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onDelete={async () => {
            const ids = [...selected];
            const removing = new Set(ids);
            setPhotos((current) => current.filter((photo) => !removing.has(photo.id)));
            setSelected(new Set());
            setOpenIndex((current) => {
              if (current === null) return null;
              if (removing.has(photos[current]?.id)) return null;
              const remaining = photos.filter((photo) => !removing.has(photo.id));
              const still = remaining.findIndex((photo) => photo.id === photos[current]?.id);
              return still >= 0 ? still : null;
            });
            await deletePhotos(ids);
          }}
        />
      )}

      {grouped ? (
        grouped.map((group, groupIndex) => {
          const offset = grouped
            .slice(0, groupIndex)
            .reduce((sum, item) => sum + item.photos.length, 0);
          return (
            <section key={`${group.label}-${offset}`} className="mb-8">
              <h2 className="mb-3 flex items-center gap-3 text-xs tracking-[0.08em] text-[var(--color-muted)]">
                <span className="shrink-0 tabular-nums">{group.label}</span>
                <span className="h-px min-w-8 flex-1 bg-[var(--color-line)]" />
              </h2>
              <PhotoGrid
                photos={group.photos}
                canVote={canVote}
                canManage={canManage}
                selectedIds={selected}
                onToggleSelect={(id, index, shift) => toggleSelect(id, offset + index, shift)}
                onOpen={(index) => setOpenIndex(offset + index)}
              />
            </section>
          );
        })
      ) : (
        <PhotoGrid
          photos={photos}
          canVote={canVote}
          canManage={canManage}
          selectedIds={selected}
          onToggleSelect={(id, index, shift) => toggleSelect(id, index, shift)}
          onOpen={(index) => setOpenIndex(index)}
        />
      )}

      {openIndex !== null && photos[openIndex] && (
        <Lightbox
          photo={photos[openIndex]}
          hasPrevious={openIndex > 0}
          hasNext={openIndex < photos.length - 1}
          onPrevious={() => setOpenIndex((current) => (current === null ? null : current - 1))}
          onNext={() => setOpenIndex((current) => (current === null ? null : current + 1))}
          onClose={() => setOpenIndex(null)}
          canVote={canVote}
        />
      )}

      <div ref={sentinel} className="h-10" />

      <p className="py-6 text-center text-xs text-[var(--color-muted)]">
        {loading
          ? "Loading..."
          : hasMore
            ? "Scroll for more"
            : photos.length > 0
              ? "That's everything."
              : ""}
      </p>
    </>
  );
}

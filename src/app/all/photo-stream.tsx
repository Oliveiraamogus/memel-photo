"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/lib/photos";
import { PhotoGrid } from "@/components/photo-grid";

type Cursor = { id: string; takenAt: string | null; ratingHalf: number | null } | null;

function monthLabel(value: string | null) {
  if (!value) return "Undated";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

/** Groups a run of photos under date headers without reordering them. */
function groupByMonth(photos: GalleryPhoto[]) {
  const groups: { label: string; photos: GalleryPhoto[] }[] = [];
  for (const photo of photos) {
    const label = monthLabel(photo.taken_at);
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
}: {
  initialPhotos: GalleryPhoto[];
  initialCursor: Cursor;
  initialHasMore: boolean;
  sort: string;
  tag: string | null;
  canVote: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [cursor, setCursor] = useState<Cursor>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // A new sort or filter is a different stream, not more of the same one.
  useEffect(() => {
    setPhotos(initialPhotos);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
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

  // Date headers only make sense while the stream is in date order.
  const grouped = sort === "rating" ? null : groupByMonth(photos);

  return (
    <>
      {grouped ? (
        grouped.map((group) => (
          <section key={group.label} className="mb-10">
            <h2 className="mb-3 text-sm uppercase tracking-[0.08em] text-[var(--color-muted)]">
              {group.label}
            </h2>
            <PhotoGrid photos={group.photos} canVote={canVote} />
          </section>
        ))
      ) : (
        <PhotoGrid photos={photos} canVote={canVote} />
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

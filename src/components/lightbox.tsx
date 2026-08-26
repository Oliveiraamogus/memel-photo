"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAverage, formatStars, parseAverage } from "@/lib/rating";
import type { GalleryPhoto } from "@/lib/photos";
import { StarDisplay, StarInput } from "./stars";

type Details = {
  albums: { slug: string; title: string }[];
  canDownloadOriginals: boolean;
  ratingAvg: string | null;
  ratingCount: number;
  myRatingHalf: number | null;
};

export function Lightbox({
  photo,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onClose,
  canVote,
}: {
  photo: GalleryPhoto;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  canVote: boolean;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrevious) onPrevious();
      if (event.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious]);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    fetch(`/api/photos/${photo.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  async function vote(half: number) {
    setSaving(true);
    const response = await fetch(`/api/photos/${photo.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueHalf: half }),
    });
    if (response.ok) {
      const data = await response.json();
      setDetails((current) =>
        current
          ? {
              ...current,
              ratingAvg: data.ratingAvg,
              ratingCount: data.ratingCount,
              myRatingHalf: half,
            }
          : current,
      );
    }
    setSaving(false);
  }

  const average = parseAverage(details?.ratingAvg ?? photo.rating_avg);
  const count = details?.ratingCount ?? photo.rating_count;
  const exif = [
    photo.camera,
    photo.lens,
    photo.focal_length ? `${Math.round(photo.focal_length)}mm` : null,
    photo.aperture ? `f/${photo.aperture}` : null,
    photo.shutter,
    photo.iso ? `ISO ${photo.iso}` : null,
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? photo.filename}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-[var(--color-muted)]">
          {photo.taken_at
            ? new Date(photo.taken_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : ""}
        </span>
        <button type="button" className="btn" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {hasPrevious && (
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous photo"
            className="absolute left-2 z-10 px-4 py-8 text-2xl text-white/60 hover:text-white"
          >
            ‹
          </button>
        )}

        <img
          src={photo.src}
          srcSet={photo.srcset}
          sizes="100vw"
          alt={photo.caption ?? photo.filename}
          className="max-h-full max-w-full object-contain"
        />

        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="absolute right-2 z-10 px-4 py-8 text-2xl text-white/60 hover:text-white"
          >
            ›
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4 text-sm">
        {photo.caption && <p className="w-full">{photo.caption}</p>}

        <div>
          <span className="label">Photographer&apos;s pick</span>
          {photo.admin_rating_half != null ? (
            <span className="flex items-center gap-2">
              <StarDisplay half={photo.admin_rating_half} />
              <span className="tabular-nums text-[var(--color-muted)]">
                {formatStars(photo.admin_rating_half)}
              </span>
            </span>
          ) : (
            <span className="text-[var(--color-muted)]">Not rated</span>
          )}
        </div>

        <div>
          <span className="label">Viewers</span>
          {canVote ? (
            <span className={saving ? "opacity-50" : ""}>
              <StarInput
                value={details?.myRatingHalf ?? null}
                onChange={(half) => void vote(half)}
                disabled={saving}
                size={16}
              />
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <StarDisplay average={average} />
              <span className="tabular-nums text-[var(--color-muted)]">
                {average != null ? `${formatAverage(average)} (${count})` : "No votes yet"}
              </span>
            </span>
          )}
          {canVote && average != null && (
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              Average {formatAverage(average)} from {count} vote{count === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {exif.length > 0 && (
          <div className="text-[var(--color-muted)]">
            <span className="label">Shot with</span>
            {exif.join(" · ")}
          </div>
        )}

        {/* Absent when the viewer cannot browse any album holding this photo, so
            the existence of a private album is not leaked through Best of. */}
        {details && details.albums.length > 0 && (
          <div>
            <span className="label">In</span>
            {details.albums.map((album, index) => (
              <span key={album.slug}>
                {index > 0 && ", "}
                <Link href={`/a/${album.slug}`} className="underline hover:text-white">
                  {album.title}
                </Link>
              </span>
            ))}
          </div>
        )}

        {details?.canDownloadOriginals && (
          <a className="btn ml-auto" href={`/api/photos/${photo.id}/original`}>
            Download original
          </a>
        )}
      </div>
    </div>
  );
}

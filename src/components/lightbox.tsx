"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const TOGGLE_SCALE = 2.5;

type Transform = { scale: number; x: number; y: number };

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function zoomToward(
  prev: Transform,
  nextScale: number,
  clientX: number,
  clientY: number,
  image: DOMRect,
): Transform {
  const scale = clampScale(nextScale);
  if (scale <= MIN_SCALE) return { scale: MIN_SCALE, x: 0, y: 0 };
  const ratio = scale / prev.scale;
  const cx = image.left + image.width / 2;
  const cy = image.top + image.height / 2;
  return {
    scale,
    x: prev.x + (clientX - cx) * (1 - ratio),
    y: prev.y + (clientY - cy) * (1 - ratio),
  };
}

function LightboxImage({ photo }: { photo: GalleryPhoto }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  const applyZoom = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const image = imageRef.current;
    if (!image) return;
    setTransform((prev) => zoomToward(prev, nextScale, clientX, clientY, image.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
    pointers.current.clear();
    pan.current = null;
    pinch.current = null;
  }, [photo.id]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyZoom(event.clientX, event.clientY, transformRef.current.scale * factor);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  function pointerList() {
    return [...pointers.current.values()];
  }

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = pointerList();
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: transformRef.current.scale,
      };
      pan.current = null;
      return;
    }

    moved.current = false;
    if (transformRef.current.scale > 1) {
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = {
        x: event.clientX,
        y: event.clientY,
        tx: transformRef.current.x,
        ty: transformRef.current.y,
      };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = pointerList();
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 1 || pinch.current.distance < 1) return;
      applyZoom(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        pinch.current.scale * (distance / pinch.current.distance),
      );
      return;
    }

    if (pan.current && pointers.current.size === 1) {
      const dx = event.clientX - pan.current.x;
      const dy = event.clientY - pan.current.y;
      if (Math.hypot(dx, dy) > 3) moved.current = true;
      setTransform({
        scale: transformRef.current.scale,
        x: pan.current.tx + dx,
        y: pan.current.ty + dy,
      });
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    pan.current = null;
    if (pointers.current.size < 2) pinch.current = null;

    if (event.pointerType === "touch" && !moved.current && pointers.current.size === 0) {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        toggleZoom(event.clientX, event.clientY);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  }

  function toggleZoom(clientX: number, clientY: number) {
    const next = transformRef.current.scale > 1.05 ? MIN_SCALE : TOGGLE_SCALE;
    applyZoom(clientX, clientY, next);
  }

  function onDoubleClick(event: React.MouseEvent) {
    event.preventDefault();
    toggleZoom(event.clientX, event.clientY);
  }

  const zoomed = transform.scale > 1.01;

  return (
    <div
      ref={stageRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
    >
      <img
        ref={imageRef}
        src={photo.src}
        srcSet={photo.srcset}
        sizes="100vw"
        alt={photo.caption ?? photo.filename}
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        className="max-h-full max-w-full object-contain will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          cursor: zoomed ? "grab" : "zoom-in",
          touchAction: "none",
        }}
      />
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-overlay)]"
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

        <LightboxImage photo={photo} />

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

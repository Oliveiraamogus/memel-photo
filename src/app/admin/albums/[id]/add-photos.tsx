"use client";

import { useRef, useState, useTransition } from "react";
import { addPhotosToAlbum, searchPhotos } from "@/app/admin/actions";
import type { GalleryPhoto } from "@/lib/photos";
import { toggleRange } from "@/lib/selection";

export function AddPhotos({ albumId }: { albumId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GalleryPhoto[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const anchorRef = useRef<number | null>(null);

  async function run(term: string) {
    setQuery(term);
    setResults(await searchPhotos(term));
    anchorRef.current = null;
  }

  function toggle(index: number, shift: boolean) {
    setChosen((current) =>
      toggleRange(
        current,
        results.map((photo) => photo.id),
        index,
        shift,
        anchorRef.current,
      ),
    );
    anchorRef.current = index;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn"
        onClick={() => {
          setOpen(true);
          void run("");
        }}
      >
        Add photos
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay-soft)] p-6">
      <div className="panel flex max-h-[80vh] w-full max-w-3xl flex-col p-5">
        <h2 className="mb-3 text-sm font-medium">Add photos to this album</h2>
        <input
          className="field mb-3"
          placeholder="Search by filename or caption"
          value={query}
          onChange={(e) => void run(e.target.value)}
        />

        <div className="mb-4 min-h-0 flex-1 overflow-auto">
          {results.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nothing matches.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {results.map((result, index) => {
                const active = chosen.has(result.id);
                return (
                  <button
                    key={result.id}
                    type="button"
                    title={result.caption || result.filename}
                    onClick={(event) => toggle(index, event.shiftKey)}
                    className={`relative aspect-square overflow-hidden rounded border ${
                      active
                        ? "border-[var(--color-accent)]"
                        : "border-transparent"
                    }`}
                  >
                    <img
                      src={result.src}
                      srcSet={result.srcset}
                      sizes="120px"
                      alt={result.caption ?? result.filename}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {active && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm bg-[var(--color-accent)] text-[10px] font-medium text-black">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || chosen.size === 0}
            onClick={() =>
              startTransition(async () => {
                await addPhotosToAlbum(albumId, [...chosen]);
                setChosen(new Set());
                setOpen(false);
              })
            }
          >
            Add {chosen.size > 0 ? chosen.size : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

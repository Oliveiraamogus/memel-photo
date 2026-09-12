"use client";

import { useState, useTransition } from "react";
import { addPhotosToAlbum, searchPhotos } from "@/app/admin/actions";
import type { GalleryPhoto } from "@/lib/photos";
import { useShiftSelection } from "@/lib/use-shift-selection";
import { Lightbox } from "@/components/lightbox";
import { SelectablePhoto } from "@/components/selectable-photo";

export function AddPhotos({ albumId }: { albumId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GalleryPhoto[]>([]);
  const ids = results.map((photo) => photo.id);
  const { selected: chosen, setSelected: setChosen, toggle } = useShiftSelection(ids);
  const [pending, startTransition] = useTransition();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  async function run(term: string) {
    setQuery(term);
    setResults(await searchPhotos(term));
    setChosen(new Set());
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

  const viewing = openIndex !== null ? results[openIndex] : null;

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
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className={`relative aspect-square overflow-hidden rounded border ${
                    chosen.has(result.id)
                      ? "border-[var(--color-accent)]"
                      : "border-transparent"
                  }`}
                >
                  <SelectablePhoto
                    filename={result.filename}
                    selected={chosen.has(result.id)}
                    onToggle={(shift) => toggle(result.id, shift)}
                    onOpen={() => setOpenIndex(index)}
                  >
                    <img
                      src={result.src}
                      srcSet={result.srcset}
                      sizes="120px"
                      alt={result.caption ?? result.filename}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </SelectablePhoto>
                </div>
              ))}
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

      {viewing && (
        <Lightbox
          photo={viewing}
          hasPrevious={openIndex! > 0}
          hasNext={openIndex! < results.length - 1}
          onPrevious={() => setOpenIndex((current) => (current === null ? null : current - 1))}
          onNext={() => setOpenIndex((current) => (current === null ? null : current + 1))}
          onClose={() => setOpenIndex(null)}
          canVote
        />
      )}
    </div>
  );
}

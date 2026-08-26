"use client";

import { useState, useTransition } from "react";
import { addPhotosToAlbum, searchPhotos } from "@/app/admin/actions";

type Result = {
  id: string;
  filename: string;
  caption: string | null;
  takenAt: Date | null;
};

export function AddPhotos({ albumId }: { albumId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  async function run(term: string) {
    setQuery(term);
    setResults(await searchPhotos(term));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="panel flex max-h-[80vh] w-full max-w-xl flex-col p-5">
        <h2 className="mb-3 text-sm font-medium">Add photos to this album</h2>
        <input
          className="field mb-3"
          placeholder="Search by filename or caption"
          value={query}
          onChange={(e) => void run(e.target.value)}
        />

        <ul className="mb-4 min-h-0 flex-1 space-y-1 overflow-auto text-sm">
          {results.map((result) => {
            const active = chosen.includes(result.id);
            return (
              <li key={result.id}>
                <label className="flex cursor-pointer items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) =>
                      setChosen((current) =>
                        e.target.checked
                          ? [...current, result.id]
                          : current.filter((id) => id !== result.id),
                      )
                    }
                  />
                  <span className="truncate">{result.caption || result.filename}</span>
                  <span className="ml-auto shrink-0 text-xs text-[var(--color-muted)]">
                    {result.takenAt ? new Date(result.takenAt).toLocaleDateString() : ""}
                  </span>
                </label>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="text-[var(--color-muted)]">Nothing matches.</li>
          )}
        </ul>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || chosen.length === 0}
            onClick={() =>
              startTransition(async () => {
                await addPhotosToAlbum(albumId, chosen);
                setChosen([]);
                setOpen(false);
              })
            }
          >
            Add {chosen.length > 0 ? chosen.length : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

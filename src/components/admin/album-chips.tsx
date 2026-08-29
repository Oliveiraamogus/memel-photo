"use client";

import { useState } from "react";

export function AlbumChips({
  albums,
  selectedIds,
  onChange,
  onCreate,
  disabled,
}: {
  albums: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<{ id: string; name: string } | null>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    const name = draft.trim();
    if (!name || !onCreate || creating) return;
    setCreating(true);
    const created = await onCreate(name);
    setCreating(false);
    if (!created) return;
    setDraft("");
    if (!selectedIds.includes(created.id)) onChange([...selectedIds, created.id]);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {albums.map((album) => {
          const active = selectedIds.includes(album.id);
          return (
            <button
              key={album.id}
              type="button"
              className={`btn px-2 py-0.5 text-xs ${active ? "btn-primary" : ""}`}
              disabled={disabled}
              onClick={() =>
                onChange(
                  active
                    ? selectedIds.filter((id) => id !== album.id)
                    : [...selectedIds, album.id],
                )
              }
            >
              {album.name}
            </button>
          );
        })}
      </div>
      {onCreate && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <input
            className="field py-1 text-xs"
            placeholder="New album"
            value={draft}
            disabled={disabled || creating}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="btn px-2 py-0.5 text-xs"
            disabled={disabled || creating || !draft.trim()}
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { deleteTag, renameTag } from "../actions";

export function TagRow({
  tag,
}: {
  tag: { id: string; name: string; slug: string; photo_count: number; album_count: number };
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(tag.name);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-sm">
      {editing ? (
        <>
          <input
            className="field max-w-56"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="btn px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await renameTag(tag.id, name);
                setEditing(false);
              })
            }
          >
            Save
          </button>
          <button
            type="button"
            className="btn px-2 py-0.5 text-xs"
            onClick={() => {
              setName(tag.name);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" className="hover:underline" onClick={() => setEditing(true)}>
            {tag.name}
          </button>
          <span className="text-xs text-[var(--color-muted)]">
            {tag.photo_count} photo{tag.photo_count === 1 ? "" : "s"}
            {tag.album_count > 0 &&
              ` · used by ${tag.album_count} album rule${tag.album_count === 1 ? "" : "s"}`}
          </span>
        </>
      )}

      <span className="ml-auto">
        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-muted)]">
              {tag.album_count > 0 ? "This will change album contents." : "Sure?"}
            </span>
            <button
              type="button"
              className="btn btn-danger px-2 py-0.5 text-xs"
              disabled={pending}
              onClick={() => startTransition(() => void deleteTag(tag.id))}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn px-2 py-0.5 text-xs"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="text-xs text-[var(--color-muted)] hover:text-red-400"
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        )}
      </span>
    </li>
  );
}

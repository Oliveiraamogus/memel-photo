"use client";

import { useState, useTransition } from "react";
import {
  createTagAndReturn,
  deletePhoto,
  previewRatingChange,
  previewTagChange,
  setAdminRating,
  setPhotoTags,
} from "@/app/admin/actions";
import type { VisibilityDelta } from "@/lib/publish-guard";
import { StarInput } from "@/components/stars";
import { AlbumChips } from "./album-chips";
import { VisibilityDialog } from "./visibility-dialog";

export type AdminPhoto = {
  id: string;
  filename: string;
  caption: string | null;
  taken_at: string | null;
  admin_rating_half: number | null;
  src: string;
  srcset: string;
  aspectRatio: number;
};

export function AdminPhotoCard({
  photo,
  tags,
  photoTagIds,
  publicReason,
  bestOfThreshold,
  selected,
  onSelect,
}: {
  photo: AdminPhoto;
  tags: { id: string; name: string }[];
  photoTagIds: string[];
  /** Set when the photo is publicly visible, naming the album responsible. */
  publicReason: string | null;
  bestOfThreshold: number;
  selected?: boolean;
  onSelect?: (id: string, shift: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [delta, setDelta] = useState<VisibilityDelta | null>(null);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  const [rating, setRating] = useState(photo.admin_rating_half);
  const [selectedTags, setSelectedTags] = useState(photoTagIds);
  const [catalog, setCatalog] = useState(tags);
  const [editingTags, setEditingTags] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** Every write goes preview first, apply only on confirmation. */
  async function guard(
    preview: () => Promise<VisibilityDelta>,
    apply: () => Promise<void>,
  ) {
    const result = await preview();
    if (result.becomingPublic.length === 0 && result.noLongerPublic.length === 0) {
      startTransition(() => void apply());
      return;
    }
    setDelta(result);
    setConfirm(() => () => {
      startTransition(async () => {
        await apply();
        setDelta(null);
        setConfirm(null);
      });
    });
  }

  return (
    <div className="panel overflow-hidden">
      <div className="relative">
        <img
          src={photo.src}
          srcSet={photo.srcset}
          sizes="300px"
          alt={photo.caption ?? photo.filename}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
        {publicReason && (
          <span className="absolute left-2 top-2 rounded bg-[var(--color-accent)] px-2 py-0.5 text-xs font-medium text-black">
            {publicReason}
          </span>
        )}
        {onSelect && (
          <label
            className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[var(--color-overlay-soft)]"
            onClick={(event) => {
              event.preventDefault();
              onSelect?.(photo.id, event.shiftKey);
            }}
          >
            <input
              type="checkbox"
              checked={selected ?? false}
              readOnly
              aria-label={`Select ${photo.filename}`}
            />
          </label>
        )}
      </div>

      <div className="space-y-3 p-3">
        <p className="truncate text-xs text-[var(--color-muted)]">
          {photo.caption || photo.filename}
        </p>

        <div>
          <StarInput
            value={rating}
            threshold={bestOfThreshold}
            size={15}
            disabled={pending}
            onChange={(half) => {
              setRating(half);
              void guard(
                () => previewRatingChange(photo.id, half),
                () => setAdminRating(photo.id, half),
              );
            }}
          />
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            The marked star is the Best of threshold.
          </p>
        </div>

        {editingTags ? (
          <div>
            <span className="label">Albums</span>
            <AlbumChips
              albums={catalog}
              selectedIds={selectedTags}
              disabled={pending}
              onChange={setSelectedTags}
              onCreate={async (name) => {
                const created = await createTagAndReturn(name);
                setCatalog((current) =>
                  current.some((item) => item.id === created.id)
                    ? current
                    : [...current, created],
                );
                return created;
              }}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn px-2 py-0.5 text-xs"
                disabled={pending}
                onClick={() =>
                  void guard(
                    () => previewTagChange([photo.id], selectedTags),
                    async () => {
                      await setPhotoTags(photo.id, selectedTags);
                      setEditingTags(false);
                    },
                  )
                }
              >
                Save albums
              </button>
              <button
                type="button"
                className="btn px-2 py-0.5 text-xs"
                onClick={() => {
                  setSelectedTags(photoTagIds);
                  setEditingTags(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-[var(--color-muted)] underline hover:text-[var(--color-paper)]"
            onClick={() => setEditingTags(true)}
          >
            {selectedTags.length > 0
              ? catalog
                  .filter((t) => selectedTags.includes(t.id))
                  .map((t) => t.name)
                  .join(", ")
              : "Add to albums"}
          </button>
        )}

        {/* Deleting a photo is not the same as taking it out of an album: this
            removes the rows and the files in both buckets, everywhere. */}
        <div className="border-t border-[var(--color-line)] pt-2 text-[10px]">
          {confirmingDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-[var(--color-muted)]">Delete the file itself?</span>
              <button
                type="button"
                className="btn btn-danger px-2 py-0.5 text-[10px]"
                disabled={pending}
                onClick={() => startTransition(() => void deletePhoto(photo.id))}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn px-2 py-0.5 text-[10px]"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="text-[var(--color-muted)] hover:text-red-400"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete photo
            </button>
          )}
        </div>
      </div>

      {delta && confirm && (
        <VisibilityDialog
          delta={delta}
          pending={pending}
          onConfirm={confirm}
          onCancel={() => {
            setRating(photo.admin_rating_half);
            setSelectedTags(photoTagIds);
            setDelta(null);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

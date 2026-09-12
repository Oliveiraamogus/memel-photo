"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removePhotoFromAlbum, setAlbumCover } from "@/app/admin/actions";
import { PhotoManager, type PhotoManagerEntry } from "@/app/admin/photos/photo-manager";

export function AlbumContents({
  albumId,
  source,
  entries,
  coverPhotoId,
  tags,
  bestOfThreshold,
}: {
  albumId: string;
  source: "manual" | "rule";
  entries: PhotoManagerEntry[];
  coverPhotoId: string | null;
  tags: { id: string; name: string }[];
  bestOfThreshold: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-muted)]">
        {source === "rule"
          ? "Nothing matches this rule yet."
          : "No photos in this album yet."}
      </p>
    );
  }

  return (
    <PhotoManager
      entries={entries}
      tags={tags}
      bestOfThreshold={bestOfThreshold}
      coverPhotoId={coverPhotoId}
      leadingExtra={({ selected, pending: barPending }) => {
        const only = selected.size === 1 ? [...selected][0] : null;
        const busy = pending || barPending;
        return (
          <>
            {only && (
              <button
                type="button"
                className="btn px-2 py-0.5 text-xs"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    await setAlbumCover(albumId, only);
                    router.refresh();
                  })
                }
              >
                Set cover
              </button>
            )}
            <button
              type="button"
              className="btn px-2 py-0.5 text-xs"
              disabled={busy || selected.size === 0}
              onClick={() =>
                startTransition(async () => {
                  for (const id of selected) await removePhotoFromAlbum(albumId, id);
                  router.refresh();
                })
              }
            >
              Remove from album
            </button>
          </>
        );
      }}
    />
  );
}

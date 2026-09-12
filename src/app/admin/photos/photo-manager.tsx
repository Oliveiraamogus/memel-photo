"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { bulkTag, createTagAndReturn, deletePhotos, previewBulkTag } from "@/app/admin/actions";
import type { VisibilityDelta } from "@/lib/publish-guard";
import type { GalleryPhoto } from "@/lib/photos";
import { useShiftSelection } from "@/lib/use-shift-selection";
import { AdminPhotoCard } from "@/components/admin/photo-card";
import { AlbumChips } from "@/components/admin/album-chips";
import { Lightbox } from "@/components/lightbox";
import { VisibilityDialog } from "@/components/admin/visibility-dialog";
import { SelectionBar } from "@/components/selection-bar";

export type PhotoManagerEntry = {
  photo: GalleryPhoto;
  tagIds: string[];
  publicReason: string | null;
};

export function PhotoManager({
  entries,
  tags,
  bestOfThreshold,
  coverPhotoId,
  leadingExtra,
  onSetCover,
}: {
  entries: PhotoManagerEntry[];
  tags: { id: string; name: string }[];
  bestOfThreshold: number;
  coverPhotoId?: string | null;
  leadingExtra?: (ctx: { selected: Set<string>; pending: boolean }) => ReactNode;
  onSetCover?: (photoId: string) => void | Promise<void>;
}) {
  const ids = entries.map((entry) => entry.photo.id);
  const { selected, setSelected, toggle } = useShiftSelection(ids);
  const [catalog, setCatalog] = useState(tags);
  const [pending, startTransition] = useTransition();
  const [delta, setDelta] = useState<VisibilityDelta | null>(null);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const router = useRouter();

  async function applyBulkTag(tagId: string) {
    const photoIds = [...selected];
    const result = await previewBulkTag(photoIds, tagId);
    const apply = () =>
      startTransition(async () => {
        await bulkTag(photoIds, tagId);
        setSelected(new Set());
        setDelta(null);
        setConfirm(null);
      });

    if (result.becomingPublic.length === 0 && result.noLongerPublic.length === 0) {
      apply();
      return;
    }
    setDelta(result);
    setConfirm(() => apply);
  }

  const viewing = openIndex !== null ? entries[openIndex] : null;

  return (
    <>
      <SelectionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onDelete={async () => {
          const photoIds = [...selected];
          await deletePhotos(photoIds);
          setSelected(new Set());
          router.refresh();
        }}
        extra={
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {leadingExtra?.({ selected, pending })}
            <span className="text-xs text-[var(--color-muted)]">Add to album:</span>
            {catalog.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="btn px-2 py-0.5 text-xs"
                disabled={pending}
                onClick={() => void applyBulkTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
            <AlbumChips
              albums={[]}
              selectedIds={[]}
              onChange={() => {}}
              disabled={pending}
              onCreate={async (name) => {
                const created = await createTagAndReturn(name);
                setCatalog((current) =>
                  current.some((item) => item.id === created.id)
                    ? current
                    : [...current, created],
                );
                await applyBulkTag(created.id);
                return created;
              }}
            />
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry, index) => (
          <AdminPhotoCard
            key={entry.photo.id}
            photo={entry.photo}
            tags={catalog}
            photoTagIds={entry.tagIds}
            publicReason={entry.publicReason}
            isCover={entry.photo.id === coverPhotoId}
            bestOfThreshold={bestOfThreshold}
            selected={selected.has(entry.photo.id)}
            onSelect={toggle}
            onOpen={() => setOpenIndex(index)}
            onSetCover={onSetCover}
          />
        ))}
      </div>

      {viewing && (
        <Lightbox
          photo={viewing.photo}
          hasPrevious={openIndex! > 0}
          hasNext={openIndex! < entries.length - 1}
          onPrevious={() => setOpenIndex((current) => (current === null ? null : current - 1))}
          onNext={() => setOpenIndex((current) => (current === null ? null : current + 1))}
          onClose={() => setOpenIndex(null)}
          canVote
          onDeleted={() => {
            setOpenIndex(null);
            router.refresh();
          }}
        />
      )}

      {delta && confirm && (
        <VisibilityDialog
          delta={delta}
          pending={pending}
          onConfirm={confirm}
          onCancel={() => {
            setDelta(null);
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}

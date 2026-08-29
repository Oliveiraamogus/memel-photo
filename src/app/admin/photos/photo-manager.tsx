"use client";

import { useState, useTransition } from "react";
import { bulkTag, createTagAndReturn, previewBulkTag } from "@/app/admin/actions";
import type { VisibilityDelta } from "@/lib/publish-guard";
import { AdminPhotoCard, type AdminPhoto } from "@/components/admin/photo-card";
import { AlbumChips } from "@/components/admin/album-chips";
import { VisibilityDialog } from "@/components/admin/visibility-dialog";

type Entry = { photo: AdminPhoto; tagIds: string[]; publicReason: string | null };

export function PhotoManager({
  entries,
  tags,
  bestOfThreshold,
}: {
  entries: Entry[];
  tags: { id: string; name: string }[];
  bestOfThreshold: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState(tags);
  const [pending, startTransition] = useTransition();
  const [delta, setDelta] = useState<VisibilityDelta | null>(null);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);

  function toggle(id: string, isSelected: boolean) {
    setSelected((current) =>
      isSelected ? [...current, id] : current.filter((x) => x !== id),
    );
  }

  async function applyBulkTag(tagId: string) {
    const result = await previewBulkTag(selected, tagId);
    const apply = () =>
      startTransition(async () => {
        await bulkTag(selected, tagId);
        setSelected([]);
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

  return (
    <>
      {selected.length > 0 && (
        <div className="panel sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span>
            {selected.length} selected
          </span>
          <button type="button" className="btn" onClick={() => setSelected([])}>
            Clear
          </button>
          <span className="ml-auto flex flex-wrap items-center gap-2">
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
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => (
          <AdminPhotoCard
            key={entry.photo.id}
            photo={entry.photo}
            tags={catalog}
            photoTagIds={entry.tagIds}
            publicReason={entry.publicReason}
            bestOfThreshold={bestOfThreshold}
            selected={selected.includes(entry.photo.id)}
            onSelect={toggle}
          />
        ))}
      </div>

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

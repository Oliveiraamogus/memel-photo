"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkTag, createTagAndReturn, deletePhotos, previewBulkTag } from "@/app/admin/actions";
import type { VisibilityDelta } from "@/lib/publish-guard";
import { toggleRange } from "@/lib/selection";
import { AdminPhotoCard, type AdminPhoto } from "@/components/admin/photo-card";
import { AlbumChips } from "@/components/admin/album-chips";
import { VisibilityDialog } from "@/components/admin/visibility-dialog";
import { SelectionBar } from "@/components/selection-bar";

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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [catalog, setCatalog] = useState(tags);
  const [pending, startTransition] = useTransition();
  const [delta, setDelta] = useState<VisibilityDelta | null>(null);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  const anchorRef = useRef<number | null>(null);
  const router = useRouter();

  function toggle(id: string, shift: boolean) {
    const index = entries.findIndex((entry) => entry.photo.id === id);
    if (index < 0) return;
    setSelected((current) =>
      toggleRange(
        current,
        entries.map((entry) => entry.photo.id),
        index,
        shift,
        anchorRef.current,
      ),
    );
    anchorRef.current = index;
  }

  async function applyBulkTag(tagId: string) {
    const ids = [...selected];
    const result = await previewBulkTag(ids, tagId);
    const apply = () =>
      startTransition(async () => {
        await bulkTag(ids, tagId);
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

  return (
    <>
      <SelectionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onDelete={async () => {
          const ids = [...selected];
          await deletePhotos(ids);
          setSelected(new Set());
          router.refresh();
        }}
        extra={
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
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => (
          <AdminPhotoCard
            key={entry.photo.id}
            photo={entry.photo}
            tags={catalog}
            photoTagIds={entry.tagIds}
            publicReason={entry.publicReason}
            bestOfThreshold={bestOfThreshold}
            selected={selected.has(entry.photo.id)}
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

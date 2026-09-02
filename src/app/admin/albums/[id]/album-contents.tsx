"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, useTransition } from "react";
import {
  deletePhotos,
  removePhotoFromAlbum,
  reorderAlbumPhotos,
  setAlbumCover,
} from "@/app/admin/actions";
import { toggleRange } from "@/lib/selection";
import { SelectionBar } from "@/components/selection-bar";
import { SelectionCheckbox } from "@/components/selection-checkbox";

export type ContentPhoto = {
  id: string;
  filename: string;
  caption: string | null;
  src: string;
  srcset: string;
  mode: string | null;
};

function SortableTile({
  photo,
  albumId,
  sortable,
  isCover,
  selected,
  onToggle,
}: {
  photo: ContentPhoto;
  albumId: string;
  sortable: boolean;
  isCover: boolean;
  selected: boolean;
  onToggle: (shift: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id, disabled: !sortable });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`panel relative overflow-hidden ${isDragging ? "opacity-60" : ""} ${
        pending ? "opacity-50" : ""
      }`}
    >
      <img
        src={photo.src}
        srcSet={photo.srcset}
        sizes="240px"
        alt={photo.caption ?? photo.filename}
        loading="lazy"
        className="aspect-square w-full object-cover"
        {...(sortable ? { ...attributes, ...listeners } : {})}
      />
      <label
        className="absolute right-1 top-1 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[var(--color-overlay-soft)]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SelectionCheckbox
          checked={selected}
          label={`Select ${photo.filename}`}
          onToggle={onToggle}
        />
      </label>
      {isCover && (
        <span className="absolute left-1 top-1 rounded bg-[var(--color-overlay-soft)] px-1.5 py-0.5 text-[10px]">
          cover
        </span>
      )}
      <div className="flex justify-between gap-1 p-1.5 text-[10px]">
        <button
          type="button"
          className="text-[var(--color-muted)] hover:text-[var(--color-paper)]"
          onClick={() => startTransition(() => void setAlbumCover(albumId, photo.id))}
        >
          Cover
        </button>
        <button
          type="button"
          className="text-[var(--color-muted)] hover:text-red-400"
          onClick={() => startTransition(() => void removePhotoFromAlbum(albumId, photo.id))}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/**
 * Contents of one album. Manual albums drag into order; rule albums are shown
 * in the order the rule produces, and removing from one writes an exclude
 * override rather than deleting anything.
 */
export function AlbumContents({
  albumId,
  source,
  photos: initial,
  coverPhotoId,
}: {
  albumId: string;
  source: "manual" | "rule";
  photos: ContentPhoto[];
  coverPhotoId: string | null;
}) {
  const [photos, setPhotos] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const anchorRef = useRef<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    const next = arrayMove(photos, oldIndex, newIndex);
    setPhotos(next);
    startTransition(() => void reorderAlbumPhotos(albumId, next.map((p) => p.id)));
  }

  function toggle(index: number, shift: boolean) {
    setSelected((current) =>
      toggleRange(
        current,
        photos.map((photo) => photo.id),
        index,
        shift,
        anchorRef.current,
      ),
    );
    anchorRef.current = index;
  }

  if (photos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-muted)]">
        {source === "rule"
          ? "Nothing matches this rule yet."
          : "No photos in this album yet."}
      </p>
    );
  }

  const grid = (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {photos.map((photo, index) => (
        <SortableTile
          key={photo.id}
          photo={photo}
          albumId={albumId}
          sortable={source === "manual"}
          isCover={photo.id === coverPhotoId}
          selected={selected.has(photo.id)}
          onToggle={(shift) => toggle(index, shift)}
        />
      ))}
    </div>
  );

  return (
    <>
      <SelectionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onDelete={async () => {
          const ids = [...selected];
          const removing = new Set(ids);
          await deletePhotos(ids);
          setPhotos((current) => current.filter((photo) => !removing.has(photo.id)));
          setSelected(new Set());
        }}
      />
      {source !== "manual" ? (
        grid
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            {grid}
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}

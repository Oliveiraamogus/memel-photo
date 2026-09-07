"use client";

import type { MouseEvent, ReactNode } from "react";
import { SelectionCheckbox } from "@/components/selection-checkbox";

/**
 * The one photo+checkbox control used everywhere selection is needed.
 * Click the photo to view it; click the checkbox to select. Shift-click a
 * second checkbox to select the range (handled by the parent via onToggle).
 * Optional onRangeSelect is used on album contents: right-click selects the range.
 */
export function SelectablePhoto({
  filename,
  selected,
  onToggle,
  onOpen,
  onRangeSelect,
  children,
  badge,
  selectable = true,
}: {
  filename: string;
  selected: boolean;
  onToggle: (shift: boolean) => void;
  onOpen: () => void;
  onRangeSelect?: () => void;
  children: ReactNode;
  badge?: ReactNode;
  selectable?: boolean;
}) {
  function handleRange(event: MouseEvent) {
    if (!onRangeSelect) return;
    event.preventDefault();
    event.stopPropagation();
    onRangeSelect();
  }

  return (
    <div className="relative h-full w-full" onContextMenu={handleRange}>
      <button
        type="button"
        onClick={onOpen}
        className="block h-full w-full cursor-zoom-in"
      >
        {children}
      </button>
      {selectable && (
        <label
          className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[var(--color-overlay-soft)]"
          onMouseDown={(event) => {
            // Shift+click would otherwise create a native text/image selection.
            if (event.shiftKey) event.preventDefault();
          }}
          onContextMenu={handleRange}
        >
          <SelectionCheckbox
            checked={selected}
            label={`Select ${filename}`}
            onToggle={onToggle}
          />
        </label>
      )}
      {badge}
    </div>
  );
}

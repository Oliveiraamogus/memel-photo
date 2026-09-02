"use client";

import { useRef } from "react";

/**
 * Checkbox shift-click reads shiftKey from pointerdown — the change event does
 * not carry it, so range select would never see Shift held.
 */
export function SelectionCheckbox({
  checked,
  label,
  className,
  onToggle,
}: {
  checked: boolean;
  label: string;
  className?: string;
  onToggle: (shift: boolean) => void;
}) {
  const shiftRef = useRef(false);

  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      className={className}
      onPointerDown={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      onClick={(event) => event.stopPropagation()}
      onChange={() => onToggle(shiftRef.current)}
    />
  );
}

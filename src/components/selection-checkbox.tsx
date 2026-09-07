"use client";

import { useRef } from "react";

/**
 * Checkbox shift-click reads shiftKey from pointerdown/click — the change
 * event does not carry it, so range select would never see Shift held.
 * Click matters when the surrounding <label> is hit: the input may not get
 * pointerdown, but it does get a click (with modifiers) before change.
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
      onClick={(event) => {
        shiftRef.current = event.shiftKey;
        event.stopPropagation();
      }}
      onChange={() => onToggle(shiftRef.current)}
    />
  );
}

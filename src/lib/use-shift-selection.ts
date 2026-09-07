"use client";

import { useEffect, useRef, useState } from "react";
import { toggleRange } from "@/lib/selection";

/** Shared Shift-click range selection used by every admin photo grid. */
export function useShiftSelection(orderedIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<number | null>(null);
  const orderKey = orderedIds.join(",");

  useEffect(() => {
    anchorRef.current = null;
  }, [orderKey]);

  function toggle(id: string, shift: boolean) {
    const index = orderedIds.indexOf(id);
    if (index < 0) return;
    setSelected((current) =>
      toggleRange(current, orderedIds, index, shift, anchorRef.current),
    );
    anchorRef.current = index;
  }

  return { selected, setSelected, toggle };
}

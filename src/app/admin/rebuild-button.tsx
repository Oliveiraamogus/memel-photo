"use client";

import { useState, useTransition } from "react";
import { rebuildMembership } from "./actions";

/**
 * Materialised membership is only as fresh as the last job that ran, so this is
 * the "be certain" button for after a failed job or a rule you want to trust.
 */
export function RebuildButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const count = await rebuildMembership();
            setMessage(`Rebuilt ${count} album${count === 1 ? "" : "s"}.`);
          })
        }
      >
        {pending ? "Rebuilding..." : "Rebuild membership"}
      </button>
      {message && <span className="text-xs text-[var(--color-muted)]">{message}</span>}
    </span>
  );
}

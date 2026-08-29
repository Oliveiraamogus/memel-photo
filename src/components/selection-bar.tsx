"use client";

import { useState, useTransition, type ReactNode } from "react";

export function SelectionBar({
  count,
  onClear,
  onDelete,
  extra,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => Promise<void>;
  extra?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  return (
    <>
      <div className="panel sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
        <span>{count} selected</span>
        <button type="button" className="btn" onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Delete
        </button>
        {extra}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay-soft)] p-6">
          <div className="panel max-w-md p-5">
            <p className="text-sm">
              Delete {count} photo{count === 1 ? "" : "s"} permanently? This removes the files.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await onDelete();
                    setConfirming(false);
                  })
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

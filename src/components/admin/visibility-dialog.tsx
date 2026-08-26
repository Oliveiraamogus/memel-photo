"use client";

import type { VisibilityDelta } from "@/lib/publish-guard";

/**
 * Shown before a tag, rating or rule change is written, listing exactly which
 * photos the change would publish or unpublish. Nothing is saved until this is
 * confirmed, because with rule albums the action that publishes a photo can be
 * several steps away from the album it affects.
 */
export function VisibilityDialog({
  delta,
  pending,
  onConfirm,
  onCancel,
}: {
  delta: VisibilityDelta;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const gained = delta.becomingPublic;
  const lost = delta.noLongerPublic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="panel max-h-[80vh] w-full max-w-2xl overflow-auto p-6">
        <h2 className="mb-1 text-lg font-medium">Check before saving</h2>
        <p className="mb-5 text-sm text-[var(--color-muted)]">
          {gained.length > 0
            ? `${gained.length} photo${gained.length === 1 ? "" : "s"} become publicly visible.`
            : "No photo becomes publicly visible."}
          {lost.length > 0 &&
            ` ${lost.length} photo${lost.length === 1 ? "" : "s"} stop being visible.`}
        </p>

        {gained.length > 0 && (
          <section className="mb-5">
            <h3 className="label text-[var(--color-accent)]">Becoming public</h3>
            <ul className="space-y-1 text-sm">
              {gained.map((photo) => (
                <li key={photo.id} className="flex justify-between gap-4">
                  <span className="truncate">{photo.caption || photo.filename}</span>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {photo.album_title ? `via ${photo.album_title}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lost.length > 0 && (
          <section className="mb-5">
            <h3 className="label">No longer public</h3>
            <ul className="space-y-1 text-sm">
              {lost.map((photo) => (
                <li key={photo.id} className="truncate">
                  {photo.caption || photo.filename}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${gained.length > 0 ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Saving..." : gained.length > 0 ? "Publish and save" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

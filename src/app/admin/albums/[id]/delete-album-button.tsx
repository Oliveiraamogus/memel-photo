"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAlbum } from "@/app/admin/actions";

export function DeleteAlbumButton({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
        Delete album
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-[var(--color-muted)]">Photos are kept.</span>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteAlbum(albumId);
            router.push("/admin/albums");
          })
        }
      >
        Confirm
      </button>
      <button type="button" className="btn" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}

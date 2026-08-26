"use client";

import { useState, useTransition } from "react";
import { deleteUser, setUserRole } from "../actions";

export function UserRow({
  user,
  isSelf,
}: {
  user: { id: string; email: string; name: string; role: string };
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">
        {user.name}
        <span className="ml-2 text-xs text-[var(--color-muted)]">{user.email}</span>
      </span>

      <select
        className="field max-w-32"
        value={user.role}
        // Removing your own admin rights would lock you out of this page.
        disabled={pending || isSelf}
        onChange={(e) =>
          startTransition(() =>
            void setUserRole(user.id, e.target.value === "admin" ? "admin" : "viewer"),
          )
        }
      >
        <option value="viewer">Viewer</option>
        <option value="admin">Admin</option>
      </select>

      {isSelf ? (
        <span className="w-16 text-right text-xs text-[var(--color-muted)]">you</span>
      ) : confirming ? (
        <span className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="btn btn-danger px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={() => startTransition(() => void deleteUser(user.id))}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn px-2 py-0.5 text-xs"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="w-16 text-right text-xs text-[var(--color-muted)] hover:text-red-400"
          onClick={() => setConfirming(true)}
        >
          Delete
        </button>
      )}
    </li>
  );
}

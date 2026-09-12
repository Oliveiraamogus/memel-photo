"use client";

import { useState, useTransition } from "react";
import { grantAlbumAccess, revokeAlbumAccess } from "@/app/admin/actions";

export type Grant = {
  id: string;
  can_download_originals: boolean;
  group_name: string | null;
  user_email: string | null;
};

export function AccessPanel({
  albumId,
  grants,
  groups,
  users,
}: {
  albumId: string;
  grants: Grant[];
  groups: { id: string; name: string }[];
  users: { id: string; email: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [canDownload, setCanDownload] = useState(false);

  function add() {
    if (!subject) return;
    const [kind, id] = subject.split(":");
    startTransition(async () => {
      await grantAlbumAccess(
        albumId,
        kind === "group" ? { groupId: id } : { userId: id },
        canDownload,
      );
      setSubject("");
      setCanDownload(false);
    });
  }

  return (
    <div className="panel p-5">
      <h2 className="mb-1 text-sm font-medium">Who can see this</h2>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        Grants only matter for restricted albums. Originals follow this album&apos;s own
        grants and are never handed out through Best of.
      </p>

      {grants.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm">
          {grants.map((grant) => (
            <li key={grant.id} className="flex items-center justify-between gap-3">
              <span>
                {grant.group_name ? `Group: ${grant.group_name}` : grant.user_email}
                {grant.can_download_originals && (
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    + originals
                  </span>
                )}
              </span>
              <button
                type="button"
                className="text-xs text-[var(--color-muted)] hover:text-red-400"
                disabled={pending}
                onClick={() => startTransition(() => void revokeAlbumAccess(grant.id))}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="subject">
            Grant to
          </label>
          <select
            id="subject"
            className="field"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">Choose a group or person</option>
            {groups.map((group) => (
              <option key={group.id} value={`group:${group.id}`}>
                Group: {group.name}
              </option>
            ))}
            {users.map((user) => (
              <option key={user.id} value={`user:${user.id}`}>
                {user.email}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={canDownload}
            onChange={(e) => setCanDownload(e.target.checked)}
          />
          Can download originals
        </label>
        <button type="button" className="btn" onClick={add} disabled={pending || !subject}>
          Grant
        </button>
      </div>
    </div>
  );
}

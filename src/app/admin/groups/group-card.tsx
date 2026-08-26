"use client";

import { useState, useTransition } from "react";
import { addGroupMember, deleteGroup, removeGroupMember } from "../actions";

export function GroupCard({
  group,
  users,
}: {
  group: { id: string; name: string; members: { id: string; email: string }[] };
  users: { id: string; email: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [toAdd, setToAdd] = useState("");
  const [confirming, setConfirming] = useState(false);

  const memberIds = new Set(group.members.map((m) => m.id));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{group.name}</h2>
        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            <button
              type="button"
              className="btn btn-danger px-2 py-0.5 text-xs"
              disabled={pending}
              onClick={() => startTransition(() => void deleteGroup(group.id))}
            >
              Delete group
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
            className="text-xs text-[var(--color-muted)] hover:text-red-400"
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        )}
      </div>

      {group.members.length === 0 ? (
        <p className="mb-3 text-xs text-[var(--color-muted)]">No members yet.</p>
      ) : (
        <ul className="mb-3 space-y-1 text-sm">
          {group.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3">
              <span className="truncate">{member.email}</span>
              <button
                type="button"
                className="text-xs text-[var(--color-muted)] hover:text-red-400"
                disabled={pending}
                onClick={() =>
                  startTransition(() => void removeGroupMember(group.id, member.id))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 && (
        <div className="flex gap-2">
          <select
            className="field"
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value)}
            aria-label={`Add someone to ${group.name}`}
          >
            <option value="">Add someone</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={pending || !toAdd}
            onClick={() =>
              startTransition(async () => {
                await addGroupMember(group.id, toAdd);
                setToAdd("");
              })
            }
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { createAlbum } from "@/app/admin/actions";
import { AlbumRuleFields } from "@/components/admin/album-rule-fields";
import { albumRuleFormToInput, emptyAlbumRuleForm } from "@/lib/album-rules";

export function CreateAlbumForm({ tags }: { tags: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "restricted">(
    "restricted",
  );
  const [useRule, setUseRule] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rules, setRules] = useState(emptyAlbumRuleForm);
  const [contributesToBestOf, setContributesToBestOf] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(() =>
      void createAlbum({
        title,
        visibility,
        useRule,
        ruleTagIds: selectedTags,
        contributesToBestOf,
        ...albumRuleFormToInput(rules),
      }),
    );
  }

  return (
    <form onSubmit={submit} className="panel mb-8 space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="new-album-title">
            New album
          </label>
          <input
            id="new-album-title"
            className="field"
            placeholder="Portugal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new-album-visibility">
            Visibility
          </label>
          <select
            id="new-album-visibility"
            className="field"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as "public" | "unlisted" | "restricted")
            }
          >
            <option value="restricted">Restricted</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating..." : "Create"}
        </button>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={useRule}
          onChange={(e) => setUseRule(e.target.checked)}
        />
        <span>
          Matched by a rule (like Best of)
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            Photos enter automatically when they match every condition you set below.
            Leave unchecked to create a collection album tied to a tag with the same name.
          </span>
        </span>
      </label>

      {useRule && (
        <>
          <AlbumRuleFields
            tags={tags}
            selectedTagIds={selectedTags}
            onSelectedTagIdsChange={setSelectedTags}
            rules={rules}
            onChange={(patch) => setRules((current) => ({ ...current, ...patch }))}
          />

          {visibility !== "public" && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={contributesToBestOf}
                onChange={(e) => setContributesToBestOf(e.target.checked)}
              />
              <span>
                Let my best shots from this album appear in Best of
                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  The album stays unbrowsable, but high-rated photos here can still surface
                  in Best of.
                </span>
              </span>
            </label>
          )}
        </>
      )}
    </form>
  );
}

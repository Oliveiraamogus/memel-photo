"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createAlbum } from "@/app/admin/actions";
import { AlbumRuleSection } from "@/components/admin/album-rule-section";
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
    <form onSubmit={submit} className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="new-album-title">
            Title
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
          {pending ? "Creating..." : "Create album"}
        </button>
        <Link href="/admin/albums" className="btn">
          Cancel
        </Link>
      </div>

      <AlbumRuleSection
        tags={tags}
        selectedTagIds={selectedTags}
        onSelectedTagIdsChange={setSelectedTags}
        rules={rules}
        onRulesChange={(patch) => setRules((current) => ({ ...current, ...patch }))}
        enabled={useRule}
        onEnabledChange={setUseRule}
        visibility={visibility}
        contributesToBestOf={contributesToBestOf}
        onContributesToBestOfChange={setContributesToBestOf}
      />
    </form>
  );
}

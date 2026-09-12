"use client";

import { useState, useTransition } from "react";
import { previewAlbumChange, updateAlbum, type AlbumPatch } from "@/app/admin/actions";
import type { VisibilityDelta } from "@/lib/publish-guard";
import { VisibilityDialog } from "@/components/admin/visibility-dialog";
import { AlbumRuleSection } from "@/components/admin/album-rule-section";
import { albumRuleFormFromAlbum, albumRuleFormToInput } from "@/lib/album-rules";
import { formatStars } from "@/lib/rating";

type Album = {
  id: string;
  title: string;
  description: string | null;
  visibility: "public" | "unlisted" | "restricted";
  kind: "collection" | "dated" | "rule" | "best_of";
  source: "manual" | "rule";
  ruleDateFrom: string | null;
  ruleDateTo: string | null;
  ruleMinRatingHalf: number | null;
  ruleMaxRatingHalf: number | null;
  ruleUnratedOnly: boolean;
  ruleIsoMin: number | null;
  ruleIsoMax: number | null;
  ruleApertureMin: number | null;
  ruleApertureMax: number | null;
  ruleExposureMin: number | null;
  ruleExposureMax: number | null;
  ruleFocalLengthMin: number | null;
  ruleFocalLengthMax: number | null;
  ruleWidthMin: number | null;
  ruleWidthMax: number | null;
  ruleHeightMin: number | null;
  ruleHeightMax: number | null;
  ruleBytesMin: number | null;
  ruleBytesMax: number | null;
  ruleCamera: string | null;
  ruleLens: string | null;
  ruleMime: string | null;
  contributesToBestOf: boolean;
};

export function AlbumForm({
  album,
  tags,
  ruleTagIds,
}: {
  album: Album;
  tags: { id: string; name: string }[];
  ruleTagIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [delta, setDelta] = useState<VisibilityDelta | null>(null);
  const [saved, setSaved] = useState(false);

  const isBestOf = album.kind === "best_of";
  const isDated = album.kind === "dated";
  const isCollection = album.kind === "collection";
  const isRule = album.kind === "rule";
  const usesRules = isRule || isBestOf;

  const [form, setForm] = useState({
    title: album.title,
    description: album.description ?? "",
    visibility: album.visibility,
    contributesToBestOf: album.contributesToBestOf,
    rules: albumRuleFormFromAlbum(album),
  });
  const [selectedTags, setSelectedTags] = useState(ruleTagIds);

  const patch: AlbumPatch = isDated || isCollection
    ? {
        title: form.title,
        description: form.description || null,
        visibility: form.visibility,
        contributesToBestOf: form.contributesToBestOf,
      }
    : {
        title: form.title,
        description: form.description || null,
        visibility: form.visibility,
        source: "rule",
        contributesToBestOf: form.contributesToBestOf,
        ...albumRuleFormToInput(form.rules),
      };

  function ruleTagPayload() {
    if (isDated || isCollection || isBestOf) return undefined;
    return selectedTags;
  }

  function save() {
    startTransition(async () => {
      await updateAlbum(album.id, patch, ruleTagPayload());
      setDelta(null);
      setSaved(true);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await previewAlbumChange(album.id, patch, ruleTagPayload());
    if (result.becomingPublic.length === 0 && result.noLongerPublic.length === 0) {
      save();
      return;
    }
    setDelta(result);
  }

  return (
    <form onSubmit={submit} className="panel space-y-5 p-5">
      {form.contributesToBestOf && !isBestOf && (
        <p className="rounded border border-[var(--color-accent)] bg-[var(--color-callout)] px-3 py-2 text-sm">
          This album feeds Best of. Any photo here rated{" "}
          {formatStars(album.ruleMinRatingHalf ?? 16)} or above is shown publicly, even
          though the album itself is not browsable.
        </p>
      )}

      {isBestOf && (
        <p className="rounded border border-[var(--color-line)] bg-[var(--color-callout)] px-3 py-2 text-sm">
          Best of draws from public albums and any private album that opts in. Set the rule
          below — unrated-only is useful for finding photos still needing a score.
        </p>
      )}

      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          className="field"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className="field"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div>
        <label className="label" htmlFor="visibility">
          Visibility
        </label>
        <select
          id="visibility"
          className="field"
          value={form.visibility}
          onChange={(e) =>
            setForm({ ...form, visibility: e.target.value as Album["visibility"] })
          }
        >
          <option value="restricted">Restricted — only people you grant</option>
          <option value="unlisted">Unlisted — anyone with the link, never listed</option>
          <option value="public">Public — listed to everyone</option>
        </select>
      </div>

      {isDated && (
        <p className="text-xs text-[var(--color-muted)]">
          This album is the capture day {album.title}. Photos file themselves here from EXIF;
          the day window is not editable.
        </p>
      )}

      {isCollection && (
        <p className="text-xs text-[var(--color-muted)]">
          Collection albums match a tag with the same name. To use custom rules (ISO, rating,
          dates, etc.), create a{" "}
          <a href="/admin/albums/new" className="underline hover:text-[var(--color-paper)]">
            new rule album
          </a>
          .
        </p>
      )}

      {usesRules && (
        <AlbumRuleSection
          tags={tags}
          selectedTagIds={selectedTags}
          onSelectedTagIdsChange={setSelectedTags}
          rules={form.rules}
          onRulesChange={(patch) =>
            setForm((current) => ({ ...current, rules: { ...current.rules, ...patch } }))
          }
          enabled
          lockEnabled
          visibility={form.visibility}
          contributesToBestOf={form.contributesToBestOf}
          onContributesToBestOfChange={(contributesToBestOf) =>
            setForm({ ...form, contributesToBestOf })
          }
          showContributesToBestOf={!isBestOf}
        />
      )}

      {!isBestOf && !usesRules && form.visibility !== "public" && (
        <div className="border-t border-[var(--color-line)] pt-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.contributesToBestOf}
              onChange={(e) => setForm({ ...form, contributesToBestOf: e.target.checked })}
            />
            <span>
              Let my best shots from this album appear in Best of
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                The album stays unbrowsable, but rating a photo here at or above the Best of
                threshold publishes that photo. Rating stops being a private judgement.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-[var(--color-line)] pt-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-xs text-[var(--color-muted)]">Saved.</span>}
      </div>

      {delta && (
        <VisibilityDialog
          delta={delta}
          pending={pending}
          onConfirm={save}
          onCancel={() => setDelta(null)}
        />
      )}
    </form>
  );
}

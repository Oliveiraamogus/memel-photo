"use client";

import { useState, useTransition } from "react";
import { previewAlbumChange, updateAlbum, type AlbumPatch } from "@/app/admin/actions";
import type { VisibilityDelta } from "@/lib/publish-guard";
import { VisibilityDialog } from "@/components/admin/visibility-dialog";
import { formatStars } from "@/lib/rating";

type Album = {
  id: string;
  title: string;
  description: string | null;
  visibility: "public" | "unlisted" | "restricted";
  kind: "collection" | "dated" | "best_of";
  source: "manual" | "rule";
  ruleDateFrom: string | null;
  ruleDateTo: string | null;
  ruleMinRatingHalf: number | null;
  contributesToBestOf: boolean;
};

const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : "");

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

  const [form, setForm] = useState({
    title: album.title,
    description: album.description ?? "",
    visibility: album.visibility,
    source: album.source,
    ruleDateFrom: toDateInput(album.ruleDateFrom),
    ruleDateTo: toDateInput(album.ruleDateTo),
    ruleMinRatingHalf: album.ruleMinRatingHalf,
    contributesToBestOf: album.contributesToBestOf,
  });
  const [selectedTags, setSelectedTags] = useState(ruleTagIds);

  const patch: AlbumPatch = {
    title: form.title,
    description: form.description || null,
    visibility: form.visibility,
    source: form.source,
    ruleDateFrom: form.ruleDateFrom || null,
    ruleDateTo: form.ruleDateTo || null,
    ruleMinRatingHalf: form.ruleMinRatingHalf,
    contributesToBestOf: form.contributesToBestOf,
  };

  const isBestOf = album.kind === "best_of";

  function save() {
    startTransition(async () => {
      await updateAlbum(album.id, patch, form.source === "rule" ? selectedTags : []);
      setDelta(null);
      setSaved(true);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await previewAlbumChange(
      album.id,
      patch,
      form.source === "rule" ? selectedTags : [],
    );
    if (result.becomingPublic.length === 0 && result.noLongerPublic.length === 0) {
      save();
      return;
    }
    setDelta(result);
  }

  return (
    <form onSubmit={submit} className="panel space-y-5 p-5">
      {form.contributesToBestOf && (
        <p className="rounded border border-[var(--color-accent)] bg-[#1c1a16] px-3 py-2 text-sm">
          This album feeds Best of. Any photo here rated{" "}
          {formatStars(album.ruleMinRatingHalf ?? 16)} or above is shown publicly, even
          though the album itself is not browsable.
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

      <div className="grid gap-4 sm:grid-cols-2">
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

        {!isBestOf && (
          <div>
            <label className="label" htmlFor="source">
              Contents
            </label>
            <select
              id="source"
              className="field"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value as Album["source"] })}
            >
              <option value="manual">Picked by hand, ordered</option>
              <option value="rule">Matched by a rule</option>
            </select>
          </div>
        )}
      </div>

      {form.source === "rule" && (
        <fieldset className="space-y-4 border-t border-[var(--color-line)] pt-4">
          <legend className="label">Rule — all conditions must hold</legend>

          <div>
            <span className="label">Tags the photo must have</span>
            <div className="flex flex-wrap gap-1">
              {tags.length === 0 && (
                <span className="text-xs text-[var(--color-muted)]">No tags yet.</span>
              )}
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`btn px-2 py-0.5 text-xs ${active ? "btn-primary" : ""}`}
                    onClick={() =>
                      setSelectedTags((current) =>
                        active ? current.filter((id) => id !== tag.id) : [...current, tag.id],
                      )
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="from">
                Taken from
              </label>
              <input
                id="from"
                type="date"
                className="field"
                value={form.ruleDateFrom}
                onChange={(e) => setForm({ ...form, ruleDateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="to">
                Taken until
              </label>
              <input
                id="to"
                type="date"
                className="field"
                value={form.ruleDateTo}
                onChange={(e) => setForm({ ...form, ruleDateTo: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="min">
                Minimum rating
              </label>
              <select
                id="min"
                className="field"
                value={form.ruleMinRatingHalf ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ruleMinRatingHalf: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">Any</option>
                {Array.from({ length: 21 }, (_, half) => (
                  <option key={half} value={half}>
                    {formatStars(half)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {!isBestOf && form.visibility !== "public" && (
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

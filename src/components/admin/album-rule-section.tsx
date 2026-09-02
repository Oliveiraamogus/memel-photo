"use client";

import { AlbumRuleFields } from "@/components/admin/album-rule-fields";
import type { AlbumRuleFormState } from "@/lib/album-rules";

type Props = {
  tags: { id: string; name: string }[];
  selectedTagIds: string[];
  onSelectedTagIdsChange: (ids: string[]) => void;
  rules: AlbumRuleFormState;
  onRulesChange: (patch: Partial<AlbumRuleFormState>) => void;
  /** When false, only the enable toggle is shown (create flow). */
  enabled: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Hide the checkbox — rules are always on (rule / Best of albums). */
  lockEnabled?: boolean;
  visibility: "public" | "unlisted" | "restricted";
  contributesToBestOf: boolean;
  onContributesToBestOfChange?: (value: boolean) => void;
  showContributesToBestOf?: boolean;
};

export function AlbumRuleSection({
  tags,
  selectedTagIds,
  onSelectedTagIdsChange,
  rules,
  onRulesChange,
  enabled,
  onEnabledChange,
  lockEnabled = false,
  visibility,
  contributesToBestOf,
  onContributesToBestOfChange,
  showContributesToBestOf = true,
}: Props) {
  return (
    <div className="space-y-4">
      {!lockEnabled && onEnabledChange && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <span>
            Matched by a rule (like Best of)
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              Photos enter automatically when they match every condition below. Leave
              unchecked for a collection album tied to a tag with the same name, or to pick
              photos by hand.
            </span>
          </span>
        </label>
      )}

      {lockEnabled && (
        <p className="text-xs text-[var(--color-muted)]">
          Contents come from the rule below. Removing a photo from the grid writes an exclude
          so the rule stops pulling it back.
        </p>
      )}

      {enabled && (
        <>
          <AlbumRuleFields
            tags={tags}
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={onSelectedTagIdsChange}
            rules={rules}
            onChange={onRulesChange}
          />

          {showContributesToBestOf && visibility !== "public" && onContributesToBestOfChange && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={contributesToBestOf}
                onChange={(e) => onContributesToBestOfChange(e.target.checked)}
              />
              <span>
                Let my best shots from this album appear in Best of
                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  The album stays unbrowsable, but high-rated photos here can still surface in
                  Best of.
                </span>
              </span>
            </label>
          )}
        </>
      )}
    </div>
  );
}

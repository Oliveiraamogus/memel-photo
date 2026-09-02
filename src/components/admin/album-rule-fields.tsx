"use client";

import type { AlbumRuleFormState } from "@/lib/album-rules";
import { formatStars } from "@/lib/rating";

function RuleRange({
  label,
  minId,
  maxId,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder,
  maxPlaceholder,
  step,
}: {
  label: string;
  minId: string;
  maxId: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor={minId}>
          {label} — min
        </label>
        <input
          id={minId}
          type="number"
          className="field"
          step={step}
          placeholder={minPlaceholder}
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor={maxId}>
          {label} — max
        </label>
        <input
          id={maxId}
          type="number"
          className="field"
          step={step}
          placeholder={maxPlaceholder}
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function RuleRatingRange({
  minValue,
  maxValue,
  unratedOnly,
  onMinChange,
  onMaxChange,
  onUnratedOnlyChange,
}: {
  minValue: number | null;
  maxValue: number | null;
  unratedOnly: boolean;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  onUnratedOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={unratedOnly}
          onChange={(e) => onUnratedOnlyChange(e.target.checked)}
        />
        <span>
          Unrated only
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            Photos you have not scored yet. Unrated is not the same as 0 stars.
          </span>
        </span>
      </label>
      {!unratedOnly && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="rule-rating-min">
              Rating — min
            </label>
            <select
              id="rule-rating-min"
              className="field"
              value={minValue ?? ""}
              onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Any</option>
              {Array.from({ length: 21 }, (_, half) => (
                <option key={half} value={half}>
                  {formatStars(half)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rule-rating-max">
              Rating — max
            </label>
            <select
              id="rule-rating-max"
              className="field"
              value={maxValue ?? ""}
              onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : null)}
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
      )}
    </div>
  );
}

export function AlbumRuleFields({
  tags,
  selectedTagIds,
  onSelectedTagIdsChange,
  rules,
  onChange,
}: {
  tags: { id: string; name: string }[];
  selectedTagIds: string[];
  onSelectedTagIdsChange: (ids: string[]) => void;
  rules: AlbumRuleFormState;
  onChange: (patch: Partial<AlbumRuleFormState>) => void;
}) {
  return (
    <fieldset className="space-y-4 border-t border-[var(--color-line)] pt-4">
      <legend className="label">Rule — all conditions must hold</legend>

      <div>
        <span className="label">Tags the photo must have</span>
        <div className="flex flex-wrap gap-1">
          {tags.length === 0 && (
            <span className="text-xs text-[var(--color-muted)]">No tags yet.</span>
          )}
          {tags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={`btn px-2 py-0.5 text-xs ${active ? "btn-primary" : ""}`}
                onClick={() =>
                  onSelectedTagIdsChange(
                    active
                      ? selectedTagIds.filter((id) => id !== tag.id)
                      : [...selectedTagIds, tag.id],
                  )
                }
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rule-from">
            Taken from
          </label>
          <input
            id="rule-from"
            type="date"
            className="field"
            value={rules.ruleDateFrom}
            onChange={(e) => onChange({ ruleDateFrom: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="rule-to">
            Taken until
          </label>
          <input
            id="rule-to"
            type="date"
            className="field"
            value={rules.ruleDateTo}
            onChange={(e) => onChange({ ruleDateTo: e.target.value })}
          />
        </div>
      </div>

      <RuleRatingRange
        minValue={rules.ruleMinRatingHalf}
        maxValue={rules.ruleMaxRatingHalf}
        unratedOnly={rules.ruleUnratedOnly}
        onMinChange={(ruleMinRatingHalf) => onChange({ ruleMinRatingHalf })}
        onMaxChange={(ruleMaxRatingHalf) => onChange({ ruleMaxRatingHalf })}
        onUnratedOnlyChange={(ruleUnratedOnly) => onChange({ ruleUnratedOnly })}
      />

      <RuleRange
        label="ISO"
        minId="rule-iso-min"
        maxId="rule-iso-max"
        minValue={rules.ruleIsoMin}
        maxValue={rules.ruleIsoMax}
        onMinChange={(ruleIsoMin) => onChange({ ruleIsoMin })}
        onMaxChange={(ruleIsoMax) => onChange({ ruleIsoMax })}
        minPlaceholder="100"
        maxPlaceholder="6400"
      />

      <RuleRange
        label="Aperture (f/)"
        minId="rule-aperture-min"
        maxId="rule-aperture-max"
        minValue={rules.ruleApertureMin}
        maxValue={rules.ruleApertureMax}
        onMinChange={(ruleApertureMin) => onChange({ ruleApertureMin })}
        onMaxChange={(ruleApertureMax) => onChange({ ruleApertureMax })}
        step="0.1"
        minPlaceholder="1.4"
        maxPlaceholder="8"
      />

      <RuleRange
        label="Shutter (seconds)"
        minId="rule-exposure-min"
        maxId="rule-exposure-max"
        minValue={rules.ruleExposureMin}
        maxValue={rules.ruleExposureMax}
        onMinChange={(ruleExposureMin) => onChange({ ruleExposureMin })}
        onMaxChange={(ruleExposureMax) => onChange({ ruleExposureMax })}
        step="any"
        minPlaceholder="0.0004"
        maxPlaceholder="30"
      />
      <p className="text-xs text-[var(--color-muted)]">
        Exposure in seconds — e.g. 0.004 for 1/250s, 1 for one second.
      </p>

      <RuleRange
        label="Focal length (mm)"
        minId="rule-focal-min"
        maxId="rule-focal-max"
        minValue={rules.ruleFocalLengthMin}
        maxValue={rules.ruleFocalLengthMax}
        onMinChange={(ruleFocalLengthMin) => onChange({ ruleFocalLengthMin })}
        onMaxChange={(ruleFocalLengthMax) => onChange({ ruleFocalLengthMax })}
        step="1"
        minPlaceholder="24"
        maxPlaceholder="200"
      />

      <RuleRange
        label="Width (px)"
        minId="rule-width-min"
        maxId="rule-width-max"
        minValue={rules.ruleWidthMin}
        maxValue={rules.ruleWidthMax}
        onMinChange={(ruleWidthMin) => onChange({ ruleWidthMin })}
        onMaxChange={(ruleWidthMax) => onChange({ ruleWidthMax })}
      />

      <RuleRange
        label="Height (px)"
        minId="rule-height-min"
        maxId="rule-height-max"
        minValue={rules.ruleHeightMin}
        maxValue={rules.ruleHeightMax}
        onMinChange={(ruleHeightMin) => onChange({ ruleHeightMin })}
        onMaxChange={(ruleHeightMax) => onChange({ ruleHeightMax })}
      />

      <RuleRange
        label="File size (MB)"
        minId="rule-bytes-min"
        maxId="rule-bytes-max"
        minValue={rules.ruleBytesMinMb}
        maxValue={rules.ruleBytesMaxMb}
        onMinChange={(ruleBytesMinMb) => onChange({ ruleBytesMinMb })}
        onMaxChange={(ruleBytesMaxMb) => onChange({ ruleBytesMaxMb })}
        step="0.1"
        minPlaceholder="1"
        maxPlaceholder="40"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rule-camera">
            Camera contains
          </label>
          <input
            id="rule-camera"
            className="field"
            placeholder="Nikon Z6"
            value={rules.ruleCamera}
            onChange={(e) => onChange({ ruleCamera: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="rule-lens">
            Lens contains
          </label>
          <input
            id="rule-lens"
            className="field"
            placeholder="24-70"
            value={rules.ruleLens}
            onChange={(e) => onChange({ ruleLens: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="rule-mime">
          MIME type
        </label>
        <input
          id="rule-mime"
          className="field"
          placeholder="image/jpeg"
          value={rules.ruleMime}
          onChange={(e) => onChange({ ruleMime: e.target.value })}
        />
      </div>
    </fieldset>
  );
}

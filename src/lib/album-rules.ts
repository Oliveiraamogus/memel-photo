import { sql, type SQL } from "drizzle-orm";
import { parseRuleDateBound } from "@/lib/slug";

/** Rule bounds stored on album; all optional and ANDed together. */
export type AlbumRuleFilters = {
  ruleDateFrom?: Date | null;
  ruleDateTo?: Date | null;
  ruleMinRatingHalf?: number | null;
  ruleMaxRatingHalf?: number | null;
  ruleIsoMin?: number | null;
  ruleIsoMax?: number | null;
  ruleApertureMin?: number | null;
  ruleApertureMax?: number | null;
  ruleExposureMin?: number | null;
  ruleExposureMax?: number | null;
  ruleFocalLengthMin?: number | null;
  ruleFocalLengthMax?: number | null;
  ruleWidthMin?: number | null;
  ruleWidthMax?: number | null;
  ruleHeightMin?: number | null;
  ruleHeightMax?: number | null;
  ruleBytesMin?: number | null;
  ruleBytesMax?: number | null;
  ruleCamera?: string | null;
  ruleLens?: string | null;
  ruleMime?: string | null;
};

/** SQL AND clauses matching photo rows against album rule columns (alias p, a). */
export function rulePhotoMatchSql(): SQL {
  return sql`
    and (a.rule_date_from is null or p.taken_at >= a.rule_date_from)
    and (a.rule_date_to is null or p.taken_at <= a.rule_date_to)
    and (
      (a.rule_date_from is null and a.rule_date_to is null)
      or p.taken_at is not null
    )
    and (
      not coalesce(a.rule_unrated_only, false)
      or p.admin_rating_half is null
    )
    and (
      coalesce(a.rule_unrated_only, false)
      or (
        (a.rule_min_rating_half is null or p.admin_rating_half >= a.rule_min_rating_half)
        and (a.rule_max_rating_half is null or p.admin_rating_half <= a.rule_max_rating_half)
        and (
          (a.rule_min_rating_half is null and a.rule_max_rating_half is null)
          or p.admin_rating_half is not null
        )
      )
    )
    and (a.rule_iso_min is null or (p.iso is not null and p.iso >= a.rule_iso_min))
    and (a.rule_iso_max is null or (p.iso is not null and p.iso <= a.rule_iso_max))
    and (a.rule_aperture_min is null or (p.aperture is not null and p.aperture >= a.rule_aperture_min))
    and (a.rule_aperture_max is null or (p.aperture is not null and p.aperture <= a.rule_aperture_max))
    and (a.rule_exposure_min is null or (p.exposure_seconds is not null and p.exposure_seconds >= a.rule_exposure_min))
    and (a.rule_exposure_max is null or (p.exposure_seconds is not null and p.exposure_seconds <= a.rule_exposure_max))
    and (a.rule_focal_length_min is null or (p.focal_length is not null and p.focal_length >= a.rule_focal_length_min))
    and (a.rule_focal_length_max is null or (p.focal_length is not null and p.focal_length <= a.rule_focal_length_max))
    and (a.rule_width_min is null or (p.width is not null and p.width >= a.rule_width_min))
    and (a.rule_width_max is null or (p.width is not null and p.width <= a.rule_width_max))
    and (a.rule_height_min is null or (p.height is not null and p.height >= a.rule_height_min))
    and (a.rule_height_max is null or (p.height is not null and p.height <= a.rule_height_max))
    and (a.rule_bytes_min is null or (p.bytes is not null and p.bytes >= a.rule_bytes_min))
    and (a.rule_bytes_max is null or (p.bytes is not null and p.bytes <= a.rule_bytes_max))
    and (a.rule_camera is null or (p.camera is not null and p.camera ilike ('%' || a.rule_camera || '%')))
    and (a.rule_lens is null or (p.lens is not null and p.lens ilike ('%' || a.rule_lens || '%')))
    and (a.rule_mime is null or p.mime = a.rule_mime)
  `;
}

/**
 * Loose filter for recomputeForPhoto: include rule albums that might change when
 * this photo's metadata changes.
 */
export function rulePhotoMightMatchSql(photoId: string): SQL {
  return sql`
    a.source = 'rule'
    and (
      (a.rule_date_from is null or p.taken_at is null or p.taken_at >= a.rule_date_from)
      and (a.rule_date_to is null or p.taken_at is null or p.taken_at <= a.rule_date_to)
      and (not coalesce(a.rule_unrated_only, false) or p.admin_rating_half is null)
      and (
        coalesce(a.rule_unrated_only, false)
        or (
          (a.rule_min_rating_half is null or p.admin_rating_half is null or p.admin_rating_half >= a.rule_min_rating_half)
          and (a.rule_max_rating_half is null or p.admin_rating_half is null or p.admin_rating_half <= a.rule_max_rating_half)
        )
      )
      and (a.rule_iso_min is null or p.iso is null or p.iso >= a.rule_iso_min)
      and (a.rule_iso_max is null or p.iso is null or p.iso <= a.rule_iso_max)
      and (a.rule_aperture_min is null or p.aperture is null or p.aperture >= a.rule_aperture_min)
      and (a.rule_aperture_max is null or p.aperture is null or p.aperture <= a.rule_aperture_max)
      and (a.rule_exposure_min is null or p.exposure_seconds is null or p.exposure_seconds >= a.rule_exposure_min)
      and (a.rule_exposure_max is null or p.exposure_seconds is null or p.exposure_seconds <= a.rule_exposure_max)
      and (a.rule_focal_length_min is null or p.focal_length is null or p.focal_length >= a.rule_focal_length_min)
      and (a.rule_focal_length_max is null or p.focal_length is null or p.focal_length <= a.rule_focal_length_max)
      and (a.rule_width_min is null or p.width is null or p.width >= a.rule_width_min)
      and (a.rule_width_max is null or p.width is null or p.width <= a.rule_width_max)
      and (a.rule_height_min is null or p.height is null or p.height >= a.rule_height_min)
      and (a.rule_height_max is null or p.height is null or p.height <= a.rule_height_max)
      and (a.rule_bytes_min is null or p.bytes is null or p.bytes >= a.rule_bytes_min)
      and (a.rule_bytes_max is null or p.bytes is null or p.bytes <= a.rule_bytes_max)
      and (a.rule_camera is null or p.camera is null or p.camera ilike ('%' || a.rule_camera || '%'))
      and (a.rule_lens is null or p.lens is null or p.lens ilike ('%' || a.rule_lens || '%'))
      and (a.rule_mime is null or p.mime is null or p.mime = a.rule_mime)
    )
  `;
}

export type AlbumRuleFormState = {
  ruleDateFrom: string;
  ruleDateTo: string;
  ruleMinRatingHalf: number | null;
  ruleMaxRatingHalf: number | null;
  ruleUnratedOnly: boolean;
  ruleIsoMin: string;
  ruleIsoMax: string;
  ruleApertureMin: string;
  ruleApertureMax: string;
  ruleExposureMin: string;
  ruleExposureMax: string;
  ruleFocalLengthMin: string;
  ruleFocalLengthMax: string;
  ruleWidthMin: string;
  ruleWidthMax: string;
  ruleHeightMin: string;
  ruleHeightMax: string;
  ruleBytesMinMb: string;
  ruleBytesMaxMb: string;
  ruleCamera: string;
  ruleLens: string;
  ruleMime: string;
};

export const emptyAlbumRuleForm = (): AlbumRuleFormState => ({
  ruleDateFrom: "",
  ruleDateTo: "",
  ruleMinRatingHalf: null,
  ruleMaxRatingHalf: null,
  ruleUnratedOnly: false,
  ruleIsoMin: "",
  ruleIsoMax: "",
  ruleApertureMin: "",
  ruleApertureMax: "",
  ruleExposureMin: "",
  ruleExposureMax: "",
  ruleFocalLengthMin: "",
  ruleFocalLengthMax: "",
  ruleWidthMin: "",
  ruleWidthMax: "",
  ruleHeightMin: "",
  ruleHeightMax: "",
  ruleBytesMinMb: "",
  ruleBytesMaxMb: "",
  ruleCamera: "",
  ruleLens: "",
  ruleMime: "",
});

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalMb(value: string): number | null {
  const mb = parseOptionalFloat(value);
  if (mb == null) return null;
  return Math.round(mb * 1024 * 1024);
}

export function albumRuleFormToInput(form: AlbumRuleFormState) {
  return {
    ruleDateFrom: form.ruleDateFrom || null,
    ruleDateTo: form.ruleDateTo || null,
    ruleMinRatingHalf: form.ruleMinRatingHalf,
    ruleMaxRatingHalf: form.ruleMaxRatingHalf,
    ruleUnratedOnly: form.ruleUnratedOnly,
    ruleIsoMin: parseOptionalInt(form.ruleIsoMin),
    ruleIsoMax: parseOptionalInt(form.ruleIsoMax),
    ruleApertureMin: parseOptionalFloat(form.ruleApertureMin),
    ruleApertureMax: parseOptionalFloat(form.ruleApertureMax),
    ruleExposureMin: parseOptionalFloat(form.ruleExposureMin),
    ruleExposureMax: parseOptionalFloat(form.ruleExposureMax),
    ruleFocalLengthMin: parseOptionalFloat(form.ruleFocalLengthMin),
    ruleFocalLengthMax: parseOptionalFloat(form.ruleFocalLengthMax),
    ruleWidthMin: parseOptionalInt(form.ruleWidthMin),
    ruleWidthMax: parseOptionalInt(form.ruleWidthMax),
    ruleHeightMin: parseOptionalInt(form.ruleHeightMin),
    ruleHeightMax: parseOptionalInt(form.ruleHeightMax),
    ruleBytesMin: parseOptionalMb(form.ruleBytesMinMb),
    ruleBytesMax: parseOptionalMb(form.ruleBytesMaxMb),
    ruleCamera: form.ruleCamera.trim() || null,
    ruleLens: form.ruleLens.trim() || null,
    ruleMime: form.ruleMime.trim() || null,
  } satisfies AlbumRuleInput;
}

export type AlbumRuleInput = {
  ruleDateFrom?: string | null;
  ruleDateTo?: string | null;
  ruleMinRatingHalf?: number | null;
  ruleMaxRatingHalf?: number | null;
  ruleUnratedOnly?: boolean;
  ruleIsoMin?: number | null;
  ruleIsoMax?: number | null;
  ruleApertureMin?: number | null;
  ruleApertureMax?: number | null;
  ruleExposureMin?: number | null;
  ruleExposureMax?: number | null;
  ruleFocalLengthMin?: number | null;
  ruleFocalLengthMax?: number | null;
  ruleWidthMin?: number | null;
  ruleWidthMax?: number | null;
  ruleHeightMin?: number | null;
  ruleHeightMax?: number | null;
  ruleBytesMin?: number | null;
  ruleBytesMax?: number | null;
  ruleCamera?: string | null;
  ruleLens?: string | null;
  ruleMime?: string | null;
};

export function albumRuleInputToValues(input: Partial<AlbumRuleInput>) {
  const values: Record<string, unknown> = {};
  if (input.ruleDateFrom !== undefined) {
    values.ruleDateFrom = input.ruleDateFrom
      ? parseRuleDateBound(input.ruleDateFrom, "from")
      : null;
  }
  if (input.ruleDateTo !== undefined) {
    values.ruleDateTo = input.ruleDateTo
      ? parseRuleDateBound(input.ruleDateTo, "to")
      : null;
  }
  if (input.ruleMinRatingHalf !== undefined) values.ruleMinRatingHalf = input.ruleMinRatingHalf;
  if (input.ruleMaxRatingHalf !== undefined) values.ruleMaxRatingHalf = input.ruleMaxRatingHalf;
  if (input.ruleUnratedOnly !== undefined) values.ruleUnratedOnly = input.ruleUnratedOnly;
  if (input.ruleIsoMin !== undefined) values.ruleIsoMin = input.ruleIsoMin;
  if (input.ruleIsoMax !== undefined) values.ruleIsoMax = input.ruleIsoMax;
  if (input.ruleApertureMin !== undefined) values.ruleApertureMin = input.ruleApertureMin;
  if (input.ruleApertureMax !== undefined) values.ruleApertureMax = input.ruleApertureMax;
  if (input.ruleExposureMin !== undefined) values.ruleExposureMin = input.ruleExposureMin;
  if (input.ruleExposureMax !== undefined) values.ruleExposureMax = input.ruleExposureMax;
  if (input.ruleFocalLengthMin !== undefined) values.ruleFocalLengthMin = input.ruleFocalLengthMin;
  if (input.ruleFocalLengthMax !== undefined) values.ruleFocalLengthMax = input.ruleFocalLengthMax;
  if (input.ruleWidthMin !== undefined) values.ruleWidthMin = input.ruleWidthMin;
  if (input.ruleWidthMax !== undefined) values.ruleWidthMax = input.ruleWidthMax;
  if (input.ruleHeightMin !== undefined) values.ruleHeightMin = input.ruleHeightMin;
  if (input.ruleHeightMax !== undefined) values.ruleHeightMax = input.ruleHeightMax;
  if (input.ruleBytesMin !== undefined) values.ruleBytesMin = input.ruleBytesMin;
  if (input.ruleBytesMax !== undefined) values.ruleBytesMax = input.ruleBytesMax;
  if (input.ruleCamera !== undefined) values.ruleCamera = input.ruleCamera;
  if (input.ruleLens !== undefined) values.ruleLens = input.ruleLens;
  if (input.ruleMime !== undefined) values.ruleMime = input.ruleMime;
  return values;
}

export function albumRuleFormFromAlbum(album: {
  ruleDateFrom: string | null;
  ruleDateTo: string | null;
  ruleMinRatingHalf: number | null;
  ruleMaxRatingHalf?: number | null;
  ruleUnratedOnly?: boolean;
  ruleIsoMin?: number | null;
  ruleIsoMax?: number | null;
  ruleApertureMin?: number | null;
  ruleApertureMax?: number | null;
  ruleExposureMin?: number | null;
  ruleExposureMax?: number | null;
  ruleFocalLengthMin?: number | null;
  ruleFocalLengthMax?: number | null;
  ruleWidthMin?: number | null;
  ruleWidthMax?: number | null;
  ruleHeightMin?: number | null;
  ruleHeightMax?: number | null;
  ruleBytesMin?: number | null;
  ruleBytesMax?: number | null;
  ruleCamera?: string | null;
  ruleLens?: string | null;
  ruleMime?: string | null;
}): AlbumRuleFormState {
  const toDate = (value: string | null) => (value ? value.slice(0, 10) : "");
  const toStr = (value: number | null | undefined) =>
    value == null ? "" : String(value);
  const toMb = (bytes: number | null | undefined) =>
    bytes == null ? "" : String(Math.round((bytes / (1024 * 1024)) * 100) / 100);

  return {
    ruleDateFrom: toDate(album.ruleDateFrom),
    ruleDateTo: toDate(album.ruleDateTo),
    ruleMinRatingHalf: album.ruleMinRatingHalf,
    ruleMaxRatingHalf: album.ruleMaxRatingHalf ?? null,
    ruleUnratedOnly: album.ruleUnratedOnly ?? false,
    ruleIsoMin: toStr(album.ruleIsoMin),
    ruleIsoMax: toStr(album.ruleIsoMax),
    ruleApertureMin: toStr(album.ruleApertureMin),
    ruleApertureMax: toStr(album.ruleApertureMax),
    ruleExposureMin: toStr(album.ruleExposureMin),
    ruleExposureMax: toStr(album.ruleExposureMax),
    ruleFocalLengthMin: toStr(album.ruleFocalLengthMin),
    ruleFocalLengthMax: toStr(album.ruleFocalLengthMax),
    ruleWidthMin: toStr(album.ruleWidthMin),
    ruleWidthMax: toStr(album.ruleWidthMax),
    ruleHeightMin: toStr(album.ruleHeightMin),
    ruleHeightMax: toStr(album.ruleHeightMax),
    ruleBytesMinMb: toMb(album.ruleBytesMin),
    ruleBytesMaxMb: toMb(album.ruleBytesMax),
    ruleCamera: album.ruleCamera ?? "",
    ruleLens: album.ruleLens ?? "",
    ruleMime: album.ruleMime ?? "",
  };
}

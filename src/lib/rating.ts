/**
 * Ratings run 0-10 in half-star steps, so 9.5 is valid and there are 21
 * possible values. They are stored as integer half-star units (0-20) because a
 * float cannot represent them exactly and `numeric` comes back from the driver
 * as a string. The conversion lives here and nowhere else.
 */

export const MAX_HALF = 20;
export const MAX_STARS = 10;

/** 19 -> 9.5 */
export const toStars = (half: number) => half / 2;

/** 9.5 -> 19 */
export const toHalf = (stars: number) => Math.round(stars * 2);

export function isValidHalf(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_HALF;
}

/** "9.5" for a half value, trimming the pointless ".0" on whole stars. */
export function formatStars(half: number): string {
  const stars = toStars(half);
  return Number.isInteger(stars) ? String(stars) : stars.toFixed(1);
}

/**
 * The viewer average arrives from Postgres `numeric` as a string, and is
 * already in stars rather than half units.
 */
export function parseAverage(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatAverage(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

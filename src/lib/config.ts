const VISIBILITIES = ["public", "unlisted", "restricted"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/**
 * `next build` imports every route module to collect metadata, long before any
 * real environment exists in the image. Missing secrets must not fail the build
 * there, but they absolutely must fail at runtime rather than silently starting
 * a server that cannot reach storage.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function required(name: string, buildFallback = `unset-${name}`): string {
  const value = process.env[name];
  if (value) return value;
  if (isBuildPhase) return buildFallback;
  throw new Error(`Missing required environment variable ${name}`);
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`${name} must be an integer, got "${raw}"`);
  return parsed;
}

function visibility(name: string, fallback: Visibility): Visibility {
  const raw = process.env[name];
  if (!raw) return fallback;
  if (!(VISIBILITIES as readonly string[]).includes(raw)) {
    throw new Error(`${name} must be one of ${VISIBILITIES.join(", ")}, got "${raw}"`);
  }
  return raw as Visibility;
}

export const config = {
  siteTitle: optional("SITE_TITLE", "Photography"),
  appUrl: optional("APP_URL", "http://localhost:3000"),

  databaseUrl: required("DATABASE_URL", "postgres://build:build@127.0.0.1:5432/build"),

  s3: {
    region: optional("S3_REGION", "garage"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    bucketOriginals: optional("S3_BUCKET_ORIGINALS", "photos-originals"),
    bucketDerived: optional("S3_BUCKET_DERIVED", "photos-derived"),
    /** Server-to-server, inside the Docker network. */
    endpointInternal: optional("S3_ENDPOINT_INTERNAL", "http://garage:3900"),
    /**
     * What browsers fetch from. Presigned URLs are signed against this host, so
     * it has to be byte-identical to the host the browser actually requests or
     * the signature check fails.
     */
    endpointPublic: optional("S3_ENDPOINT_PUBLIC", "http://localhost:3900"),
    presignTtlSeconds: integer("PRESIGN_TTL_SECONDS", 6 * 60 * 60),
  },

  /** Minimum admin rating for Best of, in half-star units. 16 = 8.0 stars. */
  bestOfMinRatingHalf: integer("BEST_OF_MIN_RATING_HALF", 16),

  /** Visibility given to dated albums created automatically during upload. */
  defaultDatedAlbumVisibility: visibility("DEFAULT_DATED_ALBUM_VISIBILITY", "restricted"),

  /**
   * Whether GPS coordinates are kept in the database. Derivatives always have
   * them stripped regardless, so this only controls the admin-side record.
   */
  storeGps: optional("STORE_GPS", "false") === "true",
} as const;

/** Widths generated for every photo, smallest first. */
export const DERIVATIVE_WIDTHS = [400, 800, 1600, 2560] as const;

/** The single width also emitted as JPEG, for anything that cannot do AVIF. */
export const JPEG_FALLBACK_WIDTH = 1600;

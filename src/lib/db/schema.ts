import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Better Auth                                                                 */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Added by the admin plugin.
  role: text("role").notNull().default("viewer"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    // Better Auth 1.7+ scopes identities by (issuer, accountId). Email/password
    // accounts get a synthetic issuer like "local:credential".
    issuer: text("issuer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_issuer_account_id_uidx").on(t.issuer, t.accountId),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Groups                                                                      */
/* -------------------------------------------------------------------------- */

export const group = pgTable("group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMember = pgTable(
  "group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_member_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Tags                                                                        */
/* -------------------------------------------------------------------------- */

export const tag = pgTable("tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Photos                                                                      */
/* -------------------------------------------------------------------------- */

export const photoStatus = pgEnum("photo_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export const photo = pgTable(
  "photo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalKey: text("original_key").notNull(),
    filename: text("filename").notNull(),
    width: integer("width"),
    height: integer("height"),
    bytes: bigint("bytes", { mode: "number" }),
    mime: text("mime"),

    takenAt: timestamp("taken_at", { withTimezone: true }),
    camera: text("camera"),
    lens: text("lens"),
    iso: integer("iso"),
    aperture: real("aperture"),
    shutter: text("shutter"),
    exposureSeconds: real("exposure_seconds"),
    focalLength: real("focal_length"),
    // Only populated when STORE_GPS is on; always stripped from derivatives.
    gpsLatitude: real("gps_latitude"),
    gpsLongitude: real("gps_longitude"),

    thumbhash: text("thumbhash"),
    caption: text("caption"),
    status: photoStatus("status").notNull().default("uploading"),

    // Half-star units: 0-20, so 19 is 9.5 stars.
    adminRatingHalf: smallint("admin_rating_half"),
    // The viewer average, already converted to stars. A real mean like 8.33 is
    // not restricted to half steps, which is why this one is decimal.
    ratingAvg: numeric("rating_avg", { precision: 4, scale: 2 }),
    ratingCount: integer("rating_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "photo_admin_rating_half_range",
      sql`${t.adminRatingHalf} is null or (${t.adminRatingHalf} >= 0 and ${t.adminRatingHalf} <= 20)`,
    ),
    // Keyset pagination for /all walks this pair.
    index("photo_taken_at_id_idx").on(t.takenAt.desc(), t.id.desc()),
    index("photo_status_idx").on(t.status),
    index("photo_admin_rating_idx").on(t.adminRatingHalf),
  ],
);

export const photoTag = pgTable(
  "photo_tag",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.photoId, t.tagId] }),
    index("photo_tag_tag_idx").on(t.tagId),
  ],
);

export const photoVariant = pgTable(
  "photo_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    format: text("format").notNull(),
    key: text("key").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("photo_variant_unique").on(t.photoId, t.width, t.format),
    index("photo_variant_photo_idx").on(t.photoId),
  ],
);

export const photoRating = pgTable(
  "photo_rating",
  {
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    valueHalf: smallint("value_half").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.photoId, t.userId] }),
    check(
      "photo_rating_value_half_range",
      sql`${t.valueHalf} >= 0 and ${t.valueHalf} <= 20`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Albums                                                                      */
/* -------------------------------------------------------------------------- */

export const albumVisibility = pgEnum("album_visibility", [
  "public",
  "unlisted",
  "restricted",
]);

export const albumKind = pgEnum("album_kind", ["collection", "dated", "rule", "best_of"]);

export const albumSource = pgEnum("album_source", ["manual", "rule"]);

export const album = pgTable(
  "album",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),

    visibility: albumVisibility("visibility").notNull().default("restricted"),
    /** How the album is presented in the browser. */
    kind: albumKind("kind").notNull().default("collection"),
    /** Where its contents come from. */
    source: albumSource("source").notNull().default("manual"),

    // Rule columns. Only meaningful when source = 'rule'; all optional and
    // ANDed together with the tags in album_rule_tag.
    ruleDateFrom: timestamp("rule_date_from", { withTimezone: true }),
    ruleDateTo: timestamp("rule_date_to", { withTimezone: true }),
    ruleMinRatingHalf: smallint("rule_min_rating_half"),
    ruleMaxRatingHalf: smallint("rule_max_rating_half"),
    ruleUnratedOnly: boolean("rule_unrated_only").notNull().default(false),
    ruleIsoMin: integer("rule_iso_min"),
    ruleIsoMax: integer("rule_iso_max"),
    ruleApertureMin: real("rule_aperture_min"),
    ruleApertureMax: real("rule_aperture_max"),
    ruleExposureMin: real("rule_exposure_min"),
    ruleExposureMax: real("rule_exposure_max"),
    ruleFocalLengthMin: real("rule_focal_length_min"),
    ruleFocalLengthMax: real("rule_focal_length_max"),
    ruleWidthMin: integer("rule_width_min"),
    ruleWidthMax: integer("rule_width_max"),
    ruleHeightMin: integer("rule_height_min"),
    ruleHeightMax: integer("rule_height_max"),
    ruleBytesMin: bigint("rule_bytes_min", { mode: "number" }),
    ruleBytesMax: bigint("rule_bytes_max", { mode: "number" }),
    ruleCamera: text("rule_camera"),
    ruleLens: text("rule_lens"),
    ruleMime: text("rule_mime"),

    /**
     * Lets a restricted album's highest-rated photos surface in Best of while
     * the album itself stays unbrowsable. Off unless you deliberately opt in.
     */
    contributesToBestOf: boolean("contributes_to_best_of").notNull().default(false),

    coverPhotoId: uuid("cover_photo_id").references(() => photo.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // There is exactly one Best of.
    uniqueIndex("album_single_best_of")
      .on(t.kind)
      .where(sql`${t.kind} = 'best_of'`),
    check(
      "album_rule_min_rating_range",
      sql`${t.ruleMinRatingHalf} is null or (${t.ruleMinRatingHalf} >= 0 and ${t.ruleMinRatingHalf} <= 20)`,
    ),
    check(
      "album_rule_max_rating_range",
      sql`${t.ruleMaxRatingHalf} is null or (${t.ruleMaxRatingHalf} >= 0 and ${t.ruleMaxRatingHalf} <= 20)`,
    ),
    index("album_kind_idx").on(t.kind),
    index("album_visibility_idx").on(t.visibility),
    index("album_rule_date_from_idx").on(t.ruleDateFrom),
  ],
);

export const albumRuleTag = pgTable(
  "album_rule_tag",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => album.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.albumId, t.tagId] }),
    index("album_rule_tag_tag_idx").on(t.tagId),
  ],
);

export const albumAccess = pgTable(
  "album_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => album.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => group.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    canDownloadOriginals: boolean("can_download_originals").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A grant is to a group or to a person, never both and never neither.
    check("album_access_exactly_one_subject", sql`num_nonnulls(${t.groupId}, ${t.userId}) = 1`),
    uniqueIndex("album_access_group_unique")
      .on(t.albumId, t.groupId)
      .where(sql`${t.groupId} is not null`),
    uniqueIndex("album_access_user_unique")
      .on(t.albumId, t.userId)
      .where(sql`${t.userId} is not null`),
    index("album_access_album_idx").on(t.albumId),
  ],
);

export const albumPhotoMode = pgEnum("album_photo_mode", ["include", "exclude"]);

/**
 * Manual membership, and the override layer for rule albums: an `include` row
 * pins a photo the rule missed, an `exclude` row suppresses one it caught.
 */
export const albumPhoto = pgTable(
  "album_photo",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => album.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    mode: albumPhotoMode("mode").notNull().default("include"),
    sortIndex: integer("sort_index").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.albumId, t.photoId] }),
    index("album_photo_photo_idx").on(t.photoId),
  ],
);

/**
 * The materialised contents of every album. Every read query and every
 * permission check goes through this table; rules are never evaluated on read.
 */
export const albumPhotoResolved = pgTable(
  "album_photo_resolved",
  {
    albumId: uuid("album_id")
      .notNull()
      .references(() => album.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    sortIndex: integer("sort_index").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.albumId, t.photoId] }),
    // "which albums contain this photo" runs on every permission check
    index("album_photo_resolved_photo_idx").on(t.photoId),
    index("album_photo_resolved_album_sort_idx").on(t.albumId, t.sortIndex),
  ],
);

export type Album = typeof album.$inferSelect;
export type Photo = typeof photo.$inferSelect;
export type Tag = typeof tag.$inferSelect;
export type Group = typeof group.$inferSelect;
export type User = typeof user.$inferSelect;
export type PhotoVariant = typeof photoVariant.$inferSelect;

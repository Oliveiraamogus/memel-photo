"use server";

import { and, eq, inArray, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { type Database, db } from "@/lib/db";
import {
  album,
  albumAccess,
  albumPhoto,
  group,
  groupMember,
  photo,
  photoTag,
  photoVariant,
  tag,
  user,
} from "@/lib/db/schema";
import { recomputeAlbum, recomputeAllAlbums, recomputeForPhoto, grantAdminsOnAlbum } from "@/lib/membership";
import { previewVisibilityDelta, type VisibilityDelta } from "@/lib/publish-guard";
import { enqueueRecomputeMembership } from "@/lib/queue";
import { MAX_HALF } from "@/lib/rating";
import { BUCKET_DERIVED, BUCKET_ORIGINALS, deleteObjects } from "@/lib/s3";
import { requireAdmin } from "@/lib/session";
import { slugify, uniqueSlug, parseRuleDateBound } from "@/lib/slug";

/**
 * Membership is recomputed inline here rather than only through the queue, so
 * an admin who changes a rule sees the result on the next render and a failure
 * surfaces as a failed action instead of a silently stale table. The pg-boss
 * job stays the mechanism for the upload path and for bulk rebuilds.
 */

async function refreshForPhoto(photoId: string) {
  await recomputeForPhoto(photoId, db);
  revalidatePath("/", "layout");
}

async function refreshForAlbum(albumId: string) {
  await recomputeAlbum(albumId, db);
  // Best of can draw from this album, so it has to follow.
  const [bestOf] = await db
    .select({ id: album.id })
    .from(album)
    .where(eq(album.kind, "best_of"))
    .limit(1);
  if (bestOf && bestOf.id !== albumId) await recomputeAlbum(bestOf.id, db);
  revalidatePath("/", "layout");
}

async function takenSlugs() {
  const rows = await db.select({ slug: album.slug }).from(album);
  return new Set(rows.map((r) => r.slug));
}

/* ------------------------------------------------------------------ albums */

export async function createAlbum(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("A title is required");

  const source = formData.get("source") === "rule" ? "rule" : "manual";
  const visibility = String(formData.get("visibility") ?? "restricted") as
    | "public"
    | "unlisted"
    | "restricted";

  const [created] = await db
    .insert(album)
    .values({
      slug: uniqueSlug(slugify(title), await takenSlugs()),
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      visibility,
      kind: "collection",
      source,
      publishedAt: new Date(),
    })
    .returning({ id: album.id });

  await grantAdminsOnAlbum(created.id);
  await refreshForAlbum(created.id);
  redirect(`/admin/albums/${created.id}`);
}

export type AlbumPatch = {
  title?: string;
  description?: string | null;
  visibility?: "public" | "unlisted" | "restricted";
  source?: "manual" | "rule";
  ruleDateFrom?: string | null;
  ruleDateTo?: string | null;
  ruleMinRatingHalf?: number | null;
  contributesToBestOf?: boolean;
  sortOrder?: number;
  coverPhotoId?: string | null;
};

function patchToValues(patch: AlbumPatch) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.visibility !== undefined) values.visibility = patch.visibility;
  if (patch.source !== undefined) values.source = patch.source;
  if (patch.ruleDateFrom !== undefined)
    values.ruleDateFrom = patch.ruleDateFrom
      ? parseRuleDateBound(patch.ruleDateFrom, "from")
      : null;
  if (patch.ruleDateTo !== undefined)
    values.ruleDateTo = patch.ruleDateTo
      ? parseRuleDateBound(patch.ruleDateTo, "to")
      : null;
  if (patch.ruleMinRatingHalf !== undefined)
    values.ruleMinRatingHalf = patch.ruleMinRatingHalf;
  if (patch.contributesToBestOf !== undefined)
    values.contributesToBestOf = patch.contributesToBestOf;
  if (patch.sortOrder !== undefined) values.sortOrder = patch.sortOrder;
  if (patch.coverPhotoId !== undefined) values.coverPhotoId = patch.coverPhotoId;
  return values;
}

async function applyAlbumChange(
  albumId: string,
  patch: AlbumPatch,
  ruleTagIds: string[] | undefined,
  target: Database,
) {
  const [current] = await target
    .select({ kind: album.kind })
    .from(album)
    .where(eq(album.id, albumId))
    .limit(1);

  const values = patchToValues(patch);
  // The date window is the identity of a dated album; editing it (or flipping
  // the album to "picked by hand") would empty it. Visibility and title stay.
  if (current?.kind === "dated") {
    delete values.source;
    delete values.ruleDateFrom;
    delete values.ruleDateTo;
    delete values.ruleMinRatingHalf;
  }

  await target.update(album).set(values).where(eq(album.id, albumId));

  if (ruleTagIds && current?.kind !== "dated" && current?.kind !== "best_of") {
    await target.execute(sql`delete from album_rule_tag where album_id = ${albumId}`);
    if (ruleTagIds.length > 0) {
      await target.execute(sql`
        insert into album_rule_tag (album_id, tag_id)
        select ${albumId}, id from tag where id in (${sql.join(
          ruleTagIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
      `);
    }
  }
}

export async function previewAlbumChange(
  albumId: string,
  patch: AlbumPatch,
  ruleTagIds?: string[],
): Promise<VisibilityDelta> {
  await requireAdmin();
  return previewVisibilityDelta((tx) => applyAlbumChange(albumId, patch, ruleTagIds, tx));
}

export async function updateAlbum(
  albumId: string,
  patch: AlbumPatch,
  ruleTagIds?: string[],
) {
  await requireAdmin();
  await applyAlbumChange(albumId, patch, ruleTagIds, db);
  await refreshForAlbum(albumId);
}

export async function deleteAlbum(albumId: string) {
  await requireAdmin();

  const [target] = await db.select().from(album).where(eq(album.id, albumId)).limit(1);
  if (!target) return;
  if (target.kind === "best_of") throw new Error("Best of cannot be deleted");

  // Only the album goes; its photos remain, unfiled if they were nowhere else.
  await db.delete(album).where(eq(album.id, albumId));
  await enqueueRecomputeMembership();
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------- album grants */

export async function grantAlbumAccess(
  albumId: string,
  subject: { groupId?: string; userId?: string },
  canDownloadOriginals: boolean,
) {
  await requireAdmin();
  if (Boolean(subject.groupId) === Boolean(subject.userId)) {
    throw new Error("Grant access to exactly one of a group or a user");
  }

  await db
    .insert(albumAccess)
    .values({
      albumId,
      groupId: subject.groupId ?? null,
      userId: subject.userId ?? null,
      canDownloadOriginals,
    })
    .onConflictDoNothing();

  revalidatePath("/", "layout");
}

export async function revokeAlbumAccess(accessId: string) {
  await requireAdmin();
  await db.delete(albumAccess).where(eq(albumAccess.id, accessId));
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------- album membership */

export async function addPhotosToAlbum(albumId: string, photoIds: string[]) {
  await requireAdmin();
  if (photoIds.length === 0) return;

  const [current] = await db
    .select({ next: max(albumPhoto.sortIndex) })
    .from(albumPhoto)
    .where(eq(albumPhoto.albumId, albumId));

  let index = (current?.next ?? -1) + 1;

  await db
    .insert(albumPhoto)
    .values(
      photoIds.map((photoId) => ({
        albumId,
        photoId,
        mode: "include" as const,
        sortIndex: index++,
      })),
    )
    .onConflictDoUpdate({
      target: [albumPhoto.albumId, albumPhoto.photoId],
      set: { mode: "include" },
    });

  await refreshForAlbum(albumId);
}

/**
 * Removing is not deleting. An include row is dropped; if a rule keeps pulling
 * the photo back in, an exclude row is written instead.
 */
export async function removePhotoFromAlbum(albumId: string, photoId: string) {
  await requireAdmin();

  const [target] = await db.select().from(album).where(eq(album.id, albumId)).limit(1);
  if (!target) return;

  await db
    .delete(albumPhoto)
    .where(and(eq(albumPhoto.albumId, albumId), eq(albumPhoto.photoId, photoId)));

  if (target.source === "rule") {
    await db
      .insert(albumPhoto)
      .values({ albumId, photoId, mode: "exclude" })
      .onConflictDoUpdate({
        target: [albumPhoto.albumId, albumPhoto.photoId],
        set: { mode: "exclude" },
      });
  }

  await refreshForAlbum(albumId);
}

export async function pinPhotoToAlbum(albumId: string, photoId: string) {
  await requireAdmin();
  await db
    .insert(albumPhoto)
    .values({ albumId, photoId, mode: "include" })
    .onConflictDoUpdate({
      target: [albumPhoto.albumId, albumPhoto.photoId],
      set: { mode: "include" },
    });
  await refreshForAlbum(albumId);
}

export async function reorderAlbumPhotos(albumId: string, orderedPhotoIds: string[]) {
  await requireAdmin();

  await db.transaction(async (tx) => {
    for (const [index, photoId] of orderedPhotoIds.entries()) {
      await tx
        .update(albumPhoto)
        .set({ sortIndex: index })
        .where(and(eq(albumPhoto.albumId, albumId), eq(albumPhoto.photoId, photoId)));
    }
  });

  await refreshForAlbum(albumId);
}

export async function setAlbumCover(albumId: string, photoId: string | null) {
  await requireAdmin();
  await db.update(album).set({ coverPhotoId: photoId }).where(eq(album.id, albumId));
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ photos */

export async function previewRatingChange(photoId: string, valueHalf: number | null) {
  await requireAdmin();
  return previewVisibilityDelta((tx) =>
    tx
      .update(photo)
      .set({ adminRatingHalf: valueHalf })
      .where(eq(photo.id, photoId))
      .then(() => undefined),
  );
}

export async function setAdminRating(photoId: string, valueHalf: number | null) {
  await requireAdmin();
  if (valueHalf !== null && (!Number.isInteger(valueHalf) || valueHalf < 0 || valueHalf > MAX_HALF)) {
    throw new Error("Rating must be 0-20 half stars");
  }

  await db
    .update(photo)
    .set({ adminRatingHalf: valueHalf, updatedAt: new Date() })
    .where(eq(photo.id, photoId));

  // Rules key off the admin rating, so this can change what is published.
  await refreshForPhoto(photoId);
}

export async function setPhotoCaption(photoId: string, caption: string) {
  await requireAdmin();
  await db
    .update(photo)
    .set({ caption: caption.trim() || null, updatedAt: new Date() })
    .where(eq(photo.id, photoId));
  revalidatePath("/", "layout");
}

export async function deletePhoto(photoId: string) {
  await requireAdmin();

  const [target] = await db
    .select({ originalKey: photo.originalKey })
    .from(photo)
    .where(eq(photo.id, photoId))
    .limit(1);
  if (!target) return;

  const variants = await db
    .select({ key: photoVariant.key })
    .from(photoVariant)
    .where(eq(photoVariant.photoId, photoId));

  // Objects first: a row without objects renders a broken image, but objects
  // without a row are invisible garbage that the next delete cannot find.
  await deleteObjects(BUCKET_DERIVED, variants.map((v) => v.key));
  await deleteObjects(BUCKET_ORIGINALS, [target.originalKey]);

  await db.delete(photo).where(eq(photo.id, photoId));
  revalidatePath("/", "layout");
}

/* -------------------------------------------------------------------- tags */

export async function createTag(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A name is required");

  await db
    .insert(tag)
    .values({ name, slug: slugify(name) })
    .onConflictDoNothing();
  revalidatePath("/admin/tags");
}

export async function renameTag(tagId: string, name: string) {
  await requireAdmin();
  await db.update(tag).set({ name: name.trim() }).where(eq(tag.id, tagId));
  revalidatePath("/admin/tags");
}

export async function deleteTag(tagId: string) {
  await requireAdmin();
  await db.delete(tag).where(eq(tag.id, tagId));
  // Rule albums built on this tag now match differently.
  await recomputeAllAlbums(db);
  revalidatePath("/", "layout");
}

async function applyTagChange(photoIds: string[], tagIds: string[], target: Database) {
  await target.execute(sql`
    delete from photo_tag where photo_id in (${sql.join(
      photoIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);
  if (tagIds.length === 0) return;

  const pairs = photoIds.flatMap((photoId) => tagIds.map((tagId) => ({ photoId, tagId })));
  await target.insert(photoTag).values(pairs).onConflictDoNothing();
}

export async function previewTagChange(photoIds: string[], tagIds: string[]) {
  await requireAdmin();
  return previewVisibilityDelta((tx) => applyTagChange(photoIds, tagIds, tx));
}

export async function setPhotoTags(photoId: string, tagIds: string[]) {
  await requireAdmin();
  await applyTagChange([photoId], tagIds, db);
  await refreshForPhoto(photoId);
}

/** Adds a tag to many photos without disturbing the tags they already carry. */
async function applyBulkTag(photoIds: string[], tagId: string, target: Database) {
  await target
    .insert(photoTag)
    .values(photoIds.map((photoId) => ({ photoId, tagId })))
    .onConflictDoNothing();
}

export async function previewBulkTag(photoIds: string[], tagId: string) {
  await requireAdmin();
  return previewVisibilityDelta((tx) => applyBulkTag(photoIds, tagId, tx));
}

export async function bulkTag(photoIds: string[], tagId: string) {
  await requireAdmin();
  if (photoIds.length === 0) return;
  await applyBulkTag(photoIds, tagId, db);
  // Many photos at once, so this one goes through the queue.
  await enqueueRecomputeMembership();
  await recomputeAllAlbums(db);
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------- users and groups */

export async function createUser(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || email;
  const role = formData.get("role") === "admin" ? "admin" : "viewer";

  if (!email || password.length < 8) {
    throw new Error("An email and a password of at least 8 characters are required");
  }

  await auth.api.createUser({ body: { email, password, name, role } });
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  await requireAdmin();
  await db.delete(user).where(eq(user.id, userId));
  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, role: "admin" | "viewer") {
  await requireAdmin();
  await db.update(user).set({ role }).where(eq(user.id, userId));
  revalidatePath("/admin/users");
}

export async function createGroup(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A name is required");
  await db
    .insert(group)
    .values({ name, slug: slugify(name) })
    .onConflictDoNothing();
  revalidatePath("/admin/groups");
}

export async function deleteGroup(groupId: string) {
  await requireAdmin();
  await db.delete(group).where(eq(group.id, groupId));
  revalidatePath("/admin/groups");
}

export async function addGroupMember(groupId: string, userId: string) {
  await requireAdmin();
  await db.insert(groupMember).values({ groupId, userId }).onConflictDoNothing();
  revalidatePath("/admin/groups");
}

export async function removeGroupMember(groupId: string, userId: string) {
  await requireAdmin();
  await db
    .delete(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)));
  revalidatePath("/admin/groups");
}

/* ---------------------------------------------------------------- rebuild */

export async function rebuildMembership() {
  await requireAdmin();
  const count = await recomputeAllAlbums(db);
  revalidatePath("/", "layout");
  return count;
}

/* ------------------------------------------------------------------ lookup */

export async function searchPhotos(query: string, limit = 60) {
  await requireAdmin();
  const term = `%${query.trim()}%`;
  return db
    .select({
      id: photo.id,
      filename: photo.filename,
      caption: photo.caption,
      takenAt: photo.takenAt,
    })
    .from(photo)
    .where(
      query.trim()
        ? sql`(${photo.filename} ilike ${term} or coalesce(${photo.caption}, '') ilike ${term})`
        : sql`true`,
    )
    .orderBy(sql`${photo.takenAt} desc nulls last`)
    .limit(limit);
}

export async function tagsForPhotos(photoIds: string[]) {
  await requireAdmin();
  if (photoIds.length === 0) return [];
  return db
    .select({ photoId: photoTag.photoId, tagId: photoTag.tagId })
    .from(photoTag)
    .where(inArray(photoTag.photoId, photoIds));
}

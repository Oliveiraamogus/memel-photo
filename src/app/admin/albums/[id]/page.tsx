import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { photosInAlbum } from "@/lib/admin-photos";
import { db, execRows } from "@/lib/db";
import { album, albumRuleTag, group, tag, user } from "@/lib/db/schema";
import { withUrls } from "@/lib/photos";
import { AccessPanel, type Grant } from "./access-panel";
import { AlbumContents } from "./album-contents";
import { AlbumForm } from "./album-form";
import { AddPhotos } from "./add-photos";
import { DeleteAlbumButton } from "./delete-album-button";

export const dynamic = "force-dynamic";

export default async function AlbumEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [found] = await db.select().from(album).where(eq(album.id, id)).limit(1);
  if (!found) notFound();

  const [tags, ruleTags, groups, users, contents, grants] = await Promise.all([
    db.select({ id: tag.id, name: tag.name }).from(tag).orderBy(asc(tag.name)),
    db.select({ tagId: albumRuleTag.tagId }).from(albumRuleTag).where(eq(albumRuleTag.albumId, id)),
    db.select({ id: group.id, name: group.name }).from(group).orderBy(asc(group.name)),
    db.select({ id: user.id, email: user.email }).from(user).orderBy(asc(user.email)),
    photosInAlbum(id),
    execRows<Grant>(
      db,
      sql`
        select acc.id, acc.can_download_originals, g.name as group_name, u.email as user_email
        from album_access acc
        left join "group" g on g.id = acc.group_id
        left join "user" u on u.id = acc.user_id
        where acc.album_id = ${id}
      `,
    ),
  ]);

  const withSrc = await withUrls(contents);
  const contentPhotos = withSrc.map((photo, index) => ({
    id: photo.id,
    filename: photo.filename,
    caption: photo.caption,
    src: photo.src,
    srcset: photo.srcset,
    mode: contents[index].mode,
  }));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link href="/admin/albums" className="text-xs text-[var(--color-muted)] hover:text-white">
            ← Albums
          </Link>
          <h1 className="mt-1 text-xl font-medium">{found.title}</h1>
          <p className="text-xs text-[var(--color-muted)]">
            /a/{found.slug} · {found.kind} · {found.source}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/a/${found.slug}`} className="btn">
            View
          </Link>
          {found.kind !== "best_of" && <DeleteAlbumButton albumId={found.id} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AlbumForm
          album={{
            id: found.id,
            title: found.title,
            description: found.description,
            visibility: found.visibility,
            kind: found.kind,
            source: found.source,
            ruleDateFrom: found.ruleDateFrom?.toISOString() ?? null,
            ruleDateTo: found.ruleDateTo?.toISOString() ?? null,
            ruleMinRatingHalf: found.ruleMinRatingHalf,
            contributesToBestOf: found.contributesToBestOf,
          }}
          tags={tags}
          ruleTagIds={ruleTags.map((r) => r.tagId)}
        />

        <AccessPanel albumId={found.id} grants={grants} groups={groups} users={users} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">
              Contents ({contentPhotos.length})
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              {found.source === "manual"
                ? "Drag to reorder. Removing takes the photo out of this album only."
                : "Produced by the rule. Removing writes an exclude so the rule stops pulling it back."}
            </p>
          </div>
          {found.kind !== "best_of" && <AddPhotos albumId={found.id} />}
        </div>

        <AlbumContents
          albumId={found.id}
          source={found.source}
          photos={contentPhotos}
          coverPhotoId={found.coverPhotoId}
        />
      </section>
    </div>
  );
}

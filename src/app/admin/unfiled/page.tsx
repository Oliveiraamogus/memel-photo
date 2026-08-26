import Link from "next/link";
import { asc } from "drizzle-orm";
import { adminPhotoView, unfiledPhotos } from "@/lib/admin-photos";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { tag } from "@/lib/db/schema";
import { PhotoManager } from "../photos/photo-manager";

export const dynamic = "force-dynamic";

/**
 * A photo in no album is unfiled rather than deleted: invisible on the public
 * side, and still here. Uploads land in a dated album automatically, so this
 * should only fill up if you excluded a photo everywhere.
 */
export default async function UnfiledPage() {
  const rows = await unfiledPhotos();
  const entries = await adminPhotoView(rows);
  const tags = await db.select({ id: tag.id, name: tag.name }).from(tag).orderBy(asc(tag.name));

  return (
    <div>
      <h1 className="mb-1 text-xl font-medium">Unfiled</h1>
      <p className="mb-6 max-w-2xl text-sm text-[var(--color-muted)]">
        Photos that belong to no album. They are not published anywhere and nothing links to
        them. Tag them into a rule album, or add them to one from the{" "}
        <Link href="/admin/albums" className="underline">
          album editor
        </Link>
        .
      </p>

      {entries.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-muted)]">
          Nothing unfiled. Every photo is in at least one album.
        </p>
      ) : (
        <PhotoManager
          entries={entries}
          tags={tags}
          bestOfThreshold={config.bestOfMinRatingHalf}
        />
      )}
    </div>
  );
}

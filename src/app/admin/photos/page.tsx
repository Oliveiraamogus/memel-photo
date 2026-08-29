import Link from "next/link";
import { asc } from "drizzle-orm";
import { adminPhotoView, recentPhotos } from "@/lib/admin-photos";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { tag } from "@/lib/db/schema";
import { PhotoManager } from "./photo-manager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

export default async function AdminPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const rows = await recentPhotos(PAGE_SIZE + 1, offset);
  const hasMore = rows.length > PAGE_SIZE;
  const entries = await adminPhotoView(rows.slice(0, PAGE_SIZE));

  const tags = await db.select({ id: tag.id, name: tag.name }).from(tag).orderBy(asc(tag.name));

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Photos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Rating and albums both decide what is published, so each save shows
            what it would publish before writing anything.
          </p>
        </div>
        <Link href="/admin/upload" className="btn btn-primary">
          Upload
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-muted)]">
          No photos yet. <Link href="/admin/upload" className="underline">Upload some</Link>.
        </p>
      ) : (
        <PhotoManager
          entries={entries}
          tags={tags}
          bestOfThreshold={config.bestOfMinRatingHalf}
        />
      )}

      <nav className="mt-8 flex justify-between text-sm">
        {pageNumber > 1 ? (
          <Link href={`/admin/photos?page=${pageNumber - 1}`} className="btn">
            Previous
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={`/admin/photos?page=${pageNumber + 1}`} className="btn">
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}

import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tag } from "@/lib/db/schema";
import { CreateAlbumForm } from "../create-album-form";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage() {
  const tags = await db.select({ id: tag.id, name: tag.name }).from(tag).orderBy(asc(tag.name));

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/albums" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-paper)]">
          ← Albums
        </Link>
        <h1 className="mt-1 text-xl font-medium">New album</h1>
      </div>
      <CreateAlbumForm tags={tags} />
    </div>
  );
}

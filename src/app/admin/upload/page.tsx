import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tag } from "@/lib/db/schema";
import { Uploader } from "./uploader";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const tags = await db
    .select({ id: tag.id, name: tag.name })
    .from(tag)
    .orderBy(asc(tag.name));

  return (
    <div>
      <h1 className="mb-1 text-xl font-medium">Upload</h1>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        Originals go straight from your browser to storage. Nothing is published until a
        photo lands in an album that is public.
      </p>
      <Uploader tags={tags} />
    </div>
  );
}

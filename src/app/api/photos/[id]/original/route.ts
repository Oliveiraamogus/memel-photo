import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { photoAccess } from "@/lib/acl";
import { db } from "@/lib/db";
import { photo } from "@/lib/db/schema";
import { BUCKET_ORIGINALS, presignDownload } from "@/lib/s3";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Originals are the one thing Best of never hands out: this follows the source
 * album's own grants, so a public visitor gets web-sized derivatives only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getViewer();

  const access = await photoAccess(viewer?.id ?? null, id);
  if (!access.canDownloadOriginals) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [row] = await db
    .select({ key: photo.originalKey, filename: photo.filename })
    .from(photo)
    .where(eq(photo.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await presignDownload(BUCKET_ORIGINALS, row.key, {
    filename: row.filename,
    ttlSeconds: 300,
  });

  return NextResponse.redirect(url, 302);
}

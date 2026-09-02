import { ZipArchive } from "archiver";
import { eq, sql } from "drizzle-orm";
import { PassThrough } from "node:stream";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { albumAccess } from "@/lib/acl";
import { db, execRows } from "@/lib/db";
import { album } from "@/lib/db/schema";
import { BUCKET_ORIGINALS, getObjectBuffer } from "@/lib/s3";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

type OriginalRow = {
  id: string;
  original_key: string;
  filename: string;
};

function zipEntryName(filename: string, id: string, used: Set<string>) {
  let name = filename.replace(/[/\\]/g, "_").trim() || "photo";
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  name = `${base}-${id.slice(0, 8)}${ext}`;
  used.add(name);
  return name;
}

function attachmentName(slug: string) {
  const safe = slug.replace(/[^\w.-]+/g, "_").replace(/^_|_$/g, "") || "album";
  return `${safe}.zip`;
}

/**
 * Streams a zip of every original in the album, in album order. Same grant
 * rules as the per-photo download route: public/unlisted alone is not enough.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getViewer();

  const [found] = await db.select().from(album).where(eq(album.slug, slug)).limit(1);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await albumAccess(viewer?.id ?? null, found);
  if (!access.canView) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canDownloadOriginals) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = await execRows<OriginalRow>(
    db,
    sql`
      select p.id, p.original_key, p.filename
      from album_photo_resolved apr
      join photo p on p.id = apr.photo_id
      where apr.album_id = ${found.id}
      order by apr.sort_index asc
    `,
  );

  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos" }, { status: 404 });
  }

  const passthrough = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.on("error", (error: Error) => passthrough.destroy(error));
  archive.pipe(passthrough);

  void (async () => {
    try {
      const used = new Set<string>();
      for (const photo of photos) {
        const buffer = await getObjectBuffer(BUCKET_ORIGINALS, photo.original_key);
        archive.append(buffer, { name: zipEntryName(photo.filename, photo.id, used) });
      }
      await archive.finalize();
    } catch (error) {
      archive.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  const body = Readable.toWeb(passthrough) as ReadableStream<Uint8Array>;

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${attachmentName(found.slug)}"`,
    },
  });
}

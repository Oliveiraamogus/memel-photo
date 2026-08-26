import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { photo, photoTag } from "@/lib/db/schema";
import { enqueueProcessPhoto } from "@/lib/queue";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  photoId: z.string().uuid(),
  key: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  bytes: z.number().int().positive(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
});

/**
 * Records the photo once the browser has finished the PUT. Nothing is derived
 * or filed here: the worker reads the EXIF first, because until the capture
 * date is known there is no way to tell which dated album it belongs in.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { photoId, key, filename, contentType, bytes, tagIds } = parsed.data;

  await db
    .insert(photo)
    .values({
      id: photoId,
      originalKey: key,
      filename,
      mime: contentType,
      bytes,
      status: "processing",
    })
    .onConflictDoNothing();

  if (tagIds?.length) {
    await db
      .insert(photoTag)
      .values(tagIds.map((tagId) => ({ photoId, tagId })))
      .onConflictDoNothing();
  }

  await enqueueProcessPhoto({ photoId });

  return NextResponse.json({ ok: true, photoId });
}

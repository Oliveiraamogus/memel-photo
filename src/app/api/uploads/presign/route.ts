import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/session";
import { originalKey, presignUpload } from "@/lib/s3";

export const dynamic = "force-dynamic";

const ACCEPTED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/x-adobe-dng",
  "image/heic",
]);

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  bytes: z.number().int().positive().max(2_000_000_000),
});

/**
 * Hands the browser a URL it can PUT the original straight to. The bytes never
 * pass through Node, which is the entire reason for using object storage: a
 * 40 MB raw file would otherwise tie up a request handler.
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

  const { filename, contentType } = parsed.data;
  if (!ACCEPTED.has(contentType) && !contentType.startsWith("image/")) {
    return NextResponse.json({ error: `Unsupported type ${contentType}` }, { status: 415 });
  }

  const photoId = randomUUID();
  const extension = filename.includes(".") ? filename.split(".").pop()! : "jpg";
  const key = originalKey(photoId, extension);
  const url = await presignUpload(key, contentType);

  return NextResponse.json({ photoId, key, url, contentType });
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { browsableAlbumsForPhoto, photoAccess } from "@/lib/acl";
import { db } from "@/lib/db";
import { photo, photoRating } from "@/lib/db/schema";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getViewer();

  const access = await photoAccess(viewer?.id ?? null, id);
  if (!access.canView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [row] = await db
    .select({ ratingAvg: photo.ratingAvg, ratingCount: photo.ratingCount })
    .from(photo)
    .where(eq(photo.id, id))
    .limit(1);

  const albums = await browsableAlbumsForPhoto(viewer?.id ?? null, id);

  let myRatingHalf: number | null = null;
  if (viewer) {
    const [vote] = await db
      .select({ valueHalf: photoRating.valueHalf })
      .from(photoRating)
      .where(and(eq(photoRating.photoId, id), eq(photoRating.userId, viewer.id)))
      .limit(1);
    myRatingHalf = vote?.valueHalf ?? null;
  }

  return NextResponse.json({
    albums: albums.map(({ slug, title }) => ({ slug, title })),
    canDownloadOriginals: access.canDownloadOriginals,
    canDelete: Boolean(viewer?.isAdmin),
    ratingAvg: row?.ratingAvg ?? null,
    ratingCount: row?.ratingCount ?? 0,
    myRatingHalf,
  });
}

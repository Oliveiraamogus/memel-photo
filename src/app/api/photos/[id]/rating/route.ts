import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { photoAccess } from "@/lib/acl";
import { db } from "@/lib/db";
import { photo, photoRating } from "@/lib/db/schema";
import { MAX_HALF } from "@/lib/rating";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Validated as a half-star unit rather than trusted from the client.
  valueHalf: z.number().int().min(0).max(MAX_HALF),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in to rate" }, { status: 401 });

  // Rating a photo requires being allowed to see it, so this runs the same
  // check as everything else.
  const access = await photoAccess(viewer.id, id);
  if (!access.canView) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Rating must be 0-20 half stars" }, { status: 400 });
  }

  const { valueHalf } = parsed.data;

  // The vote and the cached aggregate move together, so a grid sorting by score
  // can never read a total that disagrees with the votes behind it.
  const result = await db.transaction(async (tx) => {
    await tx
      .insert(photoRating)
      .values({ photoId: id, userId: viewer.id, valueHalf })
      .onConflictDoUpdate({
        target: [photoRating.photoId, photoRating.userId],
        set: { valueHalf, updatedAt: new Date() },
      });

    const [updated] = await tx
      .update(photo)
      .set({
        ratingAvg: sql`(
          select round(avg(pr.value_half) / 2.0, 2)
          from photo_rating pr where pr.photo_id = ${id}
        )`,
        ratingCount: sql`(
          select count(*)::int from photo_rating pr where pr.photo_id = ${id}
        )`,
        updatedAt: new Date(),
      })
      .where(eq(photo.id, id))
      .returning({ ratingAvg: photo.ratingAvg, ratingCount: photo.ratingCount });

    return updated;
  });

  return NextResponse.json({
    ratingAvg: result?.ratingAvg ?? null,
    ratingCount: result?.ratingCount ?? 0,
  });
}

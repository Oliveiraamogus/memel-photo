import { NextResponse } from "next/server";
import { visibleAlbumIds } from "@/lib/acl";
import { type StreamSort, streamPhotos, withUrls } from "@/lib/photos";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

/** Feeds the infinite scroll on /all. Re-runs the ACL on every page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const viewer = await getViewer();

  const sortParam = url.searchParams.get("sort");
  const sort: StreamSort =
    sortParam === "date-asc" || sortParam === "rating" ? sortParam : "date-desc";

  const cursorId = url.searchParams.get("cursorId");
  const cursorTakenAt = url.searchParams.get("cursorTakenAt");
  const cursorRating = url.searchParams.get("cursorRating");
  const tagSlug = url.searchParams.get("tag");

  const visibleIds = await visibleAlbumIds(viewer?.id ?? null);

  const rows = await streamPhotos(visibleIds, {
    sort,
    limit: PAGE_SIZE + 1,
    tagSlug,
    cursor: cursorId
      ? {
          id: cursorId,
          takenAt: cursorTakenAt,
          ratingHalf: cursorRating ? Number.parseInt(cursorRating, 10) : null,
        }
      : null,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const photos = await withUrls(page);
  const last = page.at(-1);

  return NextResponse.json({
    photos,
    hasMore,
    cursor: last
      ? { id: last.id, takenAt: last.taken_at, ratingHalf: last.admin_rating_half }
      : null,
  });
}

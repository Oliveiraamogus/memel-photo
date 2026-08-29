import "dotenv/config";
import { db, pool } from "@/lib/db";
import { recomputeAllAlbums, restoreDatedAlbumWindows, grantAdminsOnAllAlbums, backfillCollectionAlbums } from "@/lib/membership";

/**
 * Recomputes every album from scratch. The materialised membership table is
 * only as fresh as the last job that ran, so this is the escape hatch for when
 * a job failed or you changed a rule and want certainty rather than trust.
 */
try {
  await restoreDatedAlbumWindows(db);
  await backfillCollectionAlbums(db);
  await grantAdminsOnAllAlbums(db);
  const count = await recomputeAllAlbums(db);
  console.log(`Rebuilt membership for ${count} album(s).`);
} catch (error) {
  console.error("Rebuild failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

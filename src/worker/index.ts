import "dotenv/config";
import type { Job } from "pg-boss";
import { db, pool } from "@/lib/db";
import { recomputeAlbum, recomputeAllAlbums, recomputeForPhoto } from "@/lib/membership";
import {
  QUEUE_PROCESS_PHOTO,
  QUEUE_RECOMPUTE_MEMBERSHIP,
  type ProcessPhotoJob,
  type RecomputeMembershipJob,
  getBoss,
} from "@/lib/queue";
import { markPhotoFailed, processPhoto } from "./process-photo";

const boss = await getBoss();

await boss.work<ProcessPhotoJob>(
  QUEUE_PROCESS_PHOTO,
  { batchSize: 1 },
  async ([job]: Job<ProcessPhotoJob>[]) => {
    const { photoId } = job.data;
    try {
      await processPhoto(photoId);
    } catch (error) {
      console.error(`[worker] failed to process ${photoId}:`, error);
      await markPhotoFailed(photoId);
      throw error;
    }
  },
);

await boss.work<RecomputeMembershipJob>(
  QUEUE_RECOMPUTE_MEMBERSHIP,
  { batchSize: 1 },
  async ([job]: Job<RecomputeMembershipJob>[]) => {
    const { albumId, photoId } = job.data ?? {};
    if (albumId) {
      await recomputeAlbum(albumId, db);
    } else if (photoId) {
      await recomputeForPhoto(photoId, db);
    } else {
      const count = await recomputeAllAlbums(db);
      console.log(`[worker] rebuilt membership for ${count} album(s)`);
    }
  },
);

console.log("[worker] ready");

async function shutdown(signal: string) {
  console.log(`[worker] ${signal}, stopping`);
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

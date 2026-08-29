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

// How many photos this process encodes at once. sharp is CPU-heavy; 3 is a
// good default on a laptop or small CT. Override with PHOTO_WORKER_CONCURRENCY.
const photoConcurrency = Math.max(
  1,
  Number.parseInt(process.env.PHOTO_WORKER_CONCURRENCY ?? "3", 10) || 3,
);

await boss.work<ProcessPhotoJob>(
  QUEUE_PROCESS_PHOTO,
  { batchSize: 1, localConcurrency: photoConcurrency },
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

console.log(`[worker] ready (photo concurrency ${photoConcurrency})`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal}, stopping`);
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

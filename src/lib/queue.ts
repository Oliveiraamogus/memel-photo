import { PgBoss } from "pg-boss";
import { config } from "@/lib/config";

export const QUEUE_PROCESS_PHOTO = "photo.process";
export const QUEUE_RECOMPUTE_MEMBERSHIP = "membership.recompute";

export type ProcessPhotoJob = { photoId: string };

/**
 * `albumId` recomputes one album, `photoId` recomputes every album that photo
 * could belong to, and neither rebuilds the lot.
 */
export type RecomputeMembershipJob = {
  albumId?: string;
  photoId?: string;
};

const globalForBoss = globalThis as unknown as { __boss?: Promise<PgBoss> };

async function start(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: "pgboss",
  });
  boss.on("error", (error: unknown) => console.error("[pg-boss]", error));
  await boss.start();
  await boss.createQueue(QUEUE_PROCESS_PHOTO);
  await boss.createQueue(QUEUE_RECOMPUTE_MEMBERSHIP);
  return boss;
}

export function getBoss(): Promise<PgBoss> {
  globalForBoss.__boss ??= start();
  return globalForBoss.__boss;
}

export async function enqueueProcessPhoto(data: ProcessPhotoJob) {
  const boss = await getBoss();
  await boss.send(QUEUE_PROCESS_PHOTO, data, {
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
  });
}

export async function enqueueRecomputeMembership(data: RecomputeMembershipJob = {}) {
  const boss = await getBoss();
  await boss.send(QUEUE_RECOMPUTE_MEMBERSHIP, data, {
    // Recomputes are idempotent, so retrying is always safe, and retries are
    // the only thing standing between a failed job and stale permissions.
    retryLimit: 5,
    retryDelay: 5,
    retryBackoff: true,
    // Collapse the storm a bulk tag edit would otherwise cause.
    singletonKey: data.albumId ?? data.photoId ?? "all",
    singletonSeconds: 2,
  });
}

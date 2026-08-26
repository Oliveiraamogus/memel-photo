import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { config } from "@/lib/config";
import * as schema from "./schema";

/**
 * Anything that can run our queries: the pool-backed client, a transaction, or
 * the in-memory Postgres the checks run against.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * `execute` on the generic database type cannot know the driver's result shape,
 * so it degrades to `unknown`. Both drivers we use return `{ rows }`, and this
 * is the single place that knowledge lives.
 */
export async function execRows<T>(database: Database, query: SQL): Promise<T[]> {
  const result = (await database.execute(query)) as unknown as { rows?: T[] };
  return result.rows ?? [];
}

// Next dev reloads modules on every edit; without caching we would leak a pool
// per reload until Postgres refuses new connections.
const globalForDb = globalThis as unknown as { __pool?: Pool };

const pool =
  globalForDb.__pool ??
  new Pool({
    connectionString: config.databaseUrl,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;

export const db = drizzle(pool, { schema });
export { pool, schema };

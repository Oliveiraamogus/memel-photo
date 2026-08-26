/**
 * Applies the generated migration to a throwaway in-memory Postgres (PGlite) to
 * prove the SQL is valid and the constraints actually bite, without needing a
 * server. Run with `npx tsx src/scripts/check-migration.ts`.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const sqlFile = readFileSync("drizzle/0000_init.sql", "utf8");
const statements = sqlFile
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const pg = new PGlite();

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function rejects(label: string, sql: string) {
  try {
    await pg.exec(sql);
    check(label, false, "statement was accepted but should have been rejected");
  } catch {
    check(label, true);
  }
}

console.log(`Applying ${statements.length} statements...`);
for (const statement of statements) {
  await pg.exec(statement);
}
console.log("Migration applied.\n");

console.log("Tables:");
const tables = await pg.query<{ table_name: string }>(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
);
console.log(`  ${tables.rows.map((r) => r.table_name).join(", ")}\n`);

console.log("Constraints:");

await pg.exec(`
  insert into photo (id, original_key, filename, status)
  values ('11111111-1111-1111-1111-111111111111', 'originals/a.jpg', 'a.jpg', 'ready');
`);

await rejects(
  "photo.admin_rating_half rejects 21 (above 10 stars)",
  `update photo set admin_rating_half = 21 where filename = 'a.jpg'`,
);
await rejects(
  "photo.admin_rating_half rejects -1",
  `update photo set admin_rating_half = -1 where filename = 'a.jpg'`,
);

await pg.exec(`update photo set admin_rating_half = 19 where filename = 'a.jpg'`);
const nineFive = await pg.query<{ admin_rating_half: number }>(
  `select admin_rating_half from photo where filename = 'a.jpg'`,
);
check(
  "photo.admin_rating_half stores 19, i.e. 9.5 stars",
  nineFive.rows[0]?.admin_rating_half === 19,
);

await pg.exec(`
  insert into album (id, slug, title, visibility, kind, source)
  values ('22222222-2222-2222-2222-222222222222', 'best-of', 'Best of', 'public', 'best_of', 'rule');
`);
await rejects(
  "only one best_of album allowed",
  `insert into album (slug, title, kind, source)
   values ('best-of-2', 'Best of 2', 'best_of', 'rule')`,
);

await pg.exec(`
  insert into album (id, slug, title, kind, source)
  values ('33333333-3333-3333-3333-333333333333', 'holiday', 'Holiday', 'collection', 'manual');
`);
await rejects(
  "album_access needs a subject",
  `insert into album_access (album_id) values ('33333333-3333-3333-3333-333333333333')`,
);
await pg.exec(`insert into "group" (id, name, slug) values ('44444444-4444-4444-4444-444444444444', 'Family', 'family')`);
await rejects(
  "album_access rejects both group and user at once",
  `insert into album_access (album_id, group_id, user_id)
   values ('33333333-3333-3333-3333-333333333333',
           '44444444-4444-4444-4444-444444444444', 'some-user')`,
);
await pg.exec(`
  insert into album_access (album_id, group_id, can_download_originals)
  values ('33333333-3333-3333-3333-333333333333',
          '44444444-4444-4444-4444-444444444444', true);
`);
check("album_access accepts a single group grant", true);

await rejects(
  "album_access rejects a duplicate grant to the same group",
  `insert into album_access (album_id, group_id)
   values ('33333333-3333-3333-3333-333333333333',
           '44444444-4444-4444-4444-444444444444')`,
);

const indexes = await pg.query<{ indexname: string }>(
  `select indexname from pg_indexes where tablename = 'photo'`,
);
check(
  "keyset index on (taken_at desc, id desc) exists",
  indexes.rows.some((r) => r.indexname === "photo_taken_at_id_idx"),
);

await pg.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

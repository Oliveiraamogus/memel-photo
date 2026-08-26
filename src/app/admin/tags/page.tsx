import { asc, sql } from "drizzle-orm";
import { db, execRows } from "@/lib/db";
import { createTag } from "../actions";
import { TagRow } from "./tag-row";

export const dynamic = "force-dynamic";

export default async function AdminTagsPage() {
  const tags = await execRows<{
    id: string;
    name: string;
    slug: string;
    photo_count: number;
    album_count: number;
  }>(
    db,
    sql`
      select t.id, t.name, t.slug,
        (select count(*)::int from photo_tag pt where pt.tag_id = t.id) as photo_count,
        (select count(*)::int from album_rule_tag art where art.tag_id = t.id) as album_count
      from tag t
      order by t.name
    `,
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-medium">Tags</h1>
      <p className="mb-6 max-w-2xl text-sm text-[var(--color-muted)]">
        Tags are what rule albums match on. Deleting one changes what those albums contain,
        which can make photos public or private.
      </p>

      <form action={createTag} className="panel mb-8 flex items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="name">
            New tag
          </label>
          <input id="name" name="name" className="field" placeholder="Portrait" required />
        </div>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No tags yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </div>
  );
}

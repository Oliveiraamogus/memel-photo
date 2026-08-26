import { asc, sql } from "drizzle-orm";
import { db, execRows } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { createGroup } from "../actions";
import { GroupCard } from "./group-card";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const [groups, users] = await Promise.all([
    execRows<{ id: string; name: string; members: { id: string; email: string }[] | null }>(
      db,
      sql`
        select g.id, g.name,
          (select json_agg(json_build_object('id', u.id, 'email', u.email) order by u.email)
             from group_member gm
             join "user" u on u.id = gm.user_id
            where gm.group_id = g.id) as members
        from "group" g
        order by g.name
      `,
    ),
    db.select({ id: user.id, email: user.email }).from(user).orderBy(asc(user.email)),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-medium">Groups</h1>
      <p className="mb-6 max-w-2xl text-sm text-[var(--color-muted)]">
        Groups are how a restricted album gets shared with several people at once — family,
        friends, clients — without granting each person separately.
      </p>

      <form action={createGroup} className="panel mb-8 flex items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="name">
            New group
          </label>
          <input id="name" name="name" className="field" placeholder="Family" required />
        </div>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No groups yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={{ id: group.id, name: group.name, members: group.members ?? [] }}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  );
}

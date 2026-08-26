import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getViewer } from "@/lib/session";
import { createUser } from "../actions";
import { UserRow } from "./user-row";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const viewer = await getViewer();
  const users = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.email));

  return (
    <div>
      <h1 className="mb-1 text-xl font-medium">Users</h1>
      <p className="mb-6 max-w-2xl text-sm text-[var(--color-muted)]">
        There is no public signup. Every account is created here, and what someone can see
        is decided by the albums granted to them or to a group they are in.
      </p>

      <form action={createUser} className="panel mb-8 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="field" required />
        </div>
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" className="field" />
        </div>
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select id="role" name="role" className="field" defaultValue="viewer">
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>

      <ul className="divide-y divide-[var(--color-line)]">
        {users.map((row) => (
          <UserRow key={row.id} user={row} isSelf={row.id === viewer?.id} />
        ))}
      </ul>
    </div>
  );
}

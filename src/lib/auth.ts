import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";

// Two roles: you, and everybody you hand an account to. "viewer" carries no
// permissions of its own — what a viewer can see is decided by album grants,
// not by their role.
const ac = createAccessControl(defaultStatements);
const roles = {
  admin: ac.newRole(adminAc.statements),
  viewer: ac.newRole({}),
};

export const auth = betterAuth({
  appName: "memel-photo",
  secret: process.env.BETTER_AUTH_SECRET ?? "unset-BETTER_AUTH_SECRET",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    // There is no public signup. Accounts are created from /admin/users.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    adminPlugin({
      ac,
      roles,
      defaultRole: "viewer",
      adminRoles: ["admin"],
    }),
    // Must stay last: it is what lets server actions set the session cookie.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

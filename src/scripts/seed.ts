import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { db, pool } from "@/lib/db";
import { account, album, session, user } from "@/lib/db/schema";

/**
 * Creates the first admin account and the Best of album. Safe to re-run: both
 * steps check for what they are about to create.
 */

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin creation.");
    return;
  }

  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing.length > 0) {
    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, existing[0].id))
      .limit(1);

    // A failed createUser can leave a user row with no password account. Wipe
    // that orphan and recreate, otherwise login will never work.
    if (accounts.length === 0) {
      console.log(
        `Admin ${email} exists without a password account; recreating…`,
      );
      await db.delete(session).where(eq(session.userId, existing[0].id));
      await db.delete(user).where(eq(user.id, existing[0].id));
    } else if (existing[0].role !== "admin") {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, existing[0].id));
      console.log(`Promoted ${email} to admin.`);
      return;
    } else {
      console.log(`Admin ${email} already exists.`);
      return;
    }
  }

  // Go through Better Auth rather than inserting directly, so the password is
  // hashed exactly the way the sign-in path expects.
  await auth.api.createUser({
    body: { email, password, name, role: "admin" },
  });

  console.log(`Created admin ${email}.`);
}

async function seedBestOf() {
  const existing = await db.select().from(album).where(eq(album.kind, "best_of")).limit(1);
  if (existing.length > 0) {
    console.log("Best of album already exists.");
    return;
  }

  await db.insert(album).values({
    slug: "best-of",
    title: "Best of",
    description: "The work I would show first.",
    visibility: "public",
    kind: "best_of",
    source: "rule",
    ruleMinRatingHalf: config.bestOfMinRatingHalf,
    sortOrder: -1000,
    publishedAt: new Date(),
  });

  console.log(
    `Created Best of album (minimum rating ${config.bestOfMinRatingHalf / 2} stars).`,
  );
}

try {
  await seedAdmin();
  await seedBestOf();
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

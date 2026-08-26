import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type Viewer = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

/**
 * Cached per request, so a page that checks the viewer in the layout, the page
 * and three components still only hits the session store once.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.user) return null;
  return {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    isAdmin: (result.user as { role?: string }).role === "admin",
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("UNAUTHORIZED");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) throw new Error("FORBIDDEN");
  return viewer;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  // Only ever bounce back to a path on this site, never to an absolute URL a
  // caller supplied.
  const redirectTo = next?.startsWith("/") ? next : "/";

  if (viewer) redirect(redirectTo);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <LoginForm redirectTo={redirectTo} />
      <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-paper)]">
        Back to the gallery
      </Link>
    </main>
  );
}

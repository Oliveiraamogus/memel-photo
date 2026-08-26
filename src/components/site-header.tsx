import Link from "next/link";
import { getViewer } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="border-b border-[var(--color-line)]">
      <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-6 py-4">
        <Link href="/" className="text-sm font-medium tracking-wide">
          {process.env.SITE_TITLE || "Photography"}
        </Link>
        <nav className="flex gap-4 text-sm text-[var(--color-muted)]">
          <Link href="/" className="hover:text-white">
            Albums
          </Link>
          <Link href="/all" className="hover:text-white">
            All photos
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-[var(--color-muted)]">
          {viewer ? (
            <>
              {viewer.isAdmin && (
                <Link href="/admin" className="hover:text-white">
                  Admin
                </Link>
              )}
              <span>{viewer.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="btn">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

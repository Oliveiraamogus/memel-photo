import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/upload", label: "Upload" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/albums", label: "Albums" },
  { href: "/admin/albums/new", label: "New album" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/unfiled", label: "Unfiled" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/groups", label: "Groups" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isAdmin) redirect("/");

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-line)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/" className="text-sm font-medium">
            {process.env.SITE_TITLE || "Photography"}
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-muted)]">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[var(--color-paper)]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-[var(--color-muted)]">
            <ThemeToggle />
            <span>{viewer.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

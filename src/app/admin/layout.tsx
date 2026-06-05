import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { SidebarAdmin } from "@/components/dashboard/sidebaradmin";
import { SignOutButton } from "@/components/dashboard/sign-out";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin().catch(() => null);
  if (!session?.user?.tenantId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-paper">
      <SidebarAdmin />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div>
              <p className="text-sm font-semibold text-ink">Admin · {session.user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

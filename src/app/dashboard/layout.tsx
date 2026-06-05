import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/authz";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SignOutButton } from "@/components/dashboard/sign-out";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { getBillingCatalog } from "@/lib/billing";
import { BillingProvider } from "@/components/providers/billing-provider";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user?.tenantId) redirect("/login");

  const catalog = await getBillingCatalog(session.user.tenantId);

  return (
    <BillingProvider initialData={catalog}>
      <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div>
              <p className="text-sm font-semibold text-ink">{session.user.name}</p>
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
    </BillingProvider>
  );
}

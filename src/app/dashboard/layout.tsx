import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/authz";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SignOutButton } from "@/components/dashboard/sign-out";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { NotificationsMenu } from "@/components/dashboard/notifications-menu";
import { TasksMenu } from "@/components/dashboard/tasks-menu";
import { RealtimeBridge } from "@/components/dashboard/realtime-bridge";
import { getBillingCatalog } from "@/lib/billing";
import { BillingProvider } from "@/components/providers/billing-provider";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user?.tenantId) redirect("/login");

  const catalog = await getBillingCatalog(session.user.tenantId);

  return (
    <BillingProvider initialData={catalog}>
      <div className="dashboard-shell theme-rescue flex h-[100dvh] bg-slate-100 p-0 lg:p-4 dark:bg-slate-900">
        <div className="flex flex-1 overflow-hidden lg:rounded-[2.5rem] bg-[#0B0C1E] shadow-2xl relative w-full">
          <Sidebar role={session.user.role} />
          <div className="flex flex-1 flex-col min-w-0 bg-white dark:bg-slate-950 lg:ltr:rounded-l-[2.5rem] lg:rtl:rounded-r-[2.5rem] shadow-[-10px_0_30px_rgba(0,0,0,0.1)] relative z-10">
            <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:ltr:rounded-tl-[2.5rem] lg:rtl:rounded-tr-[2.5rem]">
              <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 rtl:pl-16 ltr:pr-16 lg:px-8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{session.user.name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="hidden lg:block">
                  <NotificationsMenu />
                </div>
                <div className="hidden lg:block">
                  <TasksMenu />
                </div>
                <ThemeToggle />
                <div className="hidden md:block">
                  <SignOutButton />
                </div>
              </div>
            </div>
          </header>
          <main className="pb-mobile-nav flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">{children}</main>
          <RealtimeBridge />
        </div>
      </div>
    </div>
  </BillingProvider>
);
}

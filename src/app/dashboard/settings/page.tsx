import { requireSession } from "@/lib/auth";
import { getTenantSummary } from "@/lib/dashboard-data";
import { getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/dashboard/settings-form";

export default async function SettingsPage() {
  const session = await requireSession();
  const summary = await getTenantSummary(session.user.tenantId);
  const locale = await getLocale();
  const isAr = locale === "ar";

  const initialData = {
    userName: session.user.name || "",
    userEmail: session.user.email || "",
    tenantName: summary.tenantName || "",
    userRole: session.user.role || "viewer",
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={isAr ? "الإعدادات" : "Settings"}
        description={isAr ? "إدارة إعدادات الحساب الشخصي ومساحة العمل الخاصة بك." : "Manage your personal account and workspace settings."}
      />
      
      <div className="mt-6">
        <SettingsForm initialData={initialData} />
      </div>

      <div className="mt-8 text-xs text-slate-500 dark:text-slate-400">
        <p>Tenant ID: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-1" dir="ltr">{session.user.tenantId}</span></p>
      </div>
    </div>
  );
}

import { requireSession } from "@/lib/auth";
import { getTenantSummary } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function SettingsPage() {
  const session = await requireSession();
  const summary = await getTenantSummary(session.user.tenantId);

  return (
    <>
      <PageHeader title="الإعدادات" description="معلومات المستأجر والحساب الحالي." />
      <section className="panel max-w-3xl p-5">
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">اسم المستأجر</dt>
            <dd className="mt-1 font-semibold text-ink">{summary.tenantName}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Tenant ID</dt>
            <dd className="mt-1 break-all font-mono text-sm text-ink" dir="ltr">{session.user.tenantId}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">المستخدم</dt>
            <dd className="mt-1 font-semibold text-ink">{session.user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">الدور</dt>
            <dd className="mt-1 font-semibold text-ink">{session.user.role}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

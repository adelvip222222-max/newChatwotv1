import { requirePlatformAdmin } from "@/lib/authz";
import { getGlobalAnalytics, getTenantsWithEmployees } from "@/lib/admin-analytics";
import { PageHeader } from "@/components/dashboard/page-header";
import { AdminMainDashboard } from "@/components/admin/main-dashboard";

export default async function AdminPage() {
  await requirePlatformAdmin();
  
  const stats = await getGlobalAnalytics();
  const tenants = await getTenantsWithEmployees();

  return (
    <>
      <PageHeader
        title="لوحة التحكم المركزية"
        description="نظرة شاملة على جميع الإحصاءات والمتاجر والمستخدمين في النظام."
      />
      <AdminMainDashboard stats={stats} tenants={tenants} />
    </>
  );
}

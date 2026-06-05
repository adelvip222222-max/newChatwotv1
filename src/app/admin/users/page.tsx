import { requireAdmin } from "@/lib/authz";
import { getAdminUsersData } from "@/lib/user-admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const data = await getAdminUsersData(session.user.tenantId);

  return (
    <>
      <PageHeader
        title="إدارة المستخدمين"
        description="كل مشترك يمكنه إضافة 2 مدير و2 موظف يدخلون نفس بروفايل الشركة مع تخزين ownerId للمشترك الرئيسي."
      />
      <UsersAdmin users={data.users} usage={data.usage} limits={data.limits} />
    </>
  );
}

import { requirePlatformAdmin } from "@/lib/authz";
import { getAdminUsersData } from "@/lib/user-admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function AdminUsersPage() {
  const session = await requirePlatformAdmin();
  const data = await getAdminUsersData(session.user.tenantId);

  return (
    <>
      <PageHeader
        title="User management"
        description="Manage tenant users, roles, active status, and role quotas from one place."
      />
      <UsersAdmin users={data.users} usage={data.usage} limits={data.limits} />
    </>
  );
}

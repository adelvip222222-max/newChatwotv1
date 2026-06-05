import { getCurrentSession } from "@/lib/auth";

export async function assertTenantAccess(tenantId: string) {
  const session = await getCurrentSession();
  if (!session?.user?.tenantId || session.user.tenantId !== tenantId) {
    throw new Error("غير مصرح بالوصول إلى بيانات هذا المستأجر.");
  }
  return session;
}

export function assertObjectIdLike(value: string, label = "id") {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new Error(`${label} غير صالح.`);
  }
}

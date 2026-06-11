import { requirePlatformAdmin } from "@/lib/authz";
import { getBillingCatalog } from "@/lib/billing";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingAdmin } from "@/components/admin/billing-admin";

export default async function AdminBillingPage() {
  const session = await requirePlatformAdmin();
  const catalog = await getBillingCatalog(session.user.tenantId);

  return (
    <>
      <PageHeader
        title="خطط الدفع والاشتراكات"
        description="الأدمن فقط يحدد الخطط الشهرية/السنوية وباقات زيادة الرسائل وأسعار Stripe."
      />
      <BillingAdmin plans={catalog.plans} packs={catalog.packs} />
    </>
  );
}

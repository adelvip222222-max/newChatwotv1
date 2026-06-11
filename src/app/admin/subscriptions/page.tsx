import { requirePlatformAdmin } from "@/lib/authz";
import { getSubscriptionAnalytics, getAllSubscriptions } from "@/lib/billing";
import { PageHeader } from "@/components/dashboard/page-header";
import { SubscriptionsDashboard } from "@/components/admin/subscriptions-dashboard";

export default async function AdminSubscriptionsPage() {
  await requirePlatformAdmin();
  
  const analytics = await getSubscriptionAnalytics();
  const subscriptions = await getAllSubscriptions();

  return (
    <>
      <PageHeader
        title="الاشتراكات والإيرادات"
        description="تابع الإيرادات الشهرية (MRR) وحالات المشتركين في جميع الخطط لزيادة المبيعات."
      />
      <SubscriptionsDashboard analytics={analytics} subscriptions={subscriptions} />
    </>
  );
}

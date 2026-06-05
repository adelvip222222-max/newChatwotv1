import { requireSession } from "@/lib/auth";
import { getBillingCatalog, syncSubscriptionWithStripe, completeStripeCheckout } from "@/lib/billing";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingCheckout } from "@/components/dashboard/billing-checkout";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function BillingPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  
  if (params.success === "1") {
    if (params.session_id && typeof params.session_id === "string") {
      await completeStripeCheckout(params.session_id);
    } else {
      await syncSubscriptionWithStripe(session.user.tenantId);
    }
  }

  const catalog = await getBillingCatalog(session.user.tenantId);

  return (
    <>
      <PageHeader title="الدفع والاشتراك" description="اختر خطة أساسية أو اشتر باقات رسائل إضافية عبر Stripe." />
      <BillingCheckout plans={catalog.plans} packs={catalog.packs} subscription={catalog.subscription} />
    </>
  );
}

import { requireSession } from "@/lib/auth";
import { getBillingCatalog, syncSubscriptionWithStripe, completeStripeCheckout } from "@/lib/billing";
import { getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingCheckout } from "@/components/dashboard/billing-checkout";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function BillingPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const locale = await getLocale();
  const isAr = locale === "ar";
  
  if (params.success === "1") {
    if (params.session_id && typeof params.session_id === "string") {
      await completeStripeCheckout(params.session_id, session.user.tenantId);
    } else {
      await syncSubscriptionWithStripe(session.user.tenantId);
    }
  }

  const catalog = await getBillingCatalog(session.user.tenantId);

  return (
    <>
      <PageHeader
        title={isAr ? "الدفع والاشتراك" : "Billing and subscription"}
        description={
          isAr
            ? "اختر خطة أساسية أو اشتر باقات رسائل إضافية عبر Stripe."
            : "Choose a base plan or buy extra message packs through Stripe."
        }
      />
      <BillingCheckout plans={catalog.plans} packs={catalog.packs} subscription={catalog.subscription} />
    </>
  );
}

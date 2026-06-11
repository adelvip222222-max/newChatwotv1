"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type BillingItem = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  isActive: boolean;
  interval?: string;
  aiMessageLimit?: number;
  messageCredits?: number;
  isPopular?: boolean;
};

const copy = {
  ar: {
    checkoutError: "تعذر بدء الدفع.",
    portalError: "تعذر فتح بوابة الدفع",
    credits: "رصيد الرسائل",
    manageLoading: "جاري التحويل...",
    manage: "إدارة الاشتراك (ترقية / خفض)",
    status: "الحالة",
    used: "المستخدم",
    available: "المتاح",
    plans: "الخطط الأساسية",
    packs: "زيادة رسائل AI",
    emptyTitle: "لا توجد عناصر دفع متاحة حاليًا.",
    emptyDesc: "لن تظهر أي خطة أو باقة هنا إلا بعد أن يضيفها المدير من شاشة Admin Billing.",
    popular: "الأكثر اختيارًا",
    currentPlan: "الخطة الحالية",
    subscribe: "اشترك",
    buyPack: "شراء الباقة",
    redirecting: "جاري التحويل...",
    month: "شهر",
    year: "سنة",
    aiReply: "رد AI",
    extraMessage: "رسالة إضافية"
  },
  en: {
    checkoutError: "Unable to start checkout.",
    portalError: "Unable to open billing portal",
    credits: "Message credits",
    manageLoading: "Redirecting...",
    manage: "Manage subscription",
    status: "Status",
    used: "Used",
    available: "Available",
    plans: "Base plans",
    packs: "Extra AI messages",
    emptyTitle: "No billing items are available right now.",
    emptyDesc: "Plans and packs will appear here after an admin adds them from Admin Billing.",
    popular: "Most selected",
    currentPlan: "Current plan",
    subscribe: "Subscribe",
    buyPack: "Buy pack",
    redirecting: "Redirecting...",
    month: "month",
    year: "year",
    aiReply: "AI replies",
    extraMessage: "extra messages"
  }
} as const;

export function BillingCheckout({
  plans,
  packs,
  subscription
}: {
  plans: BillingItem[];
  packs: BillingItem[];
  subscription: null | {
    status: string;
    monthlyMessageLimit: number;
    usedMessages: number;
    extraMessageCredits: number;
    planName?: string;
  };
}) {
  const { locale } = useI18n();
  const labels = copy[locale];
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  async function checkout(kind: "plan" | "pack", itemId: string) {
    setError("");
    setLoading(`${kind}-${itemId}`);
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, itemId })
    });
    const body = await response.json();
    setLoading("");
    if (!response.ok || !body.url) {
      setError(body.error || labels.checkoutError);
      return;
    }
    window.location.href = body.url;
  }

  async function manageSubscription() {
    setError("");
    setLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || labels.portalError);
      window.location.href = body.url;
    } catch (e: any) {
      setError(e.message);
      setLoading("");
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="callout-error">{error}</p> : null}
      <section className="panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-ink">{labels.credits}</h2>
            {subscription?.planName ? (
              <span className="rounded-full bg-violet-100 px-3 py-0.5 text-sm font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                {subscription.planName}
              </span>
            ) : null}
          </div>
          {subscription?.planName && subscription.planName.toLowerCase() !== "free" ? (
            <button onClick={manageSubscription} disabled={loading === "portal"} className="btn-secondary text-xs">
              {loading === "portal" ? labels.manageLoading : labels.manage}
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label={labels.status} value={subscription?.status || "inactive"} />
          <Stat label={labels.used} value={String(subscription?.usedMessages || 0)} />
          <Stat label={labels.available} value={String((subscription?.monthlyMessageLimit || 0) + (subscription?.extraMessageCredits || 0))} />
        </div>
      </section>
      <Catalog title={labels.plans} labels={labels} items={plans.filter((item) => item.isActive)} kind="plan" loading={loading} checkout={checkout} currentPlanName={subscription?.planName} />
      <Catalog title={labels.packs} labels={labels} items={packs.filter((item) => item.isActive)} kind="pack" loading={loading} checkout={checkout} />
    </div>
  );
}

function Catalog({
  title,
  labels,
  items,
  kind,
  loading,
  checkout,
  currentPlanName
}: {
  title: string;
  labels: typeof copy.ar | typeof copy.en;
  items: BillingItem[];
  kind: "plan" | "pack";
  loading: string;
  checkout: (kind: "plan" | "pack", itemId: string) => void;
  currentPlanName?: string;
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-ink">{title}</h2>
      <div className={`grid gap-4 md:grid-cols-2 ${kind === "pack" ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {!items.length ? (
          <div className="panel p-6 md:col-span-2 xl:col-span-3">
            <p className="text-sm font-semibold text-ink">{labels.emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{labels.emptyDesc}</p>
          </div>
        ) : null}
        {items.map((item) => (
          <article key={item.id} className="panel p-5">
            {item.isPopular ? <p className="mb-3 text-sm font-bold text-coral">{labels.popular}</p> : null}
            <h3 className="text-lg font-bold text-ink">{item.name}</h3>
            <p className="mt-3 text-3xl font-bold text-ink">
              {(item.priceCents / 100).toFixed(2)} <span className="text-sm">{item.currency.toUpperCase()}</span>
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {kind === "plan"
                ? `${item.aiMessageLimit || 0} ${labels.aiReply} / ${item.interval === "year" ? labels.year : labels.month}`
                : `${item.messageCredits || 0} ${labels.extraMessage}`}
            </p>
            {kind === "plan" && currentPlanName === item.name ? (
              <button className="mt-5 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500" disabled>
                {labels.currentPlan}
              </button>
            ) : (
              <button className={kind === "plan" ? "btn-primary mt-5 w-full" : "btn-secondary mt-5 w-full"} onClick={() => checkout(kind, item.id)} disabled={loading === `${kind}-${item.id}`}>
                <CreditCard size={18} />
                {loading === `${kind}-${item.id}` ? labels.redirecting : kind === "plan" ? labels.subscribe : labels.buyPack}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

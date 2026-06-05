"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";

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
      setError(body.error || "تعذر بدء الدفع.");
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
      if (!res.ok || !body.url) throw new Error(body.error || "تعذر فتح بوابة الدفع");
      window.location.href = body.url;
    } catch (e: any) {
      setError(e.message);
      setLoading("");
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <section className="panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-ink">رصيد الرسائل</h2>
            {subscription?.planName && (
              <span className="rounded-full bg-violet-100 px-3 py-0.5 text-sm font-medium text-violet-700">
                {subscription.planName}
              </span>
            )}
          </div>
          {subscription?.planName && subscription.planName.toLowerCase() !== "free" && (
            <button onClick={manageSubscription} disabled={loading === "portal"} className="btn-secondary text-xs">
              {loading === "portal" ? "جاري التحويل..." : "إدارة الاشتراك (ترقية / خفض)"}
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="الحالة" value={subscription?.status || "inactive"} />
          <Stat label="المستخدم" value={String(subscription?.usedMessages || 0)} />
          <Stat label="المتاح" value={String((subscription?.monthlyMessageLimit || 0) + (subscription?.extraMessageCredits || 0))} />
        </div>
      </section>
      <Catalog title="الخطط الأساسية" items={plans.filter((item) => item.isActive)} kind="plan" loading={loading} checkout={checkout} currentPlanName={subscription?.planName} />
      <Catalog title="زيادة رسائل AI" items={packs.filter((item) => item.isActive)} kind="pack" loading={loading} checkout={checkout} />
    </div>
  );
}

function Catalog({
  title,
  items,
  kind,
  loading,
  checkout,
  currentPlanName
}: {
  title: string;
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
            <p className="text-sm font-semibold text-ink">لا توجد عناصر دفع متاحة حاليًا.</p>
            <p className="mt-1 text-sm text-slate-500">لن تظهر أي خطة أو باقة هنا إلا بعد أن يضيفها المدير من شاشة Admin Billing.</p>
          </div>
        ) : null}
        {items.map((item) => (
          <article key={item.id} className="panel p-5">
            {item.isPopular ? <p className="mb-3 text-sm font-bold text-coral">الأكثر اختيارا</p> : null}
            <h3 className="text-lg font-bold">{item.name}</h3>
            <p className="mt-3 text-3xl font-bold">
              {(item.priceCents / 100).toFixed(2)} <span className="text-sm">{item.currency.toUpperCase()}</span>
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {kind === "plan"
                ? `${item.aiMessageLimit || 0} رد AI / ${item.interval === "year" ? "سنة" : "شهر"}`
                : `${item.messageCredits || 0} رسالة إضافية`}
            </p>
            {kind === "plan" && currentPlanName === item.name ? (
              <button className="mt-5 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed" disabled>
                الخطة الحالية
              </button>
            ) : (
              <button className={kind === "plan" ? "btn-primary mt-5 w-full" : "btn-secondary mt-5 w-full"} onClick={() => checkout(kind, item.id)} disabled={loading === `${kind}-${item.id}`}>
                <CreditCard size={18} />
                {loading === `${kind}-${item.id}` ? "جاري التحويل..." : kind === "plan" ? "اشترك" : "شراء الباقة"}
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
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

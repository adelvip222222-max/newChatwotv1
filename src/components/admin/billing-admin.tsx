"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";

type PlanRow = {
  id: string;
  name: string;
  interval: string;
  priceCents: number;
  currency: string;
  aiMessageLimit: number;
  stripePriceId: string;
  isPopular: boolean;
  isActive: boolean;
};

type PackRow = {
  id: string;
  name: string;
  messageCredits: number;
  priceCents: number;
  currency: string;
  stripePriceId: string;
  sortOrder: number;
  isActive: boolean;
};

export function BillingAdmin({ plans, packs }: { plans: PlanRow[]; packs: PackRow[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(path: string, form: HTMLFormElement, extra: Record<string, unknown> = {}) {
    setError("");
    setSuccess("");
    const data = new FormData(form);
    const payload: Record<string, unknown> = { ...extra };
    for (const [key, value] of data.entries()) {
      payload[key] = value;
    }
    payload.priceCents = Math.round(Number(payload.price || 0) * 100);
    delete payload.price;
    payload.aiMessageLimit = payload.aiMessageLimit ? Number(payload.aiMessageLimit) : undefined;
    payload.messageCredits = payload.messageCredits ? Number(payload.messageCredits) : undefined;
    payload.sortOrder = payload.sortOrder ? Number(payload.sortOrder) : 0;
    payload.isActive = data.get("isActive") === "on";
    payload.isPopular = data.get("isPopular") === "on";

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error || "تعذر الحفظ.");
      return;
    }
    form.reset();
    setSuccess("تم الحفظ.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

      <form className="panel p-5" onSubmit={(event) => { event.preventDefault(); submit("/api/admin/billing/plans", event.currentTarget); }}>
        <div className="mb-5 flex items-center gap-2">
          <Plus size={18} className="text-accent" />
          <h2 className="text-lg font-bold text-ink">إضافة خطة شهرية أو سنوية</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field name="name" label="اسم الخطة" required />
          <Field name="price" label="السعر" type="number" step="0.01" required />
          <Field name="aiMessageLimit" label="عدد ردود AI" type="number" required />
          <div>
            <label className="label">الفترة</label>
            <select className="field" name="interval" defaultValue="month">
              <option value="month">شهري</option>
              <option value="year">سنوي</option>
            </select>
          </div>
          <Field name="currency" label="العملة" defaultValue="usd" />
          <Field name="stripePriceId" label="Stripe Price ID" />
          <div className="xl:col-span-2">
            <label className="label">الوصف</label>
            <input className="field" name="description" />
          </div>
          <Checks popular />
        </div>
        <button className="btn-primary mt-5">
          <Save size={18} />
          حفظ الخطة
        </button>
      </form>

      <form className="panel p-5" onSubmit={(event) => { event.preventDefault(); submit("/api/admin/billing/packs", event.currentTarget); }}>
        <div className="mb-5 flex items-center gap-2">
          <Plus size={18} className="text-coral" />
          <h2 className="text-lg font-bold text-ink">إضافة باقة زيادة رسائل</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field name="name" label="اسم الباقة" required />
          <Field name="messageCredits" label="عدد الرسائل" type="number" required />
          <Field name="price" label="السعر" type="number" step="0.01" required />
          <Field name="currency" label="العملة" defaultValue="usd" />
          <Field name="stripePriceId" label="Stripe Price ID" />
          <Field name="sortOrder" label="الترتيب" type="number" defaultValue="0" />
          <Checks />
        </div>
        <button className="btn-primary mt-5">
          <Save size={18} />
          حفظ الباقة
        </button>
      </form>

      <BillingTable title="الخطط الأساسية" rows={plans} kind="plans" />
      <BillingTable title="باقات زيادة الرسائل" rows={packs} kind="packs" />
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field" {...rest} />
    </div>
  );
}

function Checks({ popular = false }: { popular?: boolean }) {
  return (
    <div className="flex items-end gap-5 pb-2">
      {popular ? (
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input name="isPopular" type="checkbox" />
          مميزة
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input name="isActive" type="checkbox" defaultChecked />
        مفعل
      </label>
    </div>
  );
}

function BillingTable({ title, rows, kind }: { title: string; rows: Array<Record<string, unknown> & { id: string }>; kind: string }) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="border-b border-slate-100 p-4 text-lg font-bold text-ink">{title}</h2>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">السعر</th>
              <th className="p-3 text-right">الرسائل</th>
              <th className="p-3 text-right">Stripe</th>
              <th className="p-3 text-right">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${kind}-${row.id}`} className="border-t border-slate-100">
                <td className="p-3 font-semibold">{String(row.name)}</td>
                <td className="p-3">{(Number(row.priceCents) / 100).toFixed(2)} {String(row.currency).toUpperCase()}</td>
                <td className="p-3">{String(row.aiMessageLimit || row.messageCredits || 0)}</td>
                <td className="p-3 font-mono text-xs" dir="ltr">{String(row.stripePriceId || "inline price")}</td>
                <td className="p-3">{row.isActive ? "مفعل" : "معطل"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="p-5 text-sm text-slate-500">لا توجد عناصر بعد.</p>
      )}
    </section>
  );
}

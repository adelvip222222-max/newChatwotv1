"use client";

import { useState } from "react";
import { DollarSign, Users, Activity, Trash2, ShieldAlert } from "lucide-react";

type Subscription = {
  id: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  status: string;
  usedMessages: number;
  monthlyLimit: number;
  extraCredits: number;
  currentPeriodEnd: string;
};

type Analytics = {
  mrrCents: number;
  activeCount: number;
  distribution: { name: string; count: number }[];
};

export function SubscriptionsDashboard({ analytics, subscriptions }: { analytics: Analytics; subscriptions: Subscription[] }) {
  const [loading, setLoading] = useState("");
  const [subs, setSubs] = useState(subscriptions);

  async function handleCancel(id: string) {
    if (!confirm("هل أنت متأكد أنك تريد إلغاء هذا الاشتراك؟ سيتم إيقاف الميزات المدفوعة فوراً.")) return;
    
    setLoading(id);
    try {
      const res = await fetch("/api/admin/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: id })
      });
      if (res.ok) {
        setSubs(subs.map(s => s.id === id ? { ...s, status: "canceled" } : s));
      } else {
        const body = await res.json();
        alert(body.error || "خطأ أثناء الإلغاء.");
      }
    } catch (e) {
      alert("حدث خطأ في الاتصال.");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="الإيرادات الشهرية (MRR)" value={`$${(analytics.mrrCents / 100).toFixed(2)}`} icon={<DollarSign className="text-emerald-500" />} />
        <StatCard title="الاشتراكات النشطة" value={analytics.activeCount} icon={<Activity className="text-blue-500" />} />
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-md bg-slate-100 p-2"><Users className="text-violet-500" /></div>
            <h3 className="text-sm font-semibold text-slate-500">توزيع المستخدمين</h3>
          </div>
          <div className="space-y-2">
            {analytics.distribution.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-ink">{d.name}</span>
                <span className="font-bold">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-ink">قائمة المشتركين</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">المستأجر</th>
                <th className="px-5 py-3 font-medium">الخطة</th>
                <th className="px-5 py-3 font-medium">الحالة</th>
                <th className="px-5 py-3 font-medium">استهلاك AI</th>
                <th className="px-5 py-3 font-medium">تاريخ التجديد</th>
                <th className="px-5 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-slate-500">لا يوجد مشتركون بعد.</td>
                </tr>
              ) : null}
              {subs.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">{sub.tenantName}</p>
                    <p className="text-xs text-slate-500">{sub.tenantSlug}</p>
                  </td>
                  <td className="px-5 py-4 font-medium text-ink">{sub.planName}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span>{sub.usedMessages} / {sub.monthlyLimit} <span className="text-xs text-slate-400">(أساسي)</span></span>
                      {sub.extraCredits > 0 && <span className="text-xs text-violet-600">{sub.extraCredits} إضافي</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("ar-EG") : "-"}
                  </td>
                  <td className="px-5 py-4">
                    {sub.status === "active" ? (
                      <button
                        onClick={() => handleCancel(sub.id)}
                        disabled={loading === sub.id}
                        className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        <ShieldAlert size={14} />
                        {loading === sub.id ? "جاري..." : "إلغاء"}
                      </button>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="panel p-5 flex flex-col justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-slate-100 p-2">{icon}</div>
        <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
      </div>
      <p className="mt-4 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

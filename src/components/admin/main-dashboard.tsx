"use client";

import { Building2, Users, Bot, MessageSquare, MessagesSquare, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { GlobalStats, TenantWithEmployees } from "@/lib/admin-analytics";

export function AdminMainDashboard({ stats, tenants }: { stats: GlobalStats; tenants: TenantWithEmployees[] }) {
  return (
    <div className="space-y-8">
      {/* Global Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="المتاجر (Tenants)" value={stats.totalTenants} icon={<Building2 className="text-violet-500" />} />
        <StatCard title="المستخدمين" value={stats.totalUsers} icon={<Users className="text-blue-500" />} />
        <StatCard title="البوتات النشطة" value={stats.totalBots} icon={<Bot className="text-emerald-500" />} />
        <StatCard title="المحادثات" value={stats.totalConversations} icon={<MessageSquare className="text-amber-500" />} />
        <StatCard title="إجمالي الرسائل" value={stats.totalMessages} icon={<MessagesSquare className="text-rose-500" />} />
      </div>

      {/* Tenants & Employees Table */}
      <section className="panel overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-ink">المتاجر والموظفين</h2>
          <p className="mt-1 text-sm text-slate-500">نظرة عامة على جميع المتاجر المسجلة في النظام مع موظفيهم وصلاحياتهم.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">المتجر (Tenant)</th>
                <th className="px-5 py-3 font-medium">الخطة</th>
                <th className="px-5 py-3 font-medium">الحالة</th>
                <th className="px-5 py-3 font-medium">الموظفين (Users)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-5 text-center text-slate-500">لا يوجد متاجر مسجلة بعد.</td>
                </tr>
              ) : null}
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-5 py-4 align-top">
                    <p className="font-bold text-ink">{tenant.name}</p>
                    <p className="text-xs text-slate-500">/{tenant.slug}</p>
                  </td>
                  <td className="px-5 py-4 align-top font-medium text-ink">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    {tenant.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CheckCircle2 size={14} />
                        نشط
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        <ShieldAlert size={14} />
                        غير نشط
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex flex-col gap-2">
                      {tenant.employees.map((emp) => (
                        <div key={emp.id} className="flex items-center gap-2 rounded-md border border-slate-100 p-2 dark:border-slate-800">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-ink">{emp.name}</p>
                            <p className="truncate text-[10px] text-slate-500">{emp.email}</p>
                          </div>
                          <RoleBadge role={emp.role} />
                        </div>
                      ))}
                      {tenant.employees.length === 0 && (
                        <p className="text-xs text-slate-500">لا يوجد مستخدمين مرتبطين.</p>
                      )}
                    </div>
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
    <div className="panel p-5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-900">{icon}</div>
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</h3>
      </div>
      <p className="mt-4 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "super-admin":
      return <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300">مدير المنصة</span>;
    case "owner":
      return <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">مالك قديم</span>;
    case "admin":
      return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">مشرف</span>;
    case "agent":
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">موظف</span>;
    default:
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{role}</span>;
  }
}

import Link from "next/link";
import { Activity, ArrowRight, Bot, MessageSquare, PlugZap, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getDashboardActivity, getDashboardChannels, getTenantSummary } from "@/lib/dashboard-data";
import { getLocale } from "@/lib/i18n";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { RecentConversationsWidget } from "@/components/dashboard/recent-conversations-widget";

export default async function DashboardPage() {
  const session = await requireSession();
  const [summary, activity, channels, locale] = await Promise.all([
    getTenantSummary(session.user.tenantId),
    getDashboardActivity(session.user.tenantId),
    getDashboardChannels(session.user.tenantId),
    getLocale(),
  ]);
  const isAr = locale === "ar";

  const kpis = [
    {
      label: isAr ? "Chats Today" : "Chats Today",
      value: summary.todayMessages,
      helper: isAr ? "رسائل اليوم عبر كل القنوات" : "Messages across all channels today",
      icon: MessageSquare,
      tone: "from-indigo-500/15 to-indigo-500/5 text-indigo-700 dark:text-indigo-300",
    },
    {
      label: isAr ? "Active Conversations" : "Active Conversations",
      value: summary.activeConversations,
      helper: isAr ? "محادثات مفتوحة أو بانتظار المعالجة" : "Open or pending threads right now",
      icon: Users,
      tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: isAr ? "AI Resolution Rate" : "AI Resolution Rate",
      value: `${summary.aiResolutionRate}%`,
      helper: isAr ? "نسبة الإغلاقات التي تمت آليًا" : "Resolved by AI workflows",
      icon: Bot,
      tone: "from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300",
    },
    {
      label: isAr ? "Human Resolution Rate" : "Human Resolution Rate",
      value: `${summary.humanResolutionRate}%`,
      helper: isAr ? "نسبة الإغلاقات بواسطة الفريق" : "Resolved by human agents",
      icon: Activity,
      tone: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-5 py-6 shadow-soft dark:border-slate-800 dark:bg-slate-950 sm:px-7">
        <div className="absolute inset-y-0 ltr:right-0 rtl:left-0 w-1/2 bg-gradient-to-l from-indigo-500/10 to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="mobile-section-title">{isAr ? "Mobile CRM" : "Mobile CRM"}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {isAr ? "لوحة تشغيل سريعة لفريق ChatZi" : "A mobile-ready operating view for ChatZi"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              {isAr
                ? "تابع محادثات اليوم، نسب الحل، وحالة القنوات من شاشة واحدة محسّنة للهاتف والتابلت وسطح المكتب."
                : "Track today's chats, resolution rates, and channel health from one view tuned for phone, tablet, and desktop."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard/conversations" className="btn-primary rounded-2xl px-5 py-3">
              <MessageSquare size={18} />
              {isAr ? "فتح المحادثات" : "Open Inbox"}
            </Link>
            <Link href="/dashboard/channels" className="btn-secondary rounded-2xl px-5 py-3">
              <PlugZap size={18} />
              {isAr ? "إدارة القنوات" : "Manage Channels"}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`mobile-card bg-gradient-to-br ${item.tone}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-4 text-4xl font-black tracking-tight text-ink dark:text-white">{item.value}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.helper}</p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-current shadow-sm dark:bg-slate-900/60">
                  <Icon size={20} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]">
        <section className="panel p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mobile-section-title">{isAr ? "Analytics" : "Analytics"}</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{isAr ? "نشاط الرسائل آخر 7 أيام" : "Message activity over the last 7 days"}</h2>
            </div>
            <span className="badge-info">{summary.messages} {isAr ? "رسالة" : "messages"}</span>
          </div>
          <div className="mt-4">
            <ActivityChart data={activity.chartData} isAr={isAr} />
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mobile-section-title">{isAr ? "Live Inbox" : "Live Inbox"}</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{isAr ? "أحدث المحادثات" : "Recent conversations"}</h2>
            </div>
            <Link href="/dashboard/conversations" className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
              {isAr ? "عرض الكل" : "View all"}
            </Link>
          </div>
          <div className="mt-4">
            <RecentConversationsWidget conversations={activity.recentConversations} isAr={isAr} />
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <p className="mobile-section-title">{isAr ? "Channels" : "Channels"}</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{isAr ? "حالة القنوات المتصلة" : "Connected channel health"}</h2>
        </div>

        <div className="space-y-3 p-4 sm:hidden">
          {channels.length ? (
            channels.map((channel) => (
              <article key={channel.id} className="mobile-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink">{channel.name || channel.type}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{channel.type}</p>
                  </div>
                  <span className={channel.isActive ? "badge-success" : "badge-neutral"}>
                    {channel.isActive ? (isAr ? "فعال" : "Active") : (isAr ? "معطل" : "Inactive")}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <p>{channel.endpoint}</p>
                  <div className="flex items-center justify-between">
                    <span>{isAr ? "الضغط" : "Load"}</span>
                    <span className="font-semibold text-ink dark:text-white">{channel.load}%</span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {isAr ? "لا توجد قنوات مفعّلة بعد." : "No connected channels yet."}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm text-slate-500">
            <thead className="bg-slate-50 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="p-4 text-right rtl:text-right ltr:text-left">{isAr ? "القناة" : "Channel"}</th>
                <th className="p-4 text-right rtl:text-right ltr:text-left">{isAr ? "المسار" : "Endpoint"}</th>
                <th className="p-4 text-right rtl:text-right ltr:text-left">{isAr ? "الضغط" : "Load"}</th>
                <th className="p-4 text-right rtl:text-right ltr:text-left">{isAr ? "التوافر" : "Uptime"}</th>
                <th className="p-4 text-right rtl:text-right ltr:text-left">{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-4 font-semibold text-ink">{channel.name || channel.type}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">{channel.endpoint}</td>
                  <td className="p-4 text-ink dark:text-white">{channel.load}%</td>
                  <td className="p-4">{channel.uptime}</td>
                  <td className="p-4">
                    <span className={channel.isActive ? "badge-success" : "badge-neutral"}>
                      {channel.isActive ? (isAr ? "فعال" : "Active") : (isAr ? "معطل" : "Inactive")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <Link href="/dashboard/channels" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            {isAr ? "الانتقال إلى القنوات" : "Go to channels"}
            <ArrowRight size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </div>
  );
}

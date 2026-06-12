import { Bot, MessageSquare, PlugZap, Send, TicketCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTenantSummary } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { getLocale } from "@/lib/i18n";

export default async function DashboardPage() {
  const session = await requireSession();
  const summary = await getTenantSummary(session.user.tenantId);
  const locale = await getLocale();
  
  const isAr = locale === "ar";

  const stats = [
    { label: isAr ? "عدد البوتات" : "Number of Bots", value: summary.bots, icon: Bot },
    { label: isAr ? "عدد المحادثات" : "Number of Conversations", value: summary.conversations, icon: MessageSquare },
    { label: isAr ? "عدد الرسائل" : "Number of Messages", value: summary.messages, icon: Send },
    { label: isAr ? "التذاكر المفتوحة" : "Open Tickets", value: summary.tickets, icon: TicketCheck },
    { label: isAr ? "القنوات المفعلة" : "Active Channels", value: summary.activeChannels, icon: PlugZap }
  ];

  return (
    <>
      <PageHeader 
        title={isAr ? `مرحباً بك في ${summary.tenantName}` : `Welcome to ${summary.tenantName}`} 
        description={isAr ? "نظرة سريعة على نشاط منصة ChatZi." : "A quick look at your ChatZi workspace activity."} 
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="panel p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Icon size={21} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stat.value}</p>
            </div>
          );
        })}
      </section>
    </>
  );
}

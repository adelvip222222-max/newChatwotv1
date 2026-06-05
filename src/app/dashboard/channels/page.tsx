import Link from "next/link";
import { Globe, MessageCircle, Send, Webhook, Bot } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";

const channels = [
  { href: "/dashboard/channels/website", title: "Website Widget", icon: Globe },
  { href: "/dashboard/channels/telegram", title: "Telegram", icon: Send },
  { href: "/dashboard/channels/whatsapp", title: "WhatsApp", icon: MessageCircle },
  { href: "/dashboard/channels/facebook", title: "Facebook Messenger", icon: Bot },
  { href: "/dashboard/channels/webhook", title: "Webhook", icon: Webhook }
];

export default function ChannelsPage() {
  return (
    <>
      <PageHeader title="القنوات" description="اربط ChatZi بمواقعك وتطبيقات المحادثة." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <Link key={channel.href} href={channel.href} className="panel block p-5 transition hover:border-accent">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-coral/10 text-coral">
                <Icon size={21} />
              </div>
              <h2 className="text-lg font-bold text-ink">{channel.title}</h2>
              <p className="mt-2 text-sm text-slate-500">إعدادات الربط، التفعيل، ونقاط Webhook.</p>
            </Link>
          );
        })}
      </section>
    </>
  );
}

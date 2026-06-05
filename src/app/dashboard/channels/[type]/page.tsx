import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getChannelPageData } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { ChannelForm } from "@/components/dashboard/channel-form";

const titles = {
  website: "Website Widget",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  facebook: "Facebook Messenger",
  webhook: "Webhook"
} as const;

export default async function ChannelTypePage({ params }: { params: Promise<{ type: string }> }) {
  const session = await requireAdmin();
  const { type } = await params;
  if (!(type in titles)) notFound();
  const data = await getChannelPageData(session.user.tenantId, type);

  return (
    <>
      <PageHeader title={titles[type as keyof typeof titles]} description="فعّل القناة واربطها بالبنية الخارجية المطلوبة." />
      <ChannelForm
        type={type as keyof typeof titles}
        title={titles[type as keyof typeof titles]}
        bots={data.bots}
        initial={data.initial}
        logs={data.logs}
        baseUrl={process.env.NEXTAUTH_URL || "http://localhost:3000"}
      />
    </>
  );
}

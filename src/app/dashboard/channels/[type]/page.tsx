import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getChannelPageData } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { ChannelForm } from "@/components/dashboard/channel-form";
import { getLocale } from "@/lib/i18n";

const titles = {
  website: { en: "Website Widget", ar: "ودجت الموقع" },
  telegram: { en: "Telegram", ar: "تيليجرام" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  facebook: { en: "Facebook Messenger", ar: "فيسبوك ماسنجر" },
  instagram: { en: "Instagram", ar: "إنستجرام" },
  email: { en: "Email Inbox", ar: "صندوق البريد" },
  api: { en: "API Channel", ar: "قناة API" },
  webhook: { en: "Webhook", ar: "Webhook" }
} as const;

export default async function ChannelTypePage({ params }: { params: Promise<{ type: string }> }) {
  const session = await requirePermission(permissions.settingsManage);
  const { type } = await params;
  if (!(type in titles)) notFound();
  const locale = await getLocale();
  const title = titles[type as keyof typeof titles][locale];
  
  const data = await getChannelPageData(session.user.tenantId, type as any);

  return (
    <>
      <PageHeader
        title={title}
        description={
          locale === "ar"
            ? "أدخل التوكن وبيانات القناة، ثم احفظ الإعدادات واختبر نقطة الربط."
            : "Configure tokens and channel data, then save settings and test webhooks."
        }
        backHref="/dashboard/channels"
        backLabel={locale === "ar" ? "رجوع للقنوات" : "Back to channels"}
      />
      <ChannelForm
        type={type as any}
        title={title}
        bots={data.bots}
        initial={data.initial}
        logs={data.logs}
        baseUrl={process.env.NEXTAUTH_URL || "http://localhost:3000"}
      />
    </>
  );
}

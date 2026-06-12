import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle,
  Globe,
  Mail,
  MessageCircle,
  PlugZap,
  RadioTower,
  Send,
  Server,
  Webhook
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { getLocale } from "@/lib/i18n";
import { Channel, Conversation, WebhookEvent, WebhookLog } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/authz";

type ChannelType = "website" | "telegram" | "whatsapp" | "facebook" | "instagram" | "email" | "api" | "webhook";

type ChannelDefinition = {
  type: ChannelType;
  href: string;
  title: { en: string; ar: string };
  icon: typeof Globe;
  desc: { en: string; ar: string };
};

const channelDefinitions: ChannelDefinition[] = [
  {
    type: "website",
    href: "/dashboard/channels/website",
    title: { en: "Website Widget", ar: "ودجت الموقع" },
    icon: Globe,
    desc: { en: "Embed a live chat widget on your site.", ar: "أضف ودجت محادثة مباشرة داخل موقعك." }
  },
  {
    type: "telegram",
    href: "/dashboard/channels/telegram",
    title: { en: "Telegram", ar: "تيليجرام" },
    icon: Send,
    desc: { en: "Connect your Telegram Bot token and webhook.", ar: "اربط توكن بوت تيليجرام وفعّل Webhook." }
  },
  {
    type: "whatsapp",
    href: "/dashboard/channels/whatsapp",
    title: { en: "WhatsApp", ar: "واتساب" },
    icon: MessageCircle,
    desc: { en: "Connect WhatsApp Cloud API credentials.", ar: "اربط بيانات WhatsApp Cloud API." }
  },
  {
    type: "facebook",
    href: "/dashboard/channels/facebook",
    title: { en: "Facebook Messenger", ar: "فيسبوك ماسنجر" },
    icon: Bot,
    desc: { en: "Connect a Facebook Page access token.", ar: "اربط توكن صفحة فيسبوك وبيانات الصفحة." }
  },
  {
    type: "instagram",
    href: "/dashboard/channels/instagram",
    title: { en: "Instagram", ar: "إنستجرام" },
    icon: Camera,
    desc: { en: "Prepare Instagram Business connection data.", ar: "جهّز بيانات اتصال حساب إنستجرام للأعمال." }
  },
  {
    type: "email",
    href: "/dashboard/channels/email",
    title: { en: "Email Inbox", ar: "صندوق البريد" },
    icon: Mail,
    desc: { en: "Store mailbox connection settings.", ar: "احفظ إعدادات اتصال البريد الإلكتروني." }
  },
  {
    type: "api",
    href: "/dashboard/channels/api",
    title: { en: "API Channel", ar: "قناة API" },
    icon: Server,
    desc: { en: "Configure custom API integration keys.", ar: "اضبط مفاتيح الربط لقناة API مخصصة." }
  },
  {
    type: "webhook",
    href: "/dashboard/channels/webhook",
    title: { en: "Webhook", ar: "Webhook" },
    icon: Webhook,
    desc: { en: "Use a generic webhook endpoint.", ar: "استخدم نقطة ربط عامة لاستقبال الرسائل." }
  }
];

export default async function ChannelsPage() {
  const session = await requireAdmin();
  const locale = await getLocale();
  const isAr = locale === "ar";
  const data = await getChannelsOverview(session.user.tenantId);

  async function disconnectChannel(formData: FormData) {
    "use server";
    const session = await requireAdmin();
    const type = String(formData.get("type") || "");
    const botId = String(formData.get("botId") || "");
    if (!channelDefinitions.some((channel) => channel.type === type)) return;

    await connectToDatabase();
    await Channel.updateMany(
      {
        tenantId: session.user.tenantId,
        type,
        ...(botId && Types.ObjectId.isValid(botId) ? { botId } : {})
      },
      { $set: { isActive: false } }
    );
    revalidatePath("/dashboard/channels");
  }

  return (
    <>
      <PageHeader
        title={isAr ? "القنوات" : "Channels"}
        description={
          isAr
            ? "راقب القنوات المتصلة فعليًا، وحالة Webhook، واستقبال الرسائل من مكان واحد."
            : "Monitor real channel connections, webhook health, and recent inbound activity in one place."
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label={isAr ? "Connected Channels" : "Connected Channels"}
          value={data.connectedCount}
          tone="emerald"
          icon={<CheckCircle size={18} />}
        />
        <SummaryCard
          label={isAr ? "Disconnected Channels" : "Disconnected Channels"}
          value={data.disconnectedCount}
          tone="slate"
          icon={<PlugZap size={18} />}
        />
        <SummaryCard
          label={isAr ? "Channels With Issues" : "Channels With Issues"}
          value={data.issueCount}
          tone={data.issueCount ? "red" : "blue"}
          icon={<AlertTriangle size={18} />}
        />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {data.cards.map((channel) => {
          const Icon = channel.icon;
          return (
            <article
              key={channel.type}
              className={`overflow-hidden rounded-md border bg-white shadow-sm transition hover:border-slate-300 dark:bg-slate-950 ${
                channel.connected
                  ? "border-emerald-200 dark:border-emerald-900/60"
                  : channel.hasIssue
                    ? "border-red-200 dark:border-red-900/60"
                    : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className={`h-1.5 ${channel.connected ? "bg-emerald-500" : channel.hasIssue ? "bg-red-500" : "bg-slate-300 dark:bg-slate-700"}`} />
              <div className="flex h-full min-h-72 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${
                    channel.connected
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : channel.hasIssue
                        ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  }`}>
                    <Icon size={21} />
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                    channel.connected
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900"
                      : channel.hasIssue
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900"
                        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
                  }`}>
                    {channel.connected ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {channel.connected ? "Connected" : "Not Connected"}
                  </span>
                </div>

                <div className="mt-4 flex-1">
                  <h2 className="text-lg font-bold text-ink">{channel.title[locale]}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{channel.desc[locale]}</p>
                  <dl className="mt-4 grid gap-2 text-xs">
                    <StatusLine label="Active" value={channel.isActive ? "Active" : "Inactive"} ok={channel.isActive} />
                    <StatusLine label="Connected" value={channel.connected ? "Connected" : "Missing setup"} ok={channel.connected} />
                    <StatusLine label="Receiving Messages" value={`${channel.inbound24h} / 24h`} ok={channel.inbound24h > 0} neutral={!channel.inbound24h && channel.connected} />
                    <StatusLine label="Webhook Status" value={channel.webhookStatus} ok={channel.webhookHealthy} neutral={channel.webhookStatus === "No traffic"} />
                  </dl>
                  <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <RadioTower size={14} />
                      <span>{isAr ? "آخر اتصال" : "Last connection"}: {channel.lastConnectionAt ? formatDate(channel.lastConnectionAt, locale) : "-"}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Activity size={14} />
                      <span>{isAr ? "آخر مزامنة" : "Last sync"}: {channel.lastSyncAt ? formatDate(channel.lastSyncAt, locale) : "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Link href={channel.href} className={channel.connected ? "btn-secondary min-h-11 justify-center" : "btn-primary min-h-11 justify-center"}>
                    <span>{channel.connected ? "Configure" : "Connect Channel"}</span>
                    <ArrowRight size={16} className="rtl:rotate-180" />
                  </Link>
                  {channel.channelId ? (
                    <form action={disconnectChannel}>
                      <input type="hidden" name="type" value={channel.type} />
                      <input type="hidden" name="botId" value={channel.botId} />
                      <button
                        type="submit"
                        className="min-h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        Disconnect
                      </button>
                    </form>
                  ) : (
                    <Link href={channel.href} className="min-h-11 rounded-md border border-slate-200 px-3 text-center text-sm font-bold leading-[2.75rem] text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">
                      Configure
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

async function getChannelsOverview(tenantId: string) {
  await connectToDatabase();
  const tenantMatch = Types.ObjectId.isValid(tenantId) ? new Types.ObjectId(tenantId) : tenantId;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const types = channelDefinitions.map((channel) => channel.type);

  const [channels, conversationCounts, webhookEvents, webhookLogs] = await Promise.all([
    Channel.find({ tenantId }).sort({ updatedAt: -1 }).lean(),
    Conversation.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          tenantId: tenantMatch,
          lastCustomerMessageAt: { $gte: since },
          $or: [{ provider: { $in: types } }, { channel: { $in: types } }]
        }
      },
      { $project: { provider: { $ifNull: ["$provider", "$channel"] } } },
      { $group: { _id: "$provider", count: { $sum: 1 } } }
    ]).catch(() => []),
    WebhookEvent.find({ tenantId }).sort({ receivedAt: -1, createdAt: -1 }).limit(200).lean().catch(() => []),
    WebhookLog.find({ tenantId }).sort({ createdAt: -1 }).limit(200).lean().catch(() => [])
  ]);

  const inboundByType = new Map(conversationCounts.map((item) => [String(item._id), item.count]));
  const eventsByType = groupLatest(webhookEvents, (event: any) => String(event.provider || ""));
  const logsByType = groupLatest(webhookLogs, (log: any) => String(log.channel || ""));

  const cards = channelDefinitions.map((definition, index) => {
    const candidates = channels.filter((channel) => channel.type === definition.type);
    const sorted = [...candidates].sort((a, b) => Number(isChannelConnected(definition.type, b)) - Number(isChannelConnected(definition.type, a)));
    const channel = sorted[0];
    const config = configOf(channel);
    const connected = Boolean(channel && isChannelConnected(definition.type, channel));
    const latestEvent = eventsByType.get(definition.type);
    const latestLog = logsByType.get(definition.type);
    const webhookStatus = latestEvent?.status || latestLog?.status || (connected ? "No traffic" : "Not configured");
    const webhookHealthy = ["processed", "success", "received", "processing", "No traffic"].includes(webhookStatus);
    const hasIssue = Boolean(channel && (!connected || !webhookHealthy));
    const lastEventDate = latestEvent?.receivedAt || latestEvent?.createdAt || latestLog?.createdAt;
    const lastConnectionAt = connected ? (config.webhookSetAt || config.connectedAt || channel?.updatedAt || channel?.createdAt) : "";

    return {
      ...definition,
      order: index,
      channelId: channel?._id?.toString() || "",
      botId: channel?.botId?.toString() || "",
      isActive: Boolean(channel?.isActive),
      connected,
      hasIssue,
      inbound24h: inboundByType.get(definition.type) || 0,
      webhookStatus: formatWebhookStatus(webhookStatus),
      webhookHealthy,
      lastConnectionAt: dateToString(lastConnectionAt),
      lastSyncAt: dateToString(lastEventDate)
    };
  }).sort((a, b) => Number(b.connected) - Number(a.connected) || Number(b.hasIssue) - Number(a.hasIssue) || a.order - b.order);

  return {
    cards,
    connectedCount: cards.filter((card) => card.connected).length,
    disconnectedCount: cards.filter((card) => !card.connected).length,
    issueCount: cards.filter((card) => card.hasIssue).length
  };
}

function isChannelConnected(type: ChannelType, channel: any) {
  if (!channel?.isActive) return false;
  const config = configOf(channel);
  const hasToken = Boolean(config.tokenConfigured || config.botTokenEncrypted || config.accessTokenEncrypted || config.pageAccessTokenEncrypted || config.apiKeyEncrypted);
  const hasPassword = Boolean(config.passwordConfigured || config.smtpPasswordEncrypted);

  if (type === "website") return true;
  if (type === "telegram") return hasToken;
  if (type === "whatsapp") return hasToken && Boolean(config.phoneNumberId || config.oauthProviderAccountId);
  if (type === "facebook") return hasToken && Boolean(config.pageId || config.oauthProviderAccountId);
  if (type === "instagram") return hasToken && Boolean(config.accountId || config.instagramBusinessId || config.oauthProviderAccountId);
  if (type === "email") return hasPassword && Boolean(config.emailAddress && config.smtpHost && config.smtpUser);
  if (type === "api") return hasToken;
  if (type === "webhook") return Boolean(config.signingSecret || config.webhookSecret);
  return false;
}

function configOf(channel: any): Record<string, any> {
  return channel?.config && typeof channel.config === "object" ? channel.config : {};
}

function groupLatest<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}

function dateToString(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatDate(value: string, locale: "en" | "ar") {
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatWebhookStatus(status: string) {
  if (status === "processed" || status === "success") return "Healthy";
  if (status === "received" || status === "processing") return "Receiving";
  if (status === "failed" || status === "error") return "Issue";
  return status;
}

function SummaryCard({
  label,
  value,
  tone,
  icon
}: {
  label: string;
  value: number;
  tone: "emerald" | "slate" | "red" | "blue";
  icon: React.ReactNode;
}) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    slate: "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
  };

  return (
    <article className={`rounded-md border p-4 shadow-sm ${classes[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{label}: {value}</span>
        {icon}
      </div>
    </article>
  );
}

function StatusLine({ label, value, ok, neutral = false }: { label: string; value: string; ok: boolean; neutral?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-2 dark:border-slate-800">
      <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 font-bold ${
        ok ? "text-emerald-700 dark:text-emerald-300" : neutral ? "text-slate-500 dark:text-slate-400" : "text-red-700 dark:text-red-300"
      }`}>
        {ok ? <CheckCircle size={13} /> : neutral ? <RadioTower size={13} /> : <AlertTriangle size={13} />}
        {value}
      </span>
    </div>
  );
}

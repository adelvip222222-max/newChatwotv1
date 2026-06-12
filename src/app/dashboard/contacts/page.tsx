import Link from "next/link";
import { Types } from "mongoose";
import {
  Activity,
  BarChart3,
  Building2,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Tag,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { connectToDatabase } from "@/lib/mongodb";
import { Contact, Conversation, Message } from "@/lib/models";

export const dynamic = "force-dynamic";

const copy = {
  ar: {
    title: "جهات الاتصال",
    desc: "دليل عملاء واضح: بحث سريع، حالة العميل، عدد الرسائل، وطرق التواصل بدون فتح سجل الرسائل.",
    allContacts: "كل جهات الاتصال",
    tenantContacts: "جهة اتصال",
    websiteVisitor: "زائر من الموقع",
    conversation: "محادثة",
    conversations: "محادثات",
    lastSeen: "آخر ظهور",
    messages: "رسائل",
    noContacts: "لا توجد جهات اتصال بعد.",
    chooseContact: "اختر جهة اتصال لعرض بياناتها وتحليلاتها.",
    openInbox: "فتح أحدث محادثة",
    search: "ابحث بالاسم أو الهاتف أو البريد أو الشركة",
    contactProfile: "ملف جهة الاتصال",
    contactMethods: "طرق التواصل",
    compactAnalytics: "تحليلات مختصرة",
    generalStatus: "الحالة العامة",
    totalMessages: "إجمالي الرسائل",
    incomingMessages: "واردة",
    outgoingMessages: "صادرة",
    openThreads: "محادثات مفتوحة",
    channels: "القنوات",
    latestActivity: "آخر نشاط",
    lifecycle: "المرحلة",
    company: "الشركة",
    tags: "الوسوم",
    noContactMethods: "لا توجد طرق تواصل محفوظة بعد.",
    active: "نشط",
    warm: "متفاعل",
    quiet: "هادئ",
    blocked: "محظور",
    unknown: "غير معروف",
  },
  en: {
    title: "Contacts",
    desc: "A clearer customer directory: search, status, message counts, and contact methods without opening the message thread.",
    allContacts: "All contacts",
    tenantContacts: "contacts",
    websiteVisitor: "Website visitor",
    conversation: "conversation",
    conversations: "conversations",
    lastSeen: "Last seen",
    messages: "messages",
    noContacts: "No contacts yet.",
    chooseContact: "Choose a contact to view profile details and analytics.",
    openInbox: "Open latest conversation",
    search: "Search name, phone, email, or company",
    contactProfile: "Contact profile",
    contactMethods: "Contact methods",
    compactAnalytics: "Compact analytics",
    generalStatus: "General status",
    totalMessages: "Total messages",
    incomingMessages: "Incoming",
    outgoingMessages: "Outgoing",
    openThreads: "Open threads",
    channels: "Channels",
    latestActivity: "Latest activity",
    lifecycle: "Lifecycle",
    company: "Company",
    tags: "Tags",
    noContactMethods: "No saved contact methods yet.",
    active: "Active",
    warm: "Warm",
    quiet: "Quiet",
    blocked: "Blocked",
    unknown: "Unknown",
  },
} as const;

type Locale = "en" | "ar";

type ContactMetric = {
  conversationCount: number;
  openConversationCount: number;
  messageCount: number;
  lastMessageAt?: Date | null;
  channels: string[];
};

type SelectedStats = {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
};

function formatDate(value: Date | string | null | undefined, locale: Locale) {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getContactName(contact: Record<string, any>, fallback: string) {
  return contact.name || contact.email || contact.phone || fallback;
}

function getPrimaryContactLine(contact: Record<string, any>, fallback: string) {
  return contact.phone || contact.email || contact.company || fallback;
}

function getStatus(
  contact: Record<string, any>,
  metrics: ContactMetric | undefined,
  labels: (typeof copy)[Locale],
) {
  if (contact.isBlocked) return { label: labels.blocked, tone: "red" };
  if ((metrics?.openConversationCount || 0) > 0)
    return { label: labels.active, tone: "green" };

  const lastSeen = contact.lastSeenAt
    ? new Date(contact.lastSeenAt).getTime()
    : 0;
  const daysSinceSeen = lastSeen
    ? (Date.now() - lastSeen) / 86_400_000
    : Number.POSITIVE_INFINITY;

  if (daysSinceSeen <= 7) return { label: labels.warm, tone: "blue" };
  if (daysSinceSeen < Number.POSITIVE_INFINITY)
    return { label: labels.quiet, tone: "slate" };
  return { label: labels.unknown, tone: "slate" };
}

function statusClass(tone: string) {
  switch (tone) {
    case "green":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900";
    case "blue":
      return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900";
    case "red":
      return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800";
  }
}

function buildContactHref(id: string, q: string) {
  const params = new URLSearchParams({ contactId: id });
  if (q) params.set("q", q);
  return `/dashboard/contacts?${params.toString()}`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Icon size={15} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function InfoPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-300">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-slate-400">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const locale = await getLocale();
  const labels = copy[locale];
  const tenantId = session.user.tenantId;
  const tenantObjectId = new Types.ObjectId(tenantId);
  const q = (params.q || "").trim();

  await connectToDatabase();

  const contactQuery: Record<string, any> = { tenantId };
  if (q) {
    const regex = new RegExp(escapeRegExp(q), "i");
    contactQuery.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { company: regex },
      { tags: regex },
    ];
  }

  const contacts = await Contact.find(contactQuery)
    .sort({ lastSeenAt: -1, updatedAt: -1 })
    .limit(100)
    .lean();

  const selectedContactId =
    params.contactId && Types.ObjectId.isValid(params.contactId)
      ? params.contactId
      : contacts[0]?._id?.toString();

  const selectedContact = selectedContactId
    ? await Contact.findOne({ _id: selectedContactId, tenantId }).lean()
    : null;

  const contactIds = contacts.map((contact) => contact._id);

  const conversationCounts = contactIds.length
    ? await Conversation.aggregate([
        {
          $match: { tenantId: tenantObjectId, contactId: { $in: contactIds } },
        },
        {
          $group: {
            _id: "$contactId",
            conversationCount: { $sum: 1 },
            openConversationCount: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["open", "pending", "snoozed"]] },
                  1,
                  0,
                ],
              },
            },
            lastMessageAt: { $max: "$lastMessageAt" },
            channels: { $addToSet: "$provider" },
          },
        },
      ])
    : [];

  const messageCounts = contactIds.length
    ? await Message.aggregate([
        {
          $match: { tenantId: tenantObjectId, contactId: { $in: contactIds } },
        },
        { $group: { _id: "$contactId", messageCount: { $sum: 1 } } },
      ])
    : [];

  const metricsByContact = new Map<string, ContactMetric>();
  for (const item of conversationCounts) {
    metricsByContact.set(item._id.toString(), {
      conversationCount: item.conversationCount || 0,
      openConversationCount: item.openConversationCount || 0,
      messageCount: 0,
      lastMessageAt: item.lastMessageAt,
      channels: (item.channels || []).filter(Boolean),
    });
  }
  for (const item of messageCounts) {
    const id = item._id.toString();
    const existing = metricsByContact.get(id) || {
      conversationCount: 0,
      openConversationCount: 0,
      messageCount: 0,
      channels: [],
    };
    existing.messageCount = item.messageCount || 0;
    metricsByContact.set(id, existing);
  }

  const selectedConversations = selectedContact
    ? await Conversation.find({ tenantId, contactId: selectedContact._id })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean()
    : [];

  const latestConversationId = selectedConversations[0]?._id?.toString() || "";
  const selectedContactObjectId = selectedContact?._id;
  const selectedStatsResult = selectedContactObjectId
    ? await Message.aggregate([
        {
          $match: {
            tenantId: tenantObjectId,
            contactId: selectedContactObjectId,
          },
        },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            incomingMessages: {
              $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] },
            },
            outgoingMessages: {
              $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] },
            },
          },
        },
      ])
    : [];

  const selectedStats: SelectedStats = selectedStatsResult[0] || {
    totalMessages: 0,
    incomingMessages: 0,
    outgoingMessages: 0,
  };

  const selectedMetrics = selectedContact
    ? metricsByContact.get(selectedContact._id.toString()) || {
        conversationCount: selectedConversations.length,
        openConversationCount: selectedConversations.filter((conversation) =>
          ["open", "pending", "snoozed"].includes(String(conversation.status)),
        ).length,
        messageCount: selectedStats.totalMessages,
        lastMessageAt: selectedConversations[0]?.lastMessageAt,
        channels: selectedConversations
          .map((conversation) =>
            String(conversation.provider || conversation.channel),
          )
          .filter(Boolean),
      }
    : null;

  const selectedStatus = selectedContact
    ? getStatus(selectedContact, selectedMetrics || undefined, labels)
    : null;

  return (
    <>
      <PageHeader title={labels.title} description={labels.desc} />

      <section className="min-h-[calc(100vh-180px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="border-slate-200 dark:border-slate-800 lg:border-e">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  {labels.allContacts}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {contacts.length} {labels.tenantContacts}
                </p>
              </div>
            </div>

            <form action="/dashboard/contacts" className="mt-4">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 dark:border-slate-800 dark:bg-slate-900">
                <Search size={16} className="text-slate-400" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder={labels.search}
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </form>
          </div>

          <div className="max-h-[calc(100vh-255px)] overflow-y-auto p-3">
            {contacts.length ? (
              contacts.map((contact) => {
                const id = contact._id.toString();
                const metrics = metricsByContact.get(id);
                const isActive = selectedContact?._id?.toString() === id;
                const status = getStatus(contact, metrics, labels);

                return (
                  <Link
                    key={id}
                    href={buildContactHref(id, q)}
                    className={`mb-2 block rounded-2xl border px-3 py-3 transition ${
                      isActive
                        ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                        : "border-transparent bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <UserRound size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {getContactName(contact, labels.websiteVisitor)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {getPrimaryContactLine(
                                contact,
                                labels.websiteVisitor,
                              )}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusClass(status.tone)}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="rounded-xl bg-slate-50 px-2 py-1 dark:bg-slate-900">
                            <b className="text-ink">
                              {metrics?.messageCount || 0}
                            </b>{" "}
                            {labels.messages}
                          </span>
                          <span className="rounded-xl bg-slate-50 px-2 py-1 dark:bg-slate-900">
                            <b className="text-ink">
                              {metrics?.conversationCount || 0}
                            </b>{" "}
                            {labels.conversations}
                          </span>
                          <span className="truncate rounded-xl bg-slate-50 px-2 py-1 dark:bg-slate-900">
                            {formatDate(
                              metrics?.lastMessageAt || contact.lastSeenAt,
                              locale,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {labels.noContacts}
              </div>
            )}
          </div>
        </aside>

        <main className="min-h-[620px] bg-slate-50/70 p-4 dark:bg-slate-900/30 lg:p-6">
          {selectedContact && selectedMetrics && selectedStatus ? (
            <div className="mx-auto max-w-5xl space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <UserRound size={28} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                        {labels.contactProfile}
                      </p>
                      <h2 className="mt-2 truncate text-2xl font-bold text-ink">
                        {getContactName(selectedContact, labels.websiteVisitor)}
                      </h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(selectedStatus.tone)}`}
                        >
                          {labels.generalStatus}: {selectedStatus.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          {labels.lifecycle}:{" "}
                          {selectedContact.lifecycleStage || "lead"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {latestConversationId ? (
                    <Link
                      href={`/dashboard/conversations?conversationId=${latestConversationId}`}
                      className="btn-primary inline-flex rounded-full px-4 py-2 text-sm"
                    >
                      <MessageCircle size={16} />
                      {labels.openInbox}
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={MessageCircle}
                  label={labels.totalMessages}
                  value={selectedStats.totalMessages}
                />
                <MetricCard
                  icon={Activity}
                  label={labels.incomingMessages}
                  value={selectedStats.incomingMessages}
                />
                <MetricCard
                  icon={BarChart3}
                  label={labels.outgoingMessages}
                  value={selectedStats.outgoingMessages}
                />
                <MetricCard
                  icon={ShieldCheck}
                  label={labels.openThreads}
                  value={selectedMetrics.openConversationCount}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="text-base font-bold text-ink">
                    {labels.contactMethods}
                  </h3>
                  <div className="mt-4 space-y-3">
                    {selectedContact.phone ? (
                      <InfoPill
                        icon={Phone}
                        label="Phone"
                        value={selectedContact.phone}
                      />
                    ) : null}
                    {selectedContact.email ? (
                      <InfoPill
                        icon={Mail}
                        label="Email"
                        value={selectedContact.email}
                      />
                    ) : null}
                    {selectedContact.company ? (
                      <InfoPill
                        icon={Building2}
                        label={labels.company}
                        value={selectedContact.company}
                      />
                    ) : null}
                    {!selectedContact.phone &&
                    !selectedContact.email &&
                    !selectedContact.company ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        {labels.noContactMethods}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="text-base font-bold text-ink">
                    {labels.compactAnalytics}
                  </h3>
                  <div className="mt-4 space-y-3">
                    <InfoPill
                      icon={Clock3}
                      label={labels.latestActivity}
                      value={formatDate(
                        selectedMetrics.lastMessageAt ||
                          selectedContact.lastSeenAt,
                        locale,
                      )}
                    />
                    <InfoPill
                      icon={MessageCircle}
                      label={labels.conversations}
                      value={String(selectedMetrics.conversationCount)}
                    />
                    <InfoPill
                      icon={Activity}
                      label={labels.channels}
                      value={
                        selectedMetrics.channels.length
                          ? selectedMetrics.channels.join(", ")
                          : "-"
                      }
                    />
                    {selectedContact.tags?.length ? (
                      <InfoPill
                        icon={Tag}
                        label={labels.tags}
                        value={selectedContact.tags.join(", ")}
                      />
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[500px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              {labels.chooseContact}
            </div>
          )}
        </main>
      </section>
    </>
  );
}

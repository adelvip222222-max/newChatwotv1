"use client";

import {
  ArrowLeft,
  Filter,
  Paperclip,
  RefreshCw,
  Search,
  SendHorizonal,
  Smile,
  UserRound,
  X,
  FileText,
  MessageCircle,
  Phone,
  Mail,
  Building2,
  Clock3,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ConversationItem = {
  id: string;
  channel: string;
  provider: string;
  status: string;
  mode: string;
  priority: string;
  unreadCount: number;
  externalUserId: string;
  externalThreadId: string;
  lastMessageAt: string;
  lastMessage: string;
  lastMessageDirection: string;
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    avatarUrl: string;
  };
};

type ConversationListPayload = {
  items: ConversationItem[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
};

type MessageItem = {
  id: string;
  content: string;
  direction: string;
  sender: string;
  deliveryStatus: string;
  provider: string;
  createdAt: string;
  attachments: Array<{
    id: string;
    type: string;
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }>;
};

type AttachmentDraft = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  type: "image" | "pdf" | "file";
  url: string;
};

const EMOJIS = ["🙂", "👍", "🙏", "🔥", "✅", "📎"];

const copy = {
  ar: {
    inbox: "المحادثات",
    search: "ابحث بالاسم أو الرقم أو آخر رسالة",
    all: "الكل",
    unread: "غير المقروءة",
    ai: "AI",
    human: "بشري",
    urgent: "عاجلة",
    openConversation: "فتح المحادثة",
    noConversations: "لا توجد محادثات تطابق الفلاتر الحالية.",
    pullToRefresh: "اسحب للتحديث",
    refreshing: "جار التحديث...",
    typeMessage: "اكتب ردك هنا...",
    online: "نشط الآن",
    recentlyActive: "نشط مؤخرًا",
    chooseConversation: "اختر محادثة لعرض التفاصيل",
    attach: "إرفاق ملف",
    attachments: "المرفقات",
    send: "إرسال",
    resolve: "إغلاق",
    composerHint: "Enter للإرسال",
    newConversation: "محادثة جديدة",
    statusOpen: "مفتوحة",
    statusClosed: "مغلقة",
    badgeAi: "AI",
    badgeHuman: "Human",
    attachmentPreview: "معاينة المرفق",
    profile: "ملف العميل",
    contactMethods: "طرق التواصل",
    conversationStats: "ملخص المحادثة",
    channel: "القناة",
    latest: "آخر نشاط",
    unreadMessages: "غير مقروءة",
    messages: "رسائل",
    websiteVisitor: "زائر من الموقع",
    noContactData: "لا توجد بيانات تواصل محفوظة",
  },
  en: {
    inbox: "Conversations",
    search: "Search by name, number, or latest message",
    all: "All",
    unread: "Unread",
    ai: "AI",
    human: "Human",
    urgent: "Urgent",
    openConversation: "Open conversation",
    noConversations: "No conversations match the current filters.",
    pullToRefresh: "Pull to refresh",
    refreshing: "Refreshing...",
    typeMessage: "Type your reply...",
    online: "Online",
    recentlyActive: "Recently active",
    chooseConversation: "Select a conversation to view details",
    attach: "Attach file",
    attachments: "Attachments",
    send: "Send",
    resolve: "Resolve",
    composerHint: "Press Enter to send",
    newConversation: "New conversation",
    statusOpen: "Open",
    statusClosed: "Closed",
    badgeAi: "AI",
    badgeHuman: "Human",
    attachmentPreview: "Attachment preview",
    profile: "Customer profile",
    contactMethods: "Contact methods",
    conversationStats: "Conversation summary",
    channel: "Channel",
    latest: "Latest activity",
    unreadMessages: "Unread",
    messages: "Messages",
    websiteVisitor: "Website visitor",
    noContactData: "No saved contact methods",
  },
} as const;

function formatConversationTime(value: string, locale: "en" | "ar") {
  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) return locale === "ar" ? "الآن" : "now";
  if (diffMinutes < 60) return `${diffMinutes}${locale === "ar" ? "د" : "m"}`;

  return date.toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageTime(value: string, locale: "en" | "ar") {
  return new Date(value).toLocaleTimeString(
    locale === "ar" ? "ar-EG" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function getAttachmentType(file: File): "image" | "pdf" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "file";
}

function isImageAttachment(mimeType: string, type: string) {
  return type === "image" || mimeType.startsWith("image/");
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getContactName(
  conversation: ConversationItem | null | undefined,
  fallback: string,
) {
  const contact = conversation?.contact;
  return (
    contact?.name ||
    contact?.phone ||
    contact?.email ||
    conversation?.externalUserId ||
    fallback
  );
}

function getContactSubtitle(conversation: ConversationItem | null | undefined) {
  const contact = conversation?.contact;
  return (
    contact?.company ||
    contact?.phone ||
    contact?.email ||
    conversation?.provider ||
    ""
  );
}

function latestPersistedMessageTimestamp(messages: MessageItem[]) {
  return messages.reduce<string>((latest, message) => {
    if (message.id.startsWith("temp-")) return latest;
    const timestamp = new Date(message.createdAt).getTime();
    if (Number.isNaN(timestamp)) return latest;
    if (!latest || timestamp > new Date(latest).getTime())
      return message.createdAt;
    return latest;
  }, "");
}

function mergeMessages(current: MessageItem[], incoming: MessageItem[]) {
  if (!incoming.length) return current;

  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export default function InboxClientUI({
  locale,
  initialConversations,
  initialConversation,
  initialMessages,
  requestedConversationId,
}: {
  locale: "en" | "ar";
  initialConversations: ConversationListPayload;
  initialConversation: Partial<ConversationItem> | null;
  initialMessages: MessageItem[];
  requestedConversationId: string;
}) {
  const router = useRouter();
  const labels = copy[locale];
  const [isMobile, setIsMobile] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>(
    initialConversations.items,
  );
  const [hasMore, setHasMore] = useState(initialConversations.hasMore);
  const [nextOffset, setNextOffset] = useState(initialConversations.nextOffset);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unread" | "ai" | "human" | "urgent"
  >("all");
  const deferredSearch = useDeferredValue(search);
  const [activeConversation, setActiveConversation] =
    useState<ConversationItem | null>(
      requestedConversationId
        ? (initialConversation as ConversationItem | null)
        : initialConversations.items[0] || null,
    );
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [messageInput, setMessageInput] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<AttachmentDraft[]>(
    [],
  );
  const [sending, setSending] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [listError, setListError] = useState("");
  const [pullDistance, setPullDistance] = useState(0);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(
    Boolean(requestedConversationId),
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesStateRef = useRef<MessageItem[]>(initialMessages);
  const activeConversationIdRef = useRef(activeConversation?.id || "");
  const incrementalMessageRefreshInFlightRef = useRef(false);

  const activeConversationId = activeConversation?.id || "";

  useEffect(() => {
    messagesStateRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();

    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isMobile && !requestedConversationId) {
      setShowThreadOnMobile(false);
    }
  }, [isMobile, requestedConversationId]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, activeConversationId]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
  }, [messageInput]);

  const fetchConversations = useCallback(
    async (options: { reset?: boolean; offset?: number } = {}) => {
      const reset = options.reset ?? false;
      const offset = reset ? 0 : (options.offset ?? nextOffset);

      if (!reset) {
        setLoadingMore(true);
      } else {
        setRefreshing(true);
      }

      const params = new URLSearchParams({
        limit: "20",
        offset: String(offset),
        q: deferredSearch,
        status: "all",
        mode: filter === "ai" ? "ai" : filter === "human" ? "human" : "all",
        priority: filter === "urgent" ? "urgent" : "all",
        unread: filter === "unread" ? "1" : "0",
      });

      try {
        const response = await fetch(
          `/api/conversations?${params.toString()}`,
          { cache: "no-store" },
        );
        const data: ConversationListPayload = await response.json();
        if (!response.ok) throw new Error("Unable to load conversations");

        setConversations((current) =>
          reset ? data.items : [...current, ...data.items],
        );
        setHasMore(data.hasMore);
        setNextOffset(data.nextOffset);
        setListError("");

        if (reset && !requestedConversationId && !isMobile) {
          setActiveConversation(data.items[0] || null);
        }
      } catch (error) {
        console.error(error);
        setListError("Could not refresh conversations");
      } finally {
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [deferredSearch, filter, nextOffset, requestedConversationId, isMobile],
  );

  useEffect(() => {
    fetchConversations({ reset: true });
  }, [fetchConversations]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loadingMore &&
          !refreshing
        ) {
          fetchConversations();
        }
      },
      { root: listRef.current, threshold: 0.3 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchConversations, hasMore, loadingMore, refreshing]);

  const refreshMessages = useCallback(
    async (conversationId: string, options: { incremental?: boolean } = {}) => {
      if (options.incremental && incrementalMessageRefreshInFlightRef.current)
        return;
      if (options.incremental)
        incrementalMessageRefreshInFlightRef.current = true;

      try {
        const params = new URLSearchParams({
          limit: options.incremental ? "250" : "120",
        });
        if (options.incremental) {
          const since = latestPersistedMessageTimestamp(
            messagesStateRef.current,
          );
          if (since) params.set("since", since);
        }

        const response = await fetch(
          `/api/conversations/${conversationId}/messages?${params.toString()}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to refresh messages");
        if (activeConversationIdRef.current !== conversationId) return;

        const incoming = data.messages || [];
        if (options.incremental) {
          setMessages((current) => mergeMessages(current, incoming));
        } else {
          setMessages(incoming);
        }
      } finally {
        if (options.incremental)
          incrementalMessageRefreshInFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchConversations({ reset: true });
    }, 60_000);

    const handleIncoming = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId: string }>;
      if (customEvent.detail?.conversationId === activeConversationId) {
        void refreshMessages(activeConversationId, { incremental: true });
      }
      void fetchConversations({ reset: true });
    };

    window.addEventListener("chatzi:incoming-message", handleIncoming);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("chatzi:incoming-message", handleIncoming);
    };
  }, [activeConversationId, fetchConversations, refreshMessages]);

  useEffect(() => {
    if (!activeConversationId) return;

    const interval = window.setInterval(() => {
      void refreshMessages(activeConversationId, { incremental: true });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [activeConversationId, refreshMessages]);

  const selectConversation = async (conversation: ConversationItem) => {
    activeConversationIdRef.current = conversation.id;
    incrementalMessageRefreshInFlightRef.current = false;
    setActiveConversation(conversation);
    setShowThreadOnMobile(true);
    startTransition(() => {
      router.replace(
        `/dashboard/conversations?conversationId=${conversation.id}`,
        { scroll: false },
      );
    });

    try {
      await refreshMessages(conversation.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleBackToList = () => {
    setShowThreadOnMobile(false);
    startTransition(() => {
      router.replace("/dashboard/conversations", { scroll: false });
    });
  };

  const handlePullStart = (clientY: number) => {
    if (listRef.current?.scrollTop === 0) {
      touchStartY.current = clientY;
    }
  };

  const handlePullMove = (clientY: number) => {
    if (touchStartY.current === null) return;
    const distance = Math.max(0, Math.min(clientY - touchStartY.current, 90));
    setPullDistance(distance);
  };

  const handlePullEnd = () => {
    if (pullDistance > 60) {
      void fetchConversations({ reset: true });
    }
    touchStartY.current = null;
    setPullDistance(0);
  };

  const prepareAttachments = async (files: FileList | null) => {
    if (!files?.length) return;

    const nextAttachments = await Promise.all(
      Array.from(files)
        .slice(0, 4)
        .map(async (file) => ({
          id: `${file.name}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          type: getAttachmentType(file),
          url: await fileToDataUrl(file),
        })),
    );

    setDraftAttachments((current) => [...current, ...nextAttachments]);
  };

  const sendMessage = async () => {
    if (!activeConversationId || sending) return;
    if (!messageInput.trim() && !draftAttachments.length) return;

    const optimisticMessage: MessageItem = {
      id: `temp-${Date.now()}`,
      content: messageInput.trim(),
      direction: "outgoing",
      sender: "agent",
      deliveryStatus: "queued",
      provider: activeConversation?.provider || "website",
      createdAt: new Date().toISOString(),
      attachments: draftAttachments.map((attachment) => ({
        id: attachment.id,
        type: attachment.type,
        url: attachment.url,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
      })),
    };

    setMessages((current) => [...current, optimisticMessage]);
    setMessageInput("");
    setDraftAttachments([]);
    setSending(true);

    try {
      const response = await fetch(
        `/api/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: optimisticMessage.content || "Attachment",
            attachments: optimisticMessage.attachments,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send message");
      await refreshMessages(activeConversationId);
      await fetchConversations({ reset: true });
    } catch (error) {
      console.error(error);
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
    } finally {
      setSending(false);
    }
  };

  const activeStatusLabel =
    activeConversation?.status === "closed"
      ? labels.statusClosed
      : labels.statusOpen;
  const showListPane = !isMobile || !showThreadOnMobile;
  const showThreadPane = !isMobile || showThreadOnMobile;

  const activeContactName = getContactName(
    activeConversation,
    labels.chooseConversation,
  );
  const activeContactSubtitle = getContactSubtitle(activeConversation);
  const activeContactMethods = activeConversation
    ? ([
        activeConversation.contact.phone
          ? { icon: Phone, label: activeConversation.contact.phone }
          : null,
        activeConversation.contact.email
          ? { icon: Mail, label: activeConversation.contact.email }
          : null,
        activeConversation.contact.company
          ? { icon: Building2, label: activeConversation.contact.company }
          : null,
      ].filter(Boolean) as Array<{ icon: typeof Phone; label: string }>)
    : [];

  const filterOptions = useMemo(
    () => [
      { id: "all", label: labels.all },
      { id: "unread", label: labels.unread },
      { id: "ai", label: labels.ai },
      { id: "human", label: labels.human },
      { id: "urgent", label: labels.urgent },
    ],
    [labels],
  );

  return (
    <div className="grid h-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[22rem_minmax(0,1fr)_18rem]">
      {showListPane ? (
        <aside className="flex min-h-0 flex-col border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:border-e">
          <div className="safe-top sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-ink">{labels.inbox}</h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {conversations.length} {labels.all}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchConversations({ reset: true })}
                className="touch-target rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                aria-label={labels.refreshing}
              >
                <RefreshCw size={16} className="mx-auto" />
              </button>
            </div>

            <div className="mt-4 rounded-full border border-slate-200 bg-slate-100 px-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={labels.search}
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id as typeof filter)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === option.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {option.id !== "all" ? <Filter size={14} /> : null}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto overscroll-y-contain"
            onTouchStart={(event) =>
              handlePullStart(event.touches[0]?.clientY || 0)
            }
            onTouchMove={(event) =>
              handlePullMove(event.touches[0]?.clientY || 0)
            }
            onTouchEnd={handlePullEnd}
          >
            <div
              className="flex items-center justify-center text-xs font-semibold text-slate-400 transition-all"
              style={{ height: pullDistance ? `${pullDistance}px` : "0px" }}
            >
              {refreshing ? labels.refreshing : labels.pullToRefresh}
            </div>

            <div className="space-y-2 p-3">
              {conversations.map((conversation) => {
                const active =
                  conversation.id === activeConversationId &&
                  showThreadOnMobile;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation)}
                    className={`w-full rounded-2xl border px-3 py-3 text-start transition ${
                      active
                        ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                        : "border-transparent bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <UserRound size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {getContactName(
                                conversation,
                                labels.websiteVisitor ||
                                  conversation.externalUserId,
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {getContactSubtitle(conversation)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {formatConversationTime(
                              conversation.lastMessageAt,
                              locale,
                            )}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                          {conversation.lastMessage ||
                            conversation.externalUserId}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {conversation.unreadCount > 0 ? (
                            <span className="badge-info">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                          <span
                            className={
                              conversation.mode === "ai"
                                ? "badge-success"
                                : "badge-warning"
                            }
                          >
                            {conversation.mode === "ai"
                              ? labels.badgeAi
                              : labels.badgeHuman}
                          </span>
                          {conversation.priority !== "medium" &&
                          conversation.priority !== "low" ? (
                            <span className="badge-error">
                              {conversation.priority}
                            </span>
                          ) : null}
                          <span className="badge-neutral uppercase">
                            {conversation.provider}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!conversations.length ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {labels.noConversations}
                </div>
              ) : null}

              {listError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  {listError}
                </div>
              ) : null}

              <div ref={sentinelRef} className="h-8" />
              {loadingMore ? (
                <div className="pb-6 text-center text-xs text-slate-400">
                  {labels.refreshing}
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      ) : null}

      {showThreadPane ? (
        <section className="flex min-h-0 flex-col bg-white dark:bg-slate-950">
          {activeConversation ? (
            <>
              <header className="safe-top sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <div className="flex items-center gap-3">
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={handleBackToList}
                      className="touch-target rounded-2xl border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      aria-label={labels.openConversation}
                    >
                      <ArrowLeft size={18} className="mx-auto rtl:rotate-180" />
                    </button>
                  ) : null}

                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    <UserRound size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-ink">
                        {activeContactName}
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {activeConversation.mode === "ai"
                          ? labels.badgeAi
                          : labels.badgeHuman}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {activeContactSubtitle || activeConversation.provider} ·{" "}
                      {Date.now() -
                        new Date(activeConversation.lastMessageAt).getTime() <
                      5 * 60 * 1000
                        ? labels.online
                        : labels.recentlyActive}
                    </p>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="badge-neutral">{activeStatusLabel}</span>
                    <button className="btn-secondary px-3 py-2">
                      {labels.resolve}
                    </button>
                  </div>
                </div>
              </header>

              <div
                ref={messagesRef}
                className="flex-1 overflow-y-auto bg-slate-50/70 px-3 py-4 dark:bg-slate-900/30 sm:px-5"
              >
                <div className="mx-auto flex max-w-4xl flex-col gap-3">
                  {messages.map((message) => {
                    const outgoing = message.direction === "outgoing";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${
                            outgoing
                              ? "rounded-br-md bg-blue-600 text-white"
                              : "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-800"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {message.content}
                          </p>

                          {message.attachments.length ? (
                            <div className="mt-3 space-y-2">
                              {message.attachments.map((attachment) => (
                                <AttachmentPreview
                                  key={attachment.id}
                                  attachment={attachment}
                                  outgoing={outgoing}
                                  locale={locale}
                                  previewLabel={labels.attachmentPreview}
                                />
                              ))}
                            </div>
                          ) : null}

                          <div
                            className={`mt-3 flex items-center justify-end gap-2 text-[11px] ${outgoing ? "text-blue-100" : "text-slate-400"}`}
                          >
                            <span>
                              {formatMessageTime(message.createdAt, locale)}
                            </span>
                            <span>{message.deliveryStatus}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="safe-bottom sticky bottom-0 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-5">
                <div className="mx-auto max-w-4xl">
                  {draftAttachments.length ? (
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {draftAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="relative min-w-[88px] rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setDraftAttachments((current) =>
                                current.filter(
                                  (item) => item.id !== attachment.id,
                                ),
                              )
                            }
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white"
                          >
                            <X size={12} />
                          </button>
                          {attachment.type === "image" ? (
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="h-16 w-20 rounded-xl object-cover"
                            />
                          ) : attachment.type === "pdf" ? (
                            <div className="flex h-16 w-20 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300">
                              <FileText size={18} />
                            </div>
                          ) : (
                            <div className="flex h-16 w-20 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              <Paperclip size={18} />
                            </div>
                          )}
                          <p className="mt-2 max-w-[80px] truncate text-xs text-slate-500 dark:text-slate-400">
                            {attachment.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {showEmojiBar ? (
                    <div className="mb-3 flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-2 no-scrollbar dark:bg-slate-900">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() =>
                            setMessageInput((current) => `${current}${emoji}`)
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-sm dark:bg-slate-800"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-end gap-2">
                      <label className="touch-target flex shrink-0 cursor-pointer items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(event) =>
                            void prepareAttachments(event.target.files)
                          }
                        />
                        <Paperclip size={18} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEmojiBar((value) => !value)}
                        className="touch-target flex shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Emoji"
                      >
                        <Smile size={18} />
                      </button>
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        value={messageInput}
                        onChange={(event) =>
                          setMessageInput(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        placeholder={labels.typeMessage}
                        className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={
                          sending ||
                          (!messageInput.trim() && !draftAttachments.length)
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50"
                      >
                        <SendHorizonal size={18} className="rtl:rotate-180" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-400">
                    <span>{labels.composerHint}</span>
                    <span>
                      {labels.attachments}: {draftAttachments.length}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {labels.chooseConversation}
            </div>
          )}
        </section>
      ) : null}

      <aside className="hidden min-h-0 flex-col border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:flex lg:border-s">
        {activeConversation ? (
          <div className="flex h-full flex-col overflow-y-auto p-5">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <UserRound size={30} />
              </div>
              <h3 className="mt-3 truncate text-lg font-bold text-ink">
                {activeContactName}
              </h3>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {activeContactSubtitle || activeConversation.externalUserId}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-900">
                <MessageCircle
                  size={15}
                  className="mx-auto mb-1 text-slate-400"
                />
                <p className="text-lg font-bold text-ink">{messages.length}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {labels.messages}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-900">
                <p className="text-lg font-bold text-ink">
                  {activeConversation.unreadCount}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {labels.unreadMessages}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                {labels.contactMethods}
              </p>
              {activeContactMethods.length ? (
                activeContactMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <div
                      key={method.label}
                      className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Icon size={15} className="shrink-0 text-slate-400" />
                      <span className="truncate">{method.label}</span>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {labels.noContactData}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                {labels.conversationStats}
              </p>
              <InfoRow
                icon={ShieldCheck}
                label={labels.statusOpen}
                value={activeStatusLabel}
              />
              <InfoRow
                icon={Sparkles}
                label={labels.channel}
                value={
                  activeConversation.provider || activeConversation.channel
                }
              />
              <InfoRow
                icon={Clock3}
                label={labels.latest}
                value={formatConversationTime(
                  activeConversation.lastMessageAt,
                  locale,
                )}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-5 text-center text-sm text-slate-500 dark:text-slate-400">
            {labels.chooseConversation}
          </div>
        )}
      </aside>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-300">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-slate-400">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  outgoing,
  locale,
  previewLabel,
}: {
  attachment: MessageItem["attachments"][number];
  outgoing: boolean;
  locale: "en" | "ar";
  previewLabel: string;
}) {
  const wrapperClass = outgoing
    ? "border border-white/10 bg-white/10 text-white"
    : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200";

  if (
    isImageAttachment(attachment.mimeType, attachment.type) &&
    attachment.url
  ) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className={`block overflow-hidden rounded-2xl ${wrapperClass}`}
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-64 w-full object-cover"
        />
        <div className="px-3 py-2 text-xs">
          {attachment.name || previewLabel}
        </div>
      </a>
    );
  }

  if (
    (attachment.mimeType === "application/pdf" || attachment.type === "pdf") &&
    attachment.url
  ) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${wrapperClass}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <FileText size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {attachment.name || "PDF"}
          </span>
          <span className="mt-1 block text-xs opacity-70">
            {locale === "ar" ? "فتح ملف PDF" : "Open PDF preview"}
          </span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={attachment.url || "#"}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${wrapperClass}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/60 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {attachment.name}
        </span>
        <span className="mt-1 block text-xs opacity-70">{previewLabel}</span>
      </span>
    </a>
  );
}

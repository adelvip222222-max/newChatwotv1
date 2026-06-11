"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Bell, Bot, CheckCircle2, Globe, Mail, MessageCircle, Send, Smartphone, UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type NotificationMessage = {
  id: string;
  conversationId: string;
  provider: string;
  contact: { name: string; email?: string; phone?: string };
  content: string;
  direction: string;
  sender: string;
  status: string;
  createdAt: string;
};

type RealtimeNotificationPayload = {
  message?: {
    id?: string;
    conversationId?: string;
    provider?: string;
    content?: string;
    direction?: string;
    sender?: string;
    deliveryStatus?: string;
    createdAt?: string;
  };
  conversation?: { id?: string };
  contact?: { name?: string; email?: string; phone?: string };
};

function parseRealtimeNotification(raw: string): NotificationMessage | null {
  try {
    const payload = JSON.parse(raw) as RealtimeNotificationPayload;
    const message = payload.message || {};
    const conversationId = message.conversationId || payload.conversation?.id || "";
    const id = message.id || `${conversationId}-${message.createdAt || Date.now()}`;
    if (!conversationId || message.direction === "outgoing") return null;

    return {
      id,
      conversationId,
      provider: message.provider || "website",
      contact: {
        name: payload.contact?.name || payload.contact?.email || payload.contact?.phone || "Customer",
        email: payload.contact?.email || "",
        phone: payload.contact?.phone || "",
      },
      content: message.content || "",
      direction: message.direction || "incoming",
      sender: message.sender || "user",
      status: message.deliveryStatus || "delivered",
      createdAt: message.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}


const providerIcons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  website: Globe,
  telegram: Send,
  whatsapp: Smartphone,
  facebook: MessageCircle,
  instagram: MessageCircle,
  email: Mail,
  api: Bot,
  webhook: Bot
};

function formatDate(value: string, locale: "en" | "ar") {
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function NotificationsMenu() {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSeenAt, setLastSeenAt] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastSeenAt(localStorage.getItem("notifications_last_seen") || "");
    }
  }, []);

  async function loadMessages() {
    try {
      const response = await fetch("/api/notifications/messages", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setMessages(data.messages || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();

    const handleRealtimeMessage = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; payload?: unknown }>).detail;
      if (!detail || !["message.created", "notification.created"].includes(detail.type || "")) return;
      const message = parseRealtimeNotification(JSON.stringify(detail.payload || {}));
      if (!message) return;
      setMessages((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        byId.set(message.id, message);
        return Array.from(byId.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12);
      });
      setLoading(false);
    };

    window.addEventListener("chatzi:realtime-event", handleRealtimeMessage);
    const interval = window.setInterval(loadMessages, 60_000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("chatzi:realtime-event", handleRealtimeMessage);
    };
  }, []);

  function handleOpen() {
    setOpen((value) => {
      if (!value) {
        const now = new Date().toISOString();
        setLastSeenAt(now);
        if (typeof window !== "undefined") {
          localStorage.setItem("notifications_last_seen", now);
        }
      }
      return !value;
    });
  }

  const unreadCount = messages.filter(
    (message) => message.direction === "incoming" && (!lastSeenAt || message.createdAt > lastSeenAt)
  ).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        aria-label={isAr ? "الإشعارات" : "Notifications"}
        title={isAr ? "الإشعارات" : "Notifications"}
      >
        <Bell size={18} />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className={`absolute top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 ${isAr ? "left-0" : "right-0"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-bold text-ink">{isAr ? "أحدث الرسائل" : "Latest messages"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? "تحديث لحظي مع مزامنة احتياطية" : "Realtime with fallback sync"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={12} />
              {isAr ? "مباشر" : "Live"}
            </span>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {isAr ? "جار تحميل الإشعارات..." : "Loading notifications..."}
              </div>
            ) : messages.length ? (
              messages.map((message) => {
                const Icon = providerIcons[message.provider] || MessageCircle;
                const isIncoming = message.direction === "incoming";

                return (
                  <Link
                    key={message.id}
                    href={message.conversationId ? `/dashboard/conversations?conversationId=${message.conversationId}` : "/dashboard/contacts"}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                      isIncoming
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-ink">
                          <UserRound size={13} className="shrink-0 text-slate-400" />
                          <span className="truncate">{message.contact.name}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">{formatDate(message.createdAt, locale)}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{message.content}</span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {message.provider}
                        </span>
                        <span className={isIncoming ? "text-blue-600 dark:text-blue-300" : "text-emerald-600 dark:text-emerald-300"}>
                          {isIncoming ? (isAr ? "واردة" : "Incoming") : message.status}
                        </span>
                      </span>
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {isAr ? "لا توجد رسائل حديثة." : "No recent messages."}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

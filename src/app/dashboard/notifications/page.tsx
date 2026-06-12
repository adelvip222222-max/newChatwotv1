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

export default function NotificationsPage() {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const [messages, setMessages] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(true);

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
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const unreadCount = messages.filter((message) => message.direction === "incoming").length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            <Bell className="text-indigo-600" />
            {isAr ? "الإشعارات" : "Notifications"}
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr ? "تحديث لحظي مع مزامنة احتياطية" : "Realtime with fallback sync"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={14} />
          {isAr ? "مباشر" : "Live"}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {isAr ? "جار تحميل الإشعارات..." : "Loading notifications..."}
          </div>
        ) : messages.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {messages.map((message) => {
              const Icon = providerIcons[message.provider] || MessageCircle;
              const isIncoming = message.direction === "incoming";

              return (
                <Link
                  key={message.id}
                  href={message.conversationId ? `/dashboard/conversations?conversationId=${message.conversationId}` : "/dashboard/contacts"}
                  className="flex gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
                >
                  <span className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isIncoming
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
                        <UserRound size={14} className="shrink-0 text-slate-400" />
                        <span className="truncate">{message.contact.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{formatDate(message.createdAt, locale)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                      {message.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {message.provider}
                      </span>
                      <span className={`font-medium ${isIncoming ? "text-blue-600 dark:text-blue-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                        {isIncoming ? (isAr ? "واردة" : "Incoming") : message.status}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500">
            {isAr ? "لا توجد رسائل حديثة." : "No recent messages."}
          </div>
        )}
      </div>
    </div>
  );
}

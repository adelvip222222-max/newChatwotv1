"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type LiveMessage = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  direction: string;
  provider: string;
  contact: {
    name: string;
  };
};

type RealtimeMessagePayload = {
  message?: {
    id?: string;
    conversationId?: string;
    content?: string;
    createdAt?: string;
    direction?: string;
    provider?: string;
  };
  conversation?: { id?: string };
  contact?: { name?: string; email?: string; phone?: string };
};

function parseLiveMessage(raw: string): LiveMessage | null {
  try {
    const payload = JSON.parse(raw) as RealtimeMessagePayload;
    const message = payload.message || {};
    const conversationId = message.conversationId || payload.conversation?.id || "";
    const id = message.id || `${conversationId}-${message.createdAt || Date.now()}`;
    const direction = message.direction || "incoming";
    if (!conversationId || direction !== "incoming") return null;

    return {
      id,
      conversationId,
      content: message.content || "",
      createdAt: message.createdAt || new Date().toISOString(),
      direction,
      provider: message.provider || "website",
      contact: {
        name: payload.contact?.name || payload.contact?.email || payload.contact?.phone || "Customer",
      },
    };
  } catch {
    return null;
  }
}

export function RealtimeBridge() {
  const { locale } = useI18n();
  const [toast, setToast] = useState<LiveMessage | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const events = new EventSource("/api/realtime/stream");

    const forwardRealtimeEvent = (type: string, event: MessageEvent) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = event.data;
      }

      window.dispatchEvent(new CustomEvent("chatzi:realtime-event", { detail: { type, payload } }));
    };

    const handleMessage = (event: MessageEvent) => {
      forwardRealtimeEvent(event.type, event);
      const message = parseLiveMessage(event.data);
      if (!message || seenMessageIds.current.has(message.id)) return;
      seenMessageIds.current.add(message.id);
      setToast(message);
      window.dispatchEvent(new CustomEvent("chatzi:incoming-message", { detail: message }));
    };

    const forwardOnly = (event: MessageEvent) => forwardRealtimeEvent(event.type, event);

    events.addEventListener("message.created", handleMessage);
    events.addEventListener("notification.created", handleMessage);
    events.addEventListener("message.updated", forwardOnly);
    events.addEventListener("conversation.updated", forwardOnly);
    events.addEventListener("conversation.assigned", forwardOnly);
    events.addEventListener("delivery.updated", forwardOnly);
    events.addEventListener("inbox.snapshot", forwardOnly);
    events.addEventListener("sync.required", forwardOnly);
    events.addEventListener("error", () => undefined);

    return () => events.close();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="safe-bottom fixed inset-x-4 z-[70] bottom-[calc(6.5rem+env(safe-area-inset-bottom))] lg:bottom-4">
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          <MessageSquare size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {locale === "ar" ? "رسالة جديدة من" : "New message from"} {toast.contact.name}
          </p>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{toast.content}</p>
          <Link
            href={toast.conversationId ? `/dashboard/conversations?conversationId=${toast.conversationId}` : "/dashboard/conversations"}
            className="mt-3 inline-flex text-sm font-semibold text-indigo-600 dark:text-indigo-300"
          >
            {locale === "ar" ? "فتح المحادثة" : "Open conversation"}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="touch-target rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label={locale === "ar" ? "إغلاق" : "Dismiss"}
        >
          <X size={16} className="mx-auto" />
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import type { Socket } from "socket.io-client";
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

type RealtimeEnvelope = {
  id?: string;
  type?: string;
  payload?: unknown;
  ts?: string;
};

const realtimeEventTypes = [
  "message.created",
  "notification.created",
  "message.updated",
  "conversation.updated",
  "conversation.assigned",
  "conversation.deleted",
  "delivery.updated",
  "inbox.snapshot",
  "sync.required",
  "ready",
  "heartbeat",
  "error"
];

function parseLiveMessageFromPayload(rawPayload: unknown): LiveMessage | null {
  const payload = rawPayload as RealtimeMessagePayload | null;
  if (!payload || typeof payload !== "object") return null;

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
}

function parseSsePayload(event: MessageEvent) {
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return event.data;
  }
}

export function RealtimeBridge() {
  const { locale } = useI18n();
  const [toast, setToast] = useState<LiveMessage | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = () => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      // Browser may block audio before the first user interaction.
    }
  };

  useEffect(() => {
    let socket: Socket | null = null;
    let eventSource: EventSource | null = null;
    let fallbackStarted = false;
    let cancelled = false;
    let socketFallbackTimer: number | undefined;

    const handleRealtimePayload = (type: string, payload: unknown) => {
      window.dispatchEvent(new CustomEvent("chatzi:realtime-event", { detail: { type, payload } }));

      if (type !== "message.created" && type !== "notification.created") return;

      const message = parseLiveMessageFromPayload(payload);
      if (!message || seenMessageIds.current.has(message.id)) return;
      seenMessageIds.current.add(message.id);
      setToast(message);
      playNotificationSound();
      window.dispatchEvent(new CustomEvent("chatzi:incoming-message", { detail: message }));
    };

    const startSseFallback = () => {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;
      eventSource = new EventSource("/api/realtime/stream");

      const forwardSse = (event: MessageEvent) => {
        handleRealtimePayload(event.type, parseSsePayload(event));
      };

      realtimeEventTypes.forEach((type) => eventSource?.addEventListener(type, forwardSse));
      eventSource.addEventListener("error", () => undefined);
    };

    const startSocket = async () => {
      try {
        const { io } = await import("socket.io-client");
        if (cancelled) return;

        socket = io({
          path: "/socket.io",
          withCredentials: true,
          transports: ["websocket", "polling"],
          timeout: 5000,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 8000,
        });

        socketFallbackTimer = window.setTimeout(() => {
          if (!socket?.connected) startSseFallback();
        }, 3000);

        socket.on("connect", () => {
          if (socketFallbackTimer) window.clearTimeout(socketFallbackTimer);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
            fallbackStarted = false;
          }
        });

        socket.on("connect_error", () => {
          startSseFallback();
        });

        socket.on("realtime:event", (event: RealtimeEnvelope) => {
          if (!event?.type) return;
          handleRealtimePayload(event.type, event.payload);
        });

        realtimeEventTypes.forEach((type) => {
          socket?.on(type, (payload: unknown) => handleRealtimePayload(type, payload));
        });
      } catch {
        startSseFallback();
      }
    };

    void startSocket();

    return () => {
      cancelled = true;
      if (socketFallbackTimer) window.clearTimeout(socketFallbackTimer);
      eventSource?.close();
      socket?.disconnect();
    };
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

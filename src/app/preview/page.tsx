"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RotateCcw, Maximize2, Minimize2, Moon, Sun, Smartphone, Monitor, Tablet, Mic, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  loading?: boolean;
  audioUrl?: string;
};

type ViewportSize = "mobile" | "tablet" | "desktop";

// ─── Constants ────────────────────────────────────────────────────────────────
const BOT_ID = "configured-demo-bot";
const TENANT_ID = "configured-demo-tenant";

const VIEWPORT_SIZES: Record<ViewportSize, { w: string; label: string; icon: React.ReactNode }> = {
  mobile:  { w: "390px",  label: "موبايل",  icon: <Smartphone size={14} /> },
  tablet:  { w: "768px",  label: "تابلت",   icon: <Tablet     size={14} /> },
  desktop: { w: "100%",   label: "سطح المكتب", icon: <Monitor size={14} /> },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

// ─── Chat Widget (the simulated embed) ────────────────────────────────────────
import { ChatWidget } from '@/components/ui/chat-widget';

// ─── Main Preview Page ─────────────────────────────────────────────────────────
export default function PreviewPage() {
  const [viewport,  setViewport]  = useState<ViewportSize>("mobile");
  const [dark,      setDark]      = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className={`min-h-screen ${dark ? "bg-slate-950" : "bg-gradient-to-br from-slate-100 via-primary-50 to-slate-100"}`}>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      {!fullscreen && (
        <header className={`sticky top-0 z-50 border-b px-6 py-3 backdrop-blur-md ${
          dark ? "border-slate-800 bg-slate-950/90 text-white" : "border-slate-200 bg-white/90 text-slate-900"
        }`}>
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 shadow">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold">ChatZi Preview</p>
                <p className={`text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>محاكاة البوت الحي</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Viewport switcher */}
              <div className={`flex items-center gap-1 rounded-lg border p-1 ${dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
                {(Object.entries(VIEWPORT_SIZES) as [ViewportSize, typeof VIEWPORT_SIZES[ViewportSize]][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setViewport(key)}
                    title={val.label}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      viewport === key
                        ? "bg-primary-600 text-white shadow-sm"
                        : dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {val.icon}
                    <span className="hidden sm:inline">{val.label}</span>
                  </button>
                ))}
              </div>

              {/* Dark mode */}
              <button
                onClick={() => setDark((d) => !d)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                  dark
                    ? "border-slate-700 bg-slate-800 text-yellow-400"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900"
                }`}
                title={dark ? "وضع النهار" : "الوضع الداكن"}
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Fullscreen */}
              <button
                onClick={() => setFullscreen(true)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                  dark ? "border-slate-700 bg-slate-800 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
                title="ملء الشاشة"
              >
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className={`flex items-start justify-center ${fullscreen ? "h-screen" : "min-h-[calc(100vh-57px)] py-8 px-4"}`}>
        {/* Device frame */}
        <div
          className={`flex flex-col overflow-hidden transition-all duration-300 ${fullscreen ? "h-full w-full" : "h-[680px] rounded-2xl shadow-2xl"}`}
          style={{ width: fullscreen ? "100%" : VIEWPORT_SIZES[viewport].w, maxWidth: "100%" }}
        >
          {/* Browser chrome (not in fullscreen) */}
          {!fullscreen && (
            <div className={`flex items-center gap-2 border-b px-3 py-2 ${dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"}`}>
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className={`flex flex-1 items-center justify-center rounded-md px-3 py-0.5 text-[11px] ${dark ? "bg-slate-700 text-slate-400" : "bg-white text-slate-500"}`}>
                chatzi.ai/demo
              </div>
            </div>
          )}

          {/* Widget */}
          <div className="flex-1 overflow-hidden">
            <ChatWidget key={`${dark}`} dark={dark} />
          </div>
        </div>

        {/* Exit fullscreen */}
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur hover:bg-white/20"
          >
            <Minimize2 size={16} />
          </button>
        )}
      </div>

      {/* ── Info panel ───────────────────────────────────────────── */}
      {!fullscreen && (
        <div className="mx-auto max-w-7xl px-4 pb-10">
          <div className={`rounded-2xl border p-6 ${dark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white/80 backdrop-blur"}`}>
            <h2 className={`mb-4 text-base font-bold ${dark ? "text-white" : "text-slate-900"}`}>
              بيانات الجلسة التجريبية
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Bot ID",     value: BOT_ID },
                { label: "Tenant ID",  value: TENANT_ID },
                { label: "API",        value: "/api/widget/message" },
                { label: "Channel",    value: "website" },
                { label: "AI Model",   value: "Gemini 2.0 Flash (google-gemini)" },
                { label: "Login",      value: "Configured locally" },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-xl border p-3 ${dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
                  <p className={`mt-0.5 break-all font-mono text-xs ${dark ? "text-slate-200" : "text-slate-700"}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-lg border p-3 text-xs ${dark ? "border-slate-700 bg-slate-800 text-slate-400" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
              <p className="font-semibold">⚠️ ملاحظة: يتطلب الاختبار الفعلي مفتاح AI صالحاً (غير منتهي الحصة).</p>
              <p className="mt-1">• Gemini: احصل على مفتاح من <span className="font-mono">aistudio.google.com/apikey</span> (Free tier = 1500 req/day)</p>
              <p>• OpenAI: أضف مفتاحك في OPENAI_API_KEY بملف .env</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

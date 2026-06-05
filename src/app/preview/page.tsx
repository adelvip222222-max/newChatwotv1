"use client";

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
const BOT_ID    = "6a2293419b0cfb058bea9a3d";
const TENANT_ID = "6a2293419b0cfb058bea9a3a";

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
function ChatWidget({ dark }: { dark: boolean }) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [visitorId]                 = useState(() => `visitor-${uid()}`);
  const [conversationId, setConvId] = useState<string | null>(null);
  const [isTyping, setIsTyping]     = useState(false);
  const [started, setStarted]       = useState(false);
  const [error, setError]           = useState("");
  
  const [botName, setBotName]       = useState("مساعد ChatZi");
  const [botAvatar, setBotAvatar]   = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ type: "audio"; name: string; dataUrl: string }[]>([]);
  const [recording, setRecording]   = useState(false);
  const [recorder, setRecorder]     = useState<MediaRecorder | null>(null);

  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Start conversation
  const startChat = useCallback(async () => {
    setStarted(true);
    setError("");
    try {
      const res  = await fetch("/api/widget/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ botId: BOT_ID, visitorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConvId(data.conversationId);

      if (data.bot) {
        if (data.bot.name) setBotName(data.bot.name);
        if (data.bot.avatar) setBotAvatar(data.bot.avatar);
      }
      
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }

      // Welcome message
      setMessages([{
        id:      uid(),
        role:    "assistant",
        content: `مرحباً! 👋 أنا ${data.bot?.name || "مساعد ChatZi"}. كيف يمكنني مساعدتك اليوم؟`,
        ts:      Date.now(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر بدء المحادثة");
      setStarted(false);
    }
  }, [visitorId]);

  // Send message
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text && !attachments.length) return;
    if (isTyping || !conversationId) return;

    setInput("");
    setAttachments([]);
    setError("");

    const audioAtt = attachments.find((a) => a.type === "audio");
    const audioUrl = audioAtt ? audioAtt.dataUrl : undefined;

    const userMsg: Message = { 
      id: uid(), 
      role: "user", 
      content: text || "تم إرسال مرفق صوتي", 
      ts: Date.now(),
      audioUrl
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res  = await fetch("/api/widget/message", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tenantId:       TENANT_ID,
          botId:          BOT_ID,
          conversationId,
          visitorId,
          message:        text || "أرسل لك مقطع صوتي.",
          attachments:    attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages((prev) => [...prev, {
        id:      uid(),
        role:    "assistant",
        content: data.reply || "...",
        ts:      Date.now(),
      }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر إرسال الرسالة";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Quota")) {
        setError("⚠️ تجاوزت حصة Gemini المجانية. احصل على مفتاح مدفوع من aistudio.google.com/apikey أو أضف مفتاح OpenAI.");
      } else {
        setError(msg);
      }
    } finally {
      setIsTyping(false);
    }
  }, [input, attachments, isTyping, conversationId, visitorId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAudioClick = async () => {
    try {
      if (recording && recorder) {
        recorder.stop();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      newRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };
      newRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) => [...prev, { type: "audio", name: "تسجيل صوتي.webm", dataUrl }]);
        };
        reader.readAsDataURL(blob);
        setRecording(false);
      };
      newRecorder.start();
      setRecorder(newRecorder);
      setRecording(true);
    } catch (err) {
      setError("تعذر تشغيل الميكروفون من المتصفح.");
    }
  };

  const resetChat = () => {
    setMessages([]);
    setConvId(null);
    setStarted(false);
    setError("");
    setInput("");
    setSuggestions([]);
    setAttachments([]);
    setRecording(false);
    setRecorder(null);
  };

  // ── Before start ──────────────────────────────────────────────
  if (!started) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-6 p-8 text-center ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-violet-500 shadow-lg">
          <Bot size={36} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">مساعد ChatZi</h2>
          <p className={`mt-1.5 text-sm leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>
            مساعد ذكي متاح على مدار الساعة للإجابة على استفساراتك بناءً على قاعدة المعرفة
          </p>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 font-medium">{error}</p>
        )}
        <button
          onClick={startChat}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 px-8 py-3.5 font-bold text-white shadow-md transition hover:scale-[1.02] active:scale-95"
        >
          ابدأ المحادثة
        </button>
        <p className={`text-xs ${dark ? "text-slate-600" : "text-slate-400"}`}>مدعوم بالذكاء الاصطناعي · ChatZi</p>
      </div>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────
  return (
    <div className={`flex h-full flex-col ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 border-b px-5 py-4 ${dark ? "border-slate-800 bg-slate-800" : "border-slate-100 bg-gradient-to-r from-primary-600 to-violet-600 text-white"}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border ${dark ? "border-slate-700 bg-slate-700" : "border-white/30 bg-white/20"}`}>
          {botAvatar ? (
            <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
          ) : (
            <Bot size={20} className="text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold leading-tight">{botName}</p>
          <span className="flex items-center gap-1 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className={`text-[10px] ${dark ? "text-slate-400" : "text-white/80"}`}>متصل الآن</span>
          </span>
        </div>
        <button
          onClick={resetChat}
          title="محادثة جديدة"
          className={`rounded-full p-2 transition ${dark ? "text-slate-400 hover:bg-slate-700 hover:text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-5 space-y-4 ${dark ? "bg-slate-950" : "bg-slate-50/50"}`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold shadow-sm ${
              msg.role === "user" ? "bg-slate-500" : "bg-gradient-to-tr from-primary-600 to-violet-600"
            }`}>
              {msg.role === "user" ? <User size={14} /> : (botAvatar ? <img src={botAvatar} alt={botName} className="h-full w-full object-cover rounded-full" /> : <Bot size={14} />)}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
              msg.role === "user"
                ? "rounded-tr-sm bg-gradient-to-r from-primary-600 to-violet-600 text-white"
                : dark
                  ? "rounded-tl-sm bg-slate-800 text-slate-100 border border-slate-700"
                  : "rounded-tl-sm bg-white text-slate-800 border border-slate-100"
            }`}>
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
              
              {msg.audioUrl && (
                <audio 
                  src={msg.audioUrl} 
                  controls 
                  className={`mt-2 block w-[200px] h-[36px] outline-none ${msg.role === "user" ? "filter invert hue-rotate-180" : ""}`} 
                />
              )}
              
              <p className="mt-1 text-right text-[10px] opacity-60">{formatTime(msg.ts)}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-violet-600 text-white shadow-sm">
              {botAvatar ? <img src={botAvatar} alt={botName} className="h-full w-full object-cover rounded-full" /> : <Bot size={14} />}
            </div>
            <div className={`flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm ${dark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-100"}`}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested Questions */}
      {suggestions.length > 0 && (
        <div className={`flex gap-2 overflow-x-auto px-5 py-3 border-t ${dark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-white"} no-scrollbar`}>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendMessage(s)}
              className="flex-shrink-0 rounded-full border border-primary-100 bg-primary-50/50 px-4 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-600 hover:text-white transition duration-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className={`flex flex-wrap gap-2 px-5 py-2 border-t ${dark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-slate-50"}`}>
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs text-primary-700 font-semibold">
              <Mic size={12} />
              <span>{att.name}</span>
              <button 
                type="button" 
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-red-500 rounded-full p-0.5 hover:bg-slate-100 transition"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 mb-2 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-600 font-medium">{error}</div>
      )}

      {/* Input */}
      <div className={`border-t p-4 ${dark ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-white"}`}>
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-2 transition-shadow focus-within:ring-2 focus-within:ring-primary-500/20 ${
          dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50/80"
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isTyping}
            placeholder="اكتب رسالتك..."
            rows={1}
            className={`flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400 ${dark ? "text-white" : "text-slate-900"}`}
            style={{ maxHeight: "80px", overflowY: "auto" }}
          />
          
          <button
            type="button"
            onClick={handleAudioClick}
            title="رسالة صوتية"
            className={`rounded-full p-2 transition-all ${
              recording 
                ? "bg-red-500 text-white animate-pulse" 
                : `${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-primary-600 hover:bg-primary-50"}`
            }`}
          >
            <Mic size={16} />
          </button>
          
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !attachments.length) || isTyping}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-violet-600 text-white shadow-md transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
          >
            {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} className="rtl:rotate-180" />}
          </button>
        </div>
        <p className={`mt-2 text-center text-[10px] ${dark ? "text-slate-600" : "text-slate-400"}`}>
          اضغط Enter للإرسال · Shift+Enter للسطر الجديد
        </p>
      </div>
    </div>
  );
}

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
                { label: "Login",      value: "demo@chatzi.ai / Demo@12345" },
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

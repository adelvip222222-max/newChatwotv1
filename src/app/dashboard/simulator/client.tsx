"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RotateCcw, AlertTriangle, Info, Mic, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  audioUrl?: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

export function SimulatorClient({ botId, tenantId, botName }: { botId: string; tenantId: string; botName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [visitorId] = useState(() => `sim-${uid()}`);
  const [conversationId, setConvId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ type: "audio"; name: string; dataUrl: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  
  const { t, locale } = useI18n();
  const isAr = locale === "ar";

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const startChat = useCallback(async () => {
    setStarted(true);
    setError("");
    try {
      const res = await fetch("/api/widget/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, visitorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConvId(data.conversationId);
      
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }

      setMessages([{
        id: uid(),
        role: "assistant",
        content: isAr 
          ? `مرحباً! أنا ${botName}. يمكنك اختباري وسؤالي عن أي شيء قمت بتدريبي عليه.`
          : `Hello! I am ${botName}. You can test me and ask about anything you've trained me on.`,
        ts: Date.now(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isAr ? "تعذر بدء المحادثة" : "Could not start conversation"));
      setStarted(false);
    }
  }, [botId, visitorId, botName, isAr]);

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
      content: text || (isAr ? "تم إرسال مرفق صوتي" : "Voice attachment sent"), 
      ts: Date.now(),
      audioUrl
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          botId,
          conversationId,
          visitorId,
          message: text || "أرسل لك مقطع صوتي.",
          attachments: attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages((prev) => [...prev, {
        id: uid(),
        role: "assistant",
        content: data.reply || "...",
        ts: Date.now(),
      }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (isAr ? "تعذر إرسال الرسالة" : "Could not send message");
      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        setError(isAr 
          ? "⚠️ الذكاء الاصطناعي تجاوز الحصة المسموحة (Quota). يرجى التأكد من صلاحية مفاتيح الـ API في الإعدادات."
          : "⚠️ AI quota exceeded. Please check API key validity in Settings."
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsTyping(false);
    }
  }, [input, attachments, isTyping, conversationId, visitorId, botId, tenantId, isAr]);

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
          setAttachments((prev) => [...prev, { type: "audio", name: isAr ? "تسجيل صوتي.webm" : "voice.webm", dataUrl }]);
        };
        reader.readAsDataURL(blob);
        setRecording(false);
      };
      newRecorder.start();
      setRecorder(newRecorder);
      setRecording(true);
    } catch (err) {
      setError(isAr ? "تعذر تشغيل الميكروفون من المتصفح." : "Could not start microphone on browser.");
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

  return (
    <>
      {/* Simulation Chat Box */}
      <div className="flex w-full lg:w-[400px] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden shrink-0 h-[700px] max-h-full dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 shadow-sm">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{botName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? "متصل وجاهز للاختبار" : "Connected and ready to test"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={resetChat}
            title={isAr ? "إعادة بدء المحاكاة" : "Restart simulation"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-4 relative">
          {!started ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm p-6 text-center z-10">
              <div className="h-16 w-16 bg-primary-50 dark:bg-primary-950/30 text-primary-600 rounded-full flex items-center justify-center mb-4">
                <Bot size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                {isAr ? "محاكاة حقيقية" : "Live Simulation"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                {isAr 
                  ? "اضغط على الزر أدناه لبدء محادثة تجريبية مع البوت لمعرفة كيف يرد على عملائك."
                  : "Press the button below to start a test conversation with the bot to see how it responds to customers."}
              </p>
              <button 
                onClick={startChat}
                className="btn-primary w-full shadow-md py-2.5"
              >
                {isAr ? "بدء المحاكاة الآن" : "Start Simulation Now"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                    msg.role === "user" ? "bg-slate-800" : "bg-primary-600"
                  }`}>
                    {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
                  </div>

                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "rounded-tr-sm bg-slate-800 text-white"
                      : "rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    
                    {msg.audioUrl && (
                      <audio 
                        src={msg.audioUrl} 
                        controls 
                        className={`mt-2 block w-[200px] h-[36px] outline-none ${msg.role === "user" ? "filter invert hue-rotate-180" : ""}`} 
                      />
                    )}
                    
                    <p className="mt-1.5 text-left text-[10px] opacity-60 font-mono">{formatTime(msg.ts)}</p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm">
                    <Bot size={14} />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Suggested Questions */}
        {started && suggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 no-scrollbar shrink-0">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 rounded-full border border-primary-100 bg-primary-50/50 px-3.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-600 hover:text-white transition duration-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Attachments List */}
        {started && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-3 py-1 text-xs text-primary-700 font-semibold">
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

        {/* Error Alert */}
        {error && (
          <div className="mx-3 mb-3 mt-1 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!started || isTyping}
              placeholder={isAr ? "اكتب رسالتك لـ ChatZi..." : "Type your message to ChatZi..."}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder:text-slate-400 py-1.5 px-2 min-h-[38px] max-h-[120px]"
            />
            
            <button
              type="button"
              onClick={handleAudioClick}
              disabled={!started || isTyping}
              title={isAr ? "رسالة صوتية" : "Voice message"}
              className={`rounded-full p-2 transition-all ${
                recording 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "text-slate-500 hover:text-primary-600 hover:bg-primary-50"
              }`}
            >
              <Mic size={16} />
            </button>

            <button
              onClick={() => sendMessage()}
              disabled={!started || (!input.trim() && !attachments.length) || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600"
            >
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1 rtl:rotate-180" />}
            </button>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="panel p-6">
          <div className="flex items-center gap-2 text-ink mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Info size={18} className="text-primary-600" />
            <h2 className="font-bold">{isAr ? "معلومات المحاكي" : "Simulator Info"}</h2>
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            {isAr 
              ? "تتيح لك هذه الشاشة تجربة البوت تماماً كما سيراه عملائك. أي رسالة ترسلها هنا ستتم معالجتها عبر الذكاء الاصطناعي مع البحث في قاعدة المعرفة الخاصة بك للرد بشكل دقيق."
              : "This screen allows you to experience the bot exactly as your customers will see it. Any message you send here will be processed by AI, searching your Knowledge Base to reply accurately."}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bot ID</p>
              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 font-medium truncate">{botId}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tenant ID</p>
              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 font-medium truncate">{tenantId}</p>
            </div>
          </div>
        </div>

        <div className="panel p-6 bg-primary-50/50 dark:bg-primary-950/20 border-primary-100 dark:border-primary-900/40">
          <h3 className="font-bold text-primary-800 dark:text-primary-300 text-sm mb-2">
            {isAr ? "نصائح للاختبار:" : "Testing Tips:"}
          </h3>
          <ul className="text-sm text-primary-700 dark:text-primary-400 space-y-2 list-disc list-inside">
            {isAr ? (
              <>
                <li>اسأل البوت عن منتج محدد أو خدمة قمت بإضافتها.</li>
                <li>جرب سؤاله عن سياسة الاسترجاع أو أوقات العمل.</li>
                <li>إذا أخطأ البوت في الرد، قم بمراجعة <strong>قاعدة المعرفة</strong> وإضافة المعلومات الناقصة.</li>
              </>
            ) : (
              <>
                <li>Ask the bot about a specific product or service you added.</li>
                <li>Try asking about return policies or business hours.</li>
                <li>If the bot responds incorrectly, review the <strong>Knowledge Base</strong> and add the missing details.</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

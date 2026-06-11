"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RotateCcw, Mic, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  loading?: boolean;
  audioUrl?: string;
};

// ─── Mock Data for Personas ───────────────────────────────────────────────────
const PERSONAS = [
  {
    id: "p1",
    name: "مساعد ChatZi",
    roleDescription: "مساعد الذكاء الاصطناعي العام",
    avatar: null, // سيتم استخدام أيقونة البوت
    suggestedQuestions: ["ما هي الخدمات المتاحة؟", "كيف يمكنني التواصل معكم؟"]
  },
  {
    id: "p2",
    name: "سارة (المبيعات)",
    roleDescription: "خبيرة المبيعات والأسعار",
    avatar: "https://i.pravatar.cc/150?img=47",
    suggestedQuestions: ["أريد معرفة أسعار الباقات", "هل يوجد خصم للشركات؟", "كيف يمكنني الدفع؟"]
  },
  {
    id: "p3",
    name: "أحمد (الدعم الفني)",
    roleDescription: "حل المشكلات التقنية",
    avatar: "https://i.pravatar.cc/150?img=11",
    suggestedQuestions: ["نسيت كلمة المرور", "أواجه مشكلة في تسجيل الدخول", "كيف أغير إعدادات الحساب؟"]
  }
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

// ─── Chat Widget Component ────────────────────────────────────────────────────
export function ChatWidget({ dark = false }: { dark?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  
  // ─── Multi-Persona State ───
  const [activePersona, setActivePersona] = useState(PERSONAS[0]);
  const [botName, setBotName] = useState(activePersona.name);
  const [botAvatar, setBotAvatar] = useState<string | null>(activePersona.avatar);
  const [suggestions, setSuggestions] = useState<string[]>(activePersona.suggestedQuestions);
  
  const [attachments, setAttachments] = useState<{ type: "audio"; name: string; dataUrl: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // تحديث بيانات الشات عند تغيير الموظف
  useEffect(() => {
    setBotName(activePersona.name);
    setBotAvatar(activePersona.avatar);
    setSuggestions(activePersona.suggestedQuestions);
  }, [activePersona]);

  // Start conversation
  const startChat = useCallback(() => {
    setStarted(true);
    setError("");
    setMessages([{
      id: uid(),
      role: "assistant",
      content: `مرحباً! 👋 أنا ${activePersona.name}. كيف يمكنني مساعدتك اليوم؟`,
      ts: Date.now(),
    }]);
  }, [activePersona]);

  // Send message (محاكاة)
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text && !attachments.length) return;
    if (isTyping) return;

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

    // محاكاة تأخير الرد
    setTimeout(() => {
      setMessages((prev) => [...prev, {
        id: uid(),
        role: "assistant",
        content: `هذا رد تجريبي من ${activePersona.name} على رسالتك.`,
        ts: Date.now(),
      }]);
      setIsTyping(false);
    }, 1500);

  }, [input, attachments, isTyping, activePersona]);

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
    setStarted(false);
    setError("");
    setInput("");
    setAttachments([]);
    setRecording(false);
    setRecorder(null);
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden font-sans rtl" dir="rtl">
      
      {/* ─── Vertical Floating Sidebar (Multi-Persona Selector) ─── */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-50">
        {PERSONAS.map(persona => (
          <div key={persona.id} className="relative group flex items-center justify-center">
            {/* Persona Avatar Button */}
            <button 
              onClick={() => {
                setActivePersona(persona);
                if (started) {
                  // تحديث رسالة الترحيب إذا كان الشات مفتوحاً للتوضيح للمستخدم
                  setMessages(prev => [...prev, {
                    id: uid(),
                    role: "assistant",
                    content: `مرحباً، تم تحويلك الآن إلى ${persona.name}. كيف يمكنني خدمتك؟`,
                    ts: Date.now(),
                  }]);
                }
              }}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
                activePersona.id === persona.id 
                  ? "ring-4 ring-primary-500 scale-110" 
                  : "hover:scale-110 ring-2 ring-transparent"
              } ${dark ? "bg-slate-800" : "bg-white"}`}
            >
              {persona.avatar ? (
                <img src={persona.avatar} alt={persona.name} className="h-full w-full object-cover rounded-full" />
              ) : (
                <Bot size={24} className="text-primary-600" />
              )}
            </button>
            
            {/* Glassmorphism Tooltip (Hover Effect) */}
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              whileHover={{ opacity: 1, x: 0 }}
              className="absolute right-16 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300"
            >
              <div className={`px-4 py-2 rounded-xl shadow-xl whitespace-nowrap backdrop-blur-md border ${
                dark ? "bg-slate-800/80 border-slate-700 text-white" : "bg-white/80 border-slate-100 text-slate-800"
              }`}>
                <p className="font-bold text-sm">{persona.name}</p>
                <p className="text-xs opacity-80 mt-0.5">{persona.roleDescription}</p>
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {/* ─── Main Chat Window ─── */}
      <div className={`flex-1 flex flex-col h-full mr-20 rounded-2xl overflow-hidden shadow-2xl transition-colors duration-300 ${
        dark ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-100"
      }`}>
        
        {!started ? (
          /* Before start */
          <div className={`flex h-full flex-col items-center justify-center gap-6 p-8 text-center ${dark ? "text-white" : "text-slate-900"}`}>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary-600 to-violet-500 shadow-xl overflow-hidden"
            >
              {botAvatar ? (
                <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
              ) : (
                <Bot size={40} className="text-white" />
              )}
            </motion.div>
            <div>
              <motion.h2 key={botName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">{botName}</motion.h2>
              <p className={`mt-2 text-sm leading-relaxed max-w-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {activePersona.roleDescription} - متواجد لخدمتك والإجابة على أسئلتك.
              </p>
            </div>
            <button
              onClick={startChat}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 px-8 py-3.5 font-bold text-white shadow-md transition hover:scale-[1.02] active:scale-95"
            >
              ابدأ المحادثة
            </button>
          </div>
        ) : (
          /* Chat UI */
          <>
            {/* Header */}
            <div className={`flex items-center gap-3 px-5 py-4 transition-colors duration-300 ${dark ? "border-b border-slate-800 bg-slate-800" : "bg-gradient-to-r from-primary-600 to-violet-600 text-white"}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border ${dark ? "border-slate-700 bg-slate-700" : "border-white/30 bg-white/20"}`}>
                {botAvatar ? (
                  <img src={botAvatar} alt={botName} className="h-full w-full object-cover" />
                ) : (
                  <Bot size={20} className="text-white" />
                )}
              </div>
              <div className="flex-1">
                <motion.p key={botName} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-bold leading-tight">{botName}</motion.p>
                <span className="flex items-center gap-1.5 mt-1">
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
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold shadow-sm ${
                    msg.role === "user" ? "bg-slate-500" : "bg-gradient-to-tr from-primary-600 to-violet-600 overflow-hidden"
                  }`}>
                    {msg.role === "user" ? <User size={14} /> : (botAvatar ? <img src={botAvatar} alt={botName} className="h-full w-full object-cover" /> : <Bot size={14} />)}
                  </div>

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
                    
                    <p className="mt-1 text-left text-[10px] opacity-60">{formatTime(msg.ts)}</p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-violet-600 text-white shadow-sm overflow-hidden">
                    {botAvatar ? <img src={botAvatar} alt={botName} className="h-full w-full object-cover" /> : <Bot size={14} />}
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm ${dark ? "bg-slate-800 border border-slate-700" : "bg-white border border-slate-100"}`}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggested Questions */}
            {suggestions.length > 0 && (
              <motion.div layout className={`flex gap-2 overflow-x-auto px-5 py-3 border-t ${dark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-white"} no-scrollbar`}>
                <AnimatePresence mode="popLayout">
                  {suggestions.map((s) => (
                    <motion.button
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="flex-shrink-0 rounded-full border border-primary-100 bg-primary-50/50 px-4 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-600 hover:text-white transition duration-200"
                    >
                      {s}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Input */}
            <div className={`p-4 ${dark ? "bg-slate-800/50 border-t border-slate-800" : "bg-white border-t border-slate-100"}`}>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

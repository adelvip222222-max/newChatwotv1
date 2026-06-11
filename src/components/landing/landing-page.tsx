"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useState, Suspense } from "react";
import { motion, Variants } from "framer-motion";
import { LoginForm } from "@/components/auth/login-form";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};
const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Languages,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Check,
  Settings,
  MessageSquare,
  Database,
  Key,
  Cpu,
  History,
  User,
  Terminal,
  Activity,
  Globe,
  Play,
  X,
  Inbox,
  BarChart3,
  Search,
  Menu,
  Phone,
  Zap,
  Mail,
  CheckCircle2,
  MoreVertical,
  Paperclip,
  Smile,
  Send
} from "lucide-react";
import { landingContent, type LandingLocale } from "@/lib/landing-content";

const iconMap = [Database, Cpu, MessageSquare, Terminal];

export function LandingPage({ locale, botId }: { locale: LandingLocale; botId?: string }) {
  const copy = landingContent[locale];
  const isEnglish = locale === "en";
  const ArrowIcon = isEnglish ? ArrowRight : ArrowLeft;
  const ChevronIcon = isEnglish ? ChevronRight : ChevronLeft;

  // Active feature tab
  const [activeTab, setActiveTab] = useState(0);

  // Login popup state
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Widget mockup state
  const [widgetOpen, setWidgetOpen] = useState(true);
  const [widgetMessages, setWidgetMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: isEnglish ? "Hello! How can I help you today?" : "مرحباً! كيف يمكنني مساعدتك اليوم؟" },
    { sender: "user", text: isEnglish ? "What are your services?" : "ما هي الخدمات التي تقدمونها؟" },
    { sender: "bot", text: isEnglish ? "We provide automated AI support, multichannel integration, and custom AI agents!" : "نحن نقدم الدعم الآلي بالذكاء الاصطناعي، والربط متعدد القنوات، والوكلاء المخصصين!" }
  ]);
  const [newMessage, setNewMessage] = useState("");

  // Webhook mockup logs
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const userMsg = newMessage;
    setWidgetMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setNewMessage("");
    setTimeout(() => {
      setWidgetMessages(prev => [...prev, {
        sender: "bot",
        text: isEnglish
          ? "This is a live demo widget simulating real AI replies!"
          : "هذا عنصر تجريبي حي يحاكي ردود الذكاء الاصطناعي!"
      }]);
    }, 1000);
  };

  return (
    <main dir={copy.dir} lang={copy.lang} className="theme-rescue relative min-h-screen bg-white font-sans text-ink selection:bg-primary-100 selection:text-primary-950 dark:bg-slate-950">

      {/* Dynamic Keyframes for Background Animation */}
      <style>{`
        @keyframes float-blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.08); }
          66% { transform: translate(-30px, 30px) scale(0.92); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: float-blob 16s infinite ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2.5s;
        }
        .animation-delay-4000 {
          animation-delay: 5s;
        }
      `}</style>

      {/* 1. STICKY NAVBAR - New Modern Style */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href={isEnglish ? "/" : "/ar"} className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                <img src="/images/logo.png" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">ChatZi</span>
            </Link>

            {/* Links */}
            <nav className="hidden md:flex space-x-8">
              {copy.nav.map((item, idx) => (
                <a key={item} href={`#section-${idx}`} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  {item}
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href={isEnglish ? "/ar" : "/"}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                title="Language"
              >
                <Languages size={14} className="text-slate-500" />
                {isEnglish ? "العربية" : "English"}
              </Link>
              <button onClick={() => setIsLoginOpen(true)} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
                {copy.login}
              </button>
              <Link href="/book" className="text-sm font-medium bg-white text-slate-900 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm hidden sm:flex">
                {isEnglish ? "Book a call" : "احجز مكالمة"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION & MOCKUP */}
      <section className="relative z-10 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pb-32 px-4 w-full mx-auto overflow-hidden bg-white">
        {/* Mesh Gradient Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.12]" style={{
          background: 'linear-gradient(45deg, #1e3a8a 0%, #c026d3 50%, #fcd34d 100%)'
        }}></div>
        {/* Wave highlights */}
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-300/30 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-700/30 rounded-full blur-[120px] pointer-events-none z-0"></div>
        
        {/* Fade to white at the bottom */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white to-transparent z-0 pointer-events-none"></div>
        
        <div className="max-w-[1920px] mx-auto relative z-10">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 border border-slate-200 text-sm font-medium text-slate-600 shadow-sm">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>{copy.heroLabel}</span>
          </motion.div>

          <motion.h1 
            variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6"
          >
            {copy.title.split(" ").slice(0, -1).join(" ")}{" "}
            <span className="text-slate-900">
              {copy.title.split(" ").pop()}
            </span>
          </motion.h1>
          
          <motion.p 
            variants={fadeUp}
            className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed"
          >
            {copy.subtitle}
          </motion.p>
          
          <motion.div 
            variants={fadeUp}
            className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4"
          >
            <Link href="/register" className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2">
              {copy.primary}
              <ArrowIcon size={16} className={isEnglish ? "" : "rotate-180"} />
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center">
              {copy.secondary}
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-slate-400" /> {isEnglish ? "No credit card required" : "لا حاجة لبطاقة ائتمان"}</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-slate-400" /> {isEnglish ? "14-day free trial" : "تجربة مجانية 14 يوم"}</div>
          </motion.div>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 80 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-24 mx-auto w-full max-w-5xl relative text-left"
          dir="ltr"
        >
          {/* Outer glow */}

          <div className="absolute -inset-1 bg-gradient-to-b from-slate-200 to-transparent rounded-2xl blur-xl opacity-50"></div>
          
          <div className="relative bg-white rounded-xl shadow-2xl shadow-slate-900/10 border border-slate-200 overflow-hidden flex h-[650px] ring-1 ring-black/[0.03]">
            {/* Sidebar */}
            <aside className="w-[260px] bg-slate-50/50 border-r border-slate-200 flex flex-col hidden md:flex">
              <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center shadow-sm">
                  <MessageSquare className="text-white w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm text-slate-900">Workspace</span>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Main</div>
                <nav className="px-2 space-y-1 mb-6">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-white border border-slate-200 text-slate-900 shadow-sm">
                    <Inbox className="w-4 h-4 text-slate-500" />
                    Unified Inbox
                    <span className="ml-auto bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs font-bold">12</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 transition-colors">
                    <BarChart3 className="w-4 h-4 text-slate-400" />
                    Analytics
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 transition-colors">
                    <Settings className="w-4 h-4 text-slate-400" />
                    Settings
                  </button>
                </nav>

                <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Channels</div>
                <nav className="px-2 space-y-1">
                  <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    WhatsApp API
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                    Website Widget
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                    Instagram DM
                  </div>
                </nav>
              </div>
              <div className="p-4 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-300">AG</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900 leading-tight">Active Agent</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Online
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Application Area */}
            <main className="flex-1 flex flex-col bg-white overflow-hidden">
              <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white">
                <div className="flex items-center gap-4">
                  <Menu className="w-5 h-5 text-slate-400 md:hidden" />
                  <h2 className="text-sm font-bold text-slate-900">Unified Inbox</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Search conversations..." disabled className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm w-64 focus:outline-none placeholder-slate-400 text-slate-900 font-medium" />
                  </div>
                </div>
              </header>
              
              <div className="flex-1 flex overflow-hidden">
                {/* Conversation List */}
                <div className="w-[320px] border-r border-slate-200 flex flex-col bg-slate-50/30">
                  <div className="p-2 flex gap-1 border-b border-slate-200">
                    <button className="flex-1 px-3 py-1.5 text-xs font-bold bg-white shadow-sm border border-slate-200 rounded-md text-slate-900">Open</button>
                    <button className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-md transition-colors">Snoozed</button>
                    <button className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-md transition-colors">Closed</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {/* Active Chat Item */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer relative overflow-hidden ring-1 ring-slate-900/5">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900"></div>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-sm font-bold text-slate-900">Billing Inquiry</span>
                        <span className="text-[11px] font-semibold text-slate-400">Just now</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold tracking-wide uppercase">WhatsApp</span>
                        <span className="text-xs font-medium text-slate-500">ID: #4092</span>
                      </div>
                      <p className="text-sm text-slate-500 truncate leading-snug">Could you help me update my credit card info?</p>
                    </div>

                    {/* Unread Chat Item */}
                    <div className="p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          Sales Consultation
                        </span>
                        <span className="text-[11px] font-semibold text-blue-500">2m ago</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold tracking-wide uppercase">Widget</span>
                        <span className="text-xs font-medium text-slate-500">ID: #4091</span>
                      </div>
                      <p className="text-sm text-slate-900 font-semibold truncate leading-snug">I would like to request a demo of the enterprise plan.</p>
                    </div>

                    {/* Read Chat Item */}
                    <div className="p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg cursor-pointer transition-all opacity-80">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-sm font-bold text-slate-900">Technical Support</span>
                        <span className="text-[11px] font-semibold text-slate-400">1h ago</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold tracking-wide uppercase">Instagram</span>
                        <span className="text-xs font-medium text-slate-500">ID: #4088</span>
                      </div>
                      <p className="text-sm text-slate-500 truncate leading-snug">The integration is working perfectly now, thanks!</p>
                    </div>
                  </div>
                </div>
                
                {/* Chat Detail */}
                <div className="flex-1 flex flex-col bg-slate-50/50 relative">
                  {/* Chat Header */}
                  <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white z-10 shadow-sm shadow-slate-200/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">C</div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 leading-tight">Customer #8829</div>
                        <div className="text-xs font-medium text-green-600 flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          Online via WhatsApp
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><Phone className="w-4 h-4" /></button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><MoreVertical className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    <div className="text-center"><span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm shadow-slate-100">Today, 10:42 AM</span></div>
                    
                    {/* Incoming Message */}
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 mt-auto flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-300">C</div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 ml-1">Customer #8829</span>
                        <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm text-sm leading-relaxed">
                          Hi there! I&apos;m trying to update my billing information but getting an error on the checkout page.
                        </div>
                      </div>
                    </div>

                    {/* Outgoing Message */}
                    <div className="flex gap-3 max-w-[85%] self-end flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-slate-900 flex-shrink-0 mt-auto flex items-center justify-center text-xs font-bold text-white shadow-sm">AG</div>
                      <div className="flex flex-col gap-1.5 items-end">
                        <span className="text-[11px] font-bold text-slate-400 mr-1">You</span>
                        <div className="bg-slate-900 text-white rounded-2xl rounded-br-none px-4 py-3 shadow-sm text-sm leading-relaxed">
                          Hello! I&apos;d be happy to help you with that. Could you please provide the last 4 digits of the card you&apos;re trying to add so I can check the logs?
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mr-1 flex items-center gap-1 mt-0.5">
                          10:44 AM <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        </span>
                      </div>
                    </div>

                    {/* Incoming Message */}
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 mt-auto flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-300">C</div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 ml-1">Customer #8829</span>
                        <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm text-sm leading-relaxed">
                          Sure, it&apos;s 4242.
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Message Input */}
                  <div className="p-4 bg-white border-t border-slate-200">
                    <div className="bg-white border border-slate-200 rounded-xl flex flex-col focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all shadow-sm">
                      <textarea 
                        className="w-full bg-transparent p-3 text-sm outline-none resize-none placeholder-slate-400 text-slate-900 font-medium" 
                        rows={2} 
                        placeholder="Type your message to Customer #8829..."
                        disabled
                      ></textarea>
                      <div className="flex items-center justify-between px-3 pb-3">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><Paperclip className="w-4.5 h-4.5" /></button>
                          <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><Smile className="w-4.5 h-4.5" /></button>
                        </div>
                        <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm">
                          Send <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </motion.div>
        </div>
      </section>

      {/* 3. PROMO VIDEO SECTION (CHROME STYLE) */}
      <section className="relative overflow-hidden bg-purple-50/30 py-24">
        <div className="mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12">
          {/* Use dir="ltr" to strictly place video on left, text on right */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20" dir="ltr">
            
            {/* Video Container (Left) */}
            <motion.div 
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-full lg:w-1/2"
            >
              <div className="relative shadow-2xl transition-transform duration-700 hover:scale-[1.02] overflow-hidden">
                <div className="relative aspect-video w-full bg-slate-50 flex items-center justify-center">
                  <video
                    src="/promo.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  ></video>
                </div>
              </div>
            </motion.div>

            {/* Text Content (Right) */}
            <motion.div 
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="w-full lg:w-1/2 text-center lg:text-right"
              dir={isEnglish ? "ltr" : "rtl"}
            >
              <h2 className="text-[40px] font-extrabold text-slate-900 sm:text-5xl md:text-[56px] leading-[1.2] tracking-tight mb-8">
                {isEnglish ? (
                  <>
                    More than just a chatbot.<br/>
                    <span className="text-primary-600">A smart employee</span> for your business.
                  </>
                ) : (
                  <>
                    أكثر من مجرد شات بوت،<br/>
                    <span className="bg-primary-100 text-primary-700 px-5 py-2 rounded-[2rem] inline-block mt-4 leading-relaxed">موظف ذكي</span> يعمل من أجلك.
                  </>
                )}
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed max-w-lg lg:ml-auto inline-block">
                {isEnglish 
                  ? "Connect your website, Messenger, WhatsApp, and Telegram in one unified inbox. Train a customized AI for each client with isolated tenant data." 
                  : "اربط موقعك وقنوات التواصل مثل ماسنجر وواتساب وتليجرام في منصة واحدة. وقم بتدريب ذكاء اصطناعي مخصص لكل عميل."}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. DYNAMIC INTERACTIVE FEATURES SWITCHER (Leaving 200px) */}
      <section id="section-0" className="border-t border-slate-100 bg-amber-50/30 py-24">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12"
        >
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl md:text-[42px] leading-tight">
              {copy.featuresTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-500">
              {isEnglish
                ? "Experience our advanced, modular capabilities with these interactive previews built into our architecture."
                : "اكتشف قدراتنا المتقدمة عبر هذه العروض التجريبية المدمجة في بنيتنا البرمجية."}
            </p>
          </div>

          {/* Pill Tabs Selector */}
          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {copy.features.map(([title], index) => {
              const Icon = iconMap[index] || Bot;
              return (
                <button
                  key={title}
                  onClick={() => setActiveTab(index)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${activeTab === index
                      ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  <Icon size={16} />
                  <span>{title}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Feature Panel Container */}
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] items-center">

              {/* Info text */}
              <div className="space-y-6">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                  {(() => {
                    const Icon = iconMap[activeTab] || Bot;
                    return <Icon size={24} />;
                  })()}
                </span>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {copy.features[activeTab][0]}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-slate-600">
                    {copy.features[activeTab][1]}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link href="/register" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition">
                    <span>{isEnglish ? "Explore features" : "استكشف المزايا"}</span>
                    <ChevronIcon size={16} />
                  </Link>
                </div>
              </div>

              {/* Dynamic CSS Mockups representing features */}
              <div className="relative rounded-2xl border border-slate-150 bg-slate-50 p-4 shadow-inner min-h-[340px] flex items-center justify-center">

                {/* 1. Multi-tenant isolation simulation */}
                {activeTab === 0 && (
                  <div className="w-full grid gap-4 sm:grid-cols-2">
                    {/* Company A */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between border-b pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-purple-500" />
                          <span className="text-xs font-extrabold text-slate-800">Acme Corp</span>
                        </div>
                        <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Tenant ID: 101</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between bg-slate-50 p-2 rounded">
                          <span className="text-slate-500">Active Bot:</span>
                          <span className="font-semibold text-slate-800">AcmeAgent</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2 rounded">
                          <span className="text-slate-500">Open Chats:</span>
                          <span className="font-semibold text-purple-700">12 Chats</span>
                        </div>
                      </div>
                    </div>

                    {/* Company B */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between border-b pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-emerald-500" />
                          <span className="text-xs font-extrabold text-slate-800">Beta Health</span>
                        </div>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Tenant ID: 102</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between bg-slate-50 p-2 rounded">
                          <span className="text-slate-500">Active Bot:</span>
                          <span className="font-semibold text-slate-800">DocAI</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2 rounded">
                          <span className="text-slate-500">Open Chats:</span>
                          <span className="font-semibold text-emerald-700">4 Chats</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2 text-center text-[10px] text-slate-400 mt-2 font-mono">
                      Database: chatzi_db &bull; Collections isolated by tenant_id index
                    </div>
                  </div>
                )}

                {/* 2. AI Model Library Simulation */}
                {activeTab === 1 && (
                  <div className="w-full space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-800">{isEnglish ? "Available Models" : "النماذج المتاحة"}</h4>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Admin Panel View</span>
                      </div>
                      <div className="space-y-2">
                        {/* GPT-4o */}
                        <div className="flex items-center justify-between rounded-lg border border-slate-100 p-2 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold">O</span>
                            <div>
                              <p className="text-xs font-bold text-slate-800">GPT-4o (OpenAI)</p>
                              <p className="text-[9px] text-slate-400 font-mono">sk-proj-••••5x9a</p>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <Check size={10} /> {isEnglish ? "Active" : "نشط"}
                          </span>
                        </div>

                        {/* Claude 3.5 Sonnet */}
                        <div className="flex items-center justify-between rounded-lg border border-slate-100 p-2 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 text-orange-700 text-xs font-bold">A</span>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Claude 3.5 Sonnet</p>
                              <p className="text-[9px] text-slate-400 font-mono">sk-ant-••••2q9r</p>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <Check size={10} /> {isEnglish ? "Active" : "نشط"}
                          </span>
                        </div>

                        {/* Gemini 1.5 Pro */}
                        <div className="flex items-center justify-between rounded-lg border border-slate-100 p-2 hover:bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-700 text-xs font-bold">G</span>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Gemini 1.5 Pro</p>
                              <p className="text-[9px] text-slate-400 font-mono">AIzaSy••••4w2c</p>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {isEnglish ? "Inactive" : "غير نشط"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Website Widget simulation (Interactive) */}
                {activeTab === 2 && (
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white overflow-hidden shadow-md flex flex-col h-[280px]">
                    <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 select-none">my-ecommerce.com</span>
                      <Globe size={11} className="text-slate-400" />
                    </div>

                    <div className="flex-1 bg-slate-50 p-3 relative overflow-hidden flex flex-col justify-end">
                      <div className="text-center text-[10px] text-slate-400 absolute top-10 left-0 right-0">
                        {isEnglish ? "Mock E-Commerce Store" : "متجر إلكتروني افتراضي"}
                      </div>

                      {/* Floating chat widget window */}
                      {widgetOpen && (
                        <div className="w-full flex items-end gap-2 mb-2 z-10 animate-fade-in">
                          {/* Sidebar Mockup */}
                          <div className="flex flex-col gap-2 mb-2">
                            <button className="h-8 w-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-primary-600 hover:scale-110 hover:border-primary-500 transition relative group">
                              <User size={14} />
                              <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none after:content-[''] after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:border-[4px] after:border-transparent after:border-l-slate-800">
                                {isEnglish ? "Sales Expert" : "مبيعات محترف"}
                              </span>
                            </button>
                            <button className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 border border-primary-600 shadow flex items-center justify-center text-white relative group">
                              <Bot size={14} />
                              <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none after:content-[''] after:absolute after:left-full after:top-1/2 after:-translate-y-1/2 after:border-[4px] after:border-transparent after:border-l-slate-800">
                                {isEnglish ? "General Bot" : "المساعد العام"}
                              </span>
                            </button>
                          </div>
                          
                          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col max-h-[170px] overflow-hidden">
                            <div className="bg-primary-600 text-white px-3 py-2 flex items-center justify-between text-[11px] font-bold">
                            <div className="flex items-center gap-1.5">
                              <Bot size={12} />
                              <span>Acme AI Support</span>
                            </div>
                            <button onClick={() => setWidgetOpen(false)} className="text-white/80 hover:text-white">&times;</button>
                          </div>
                          <div className="flex-1 p-2 space-y-1.5 overflow-y-auto text-[10px]">
                            {widgetMessages.map((msg, i) => (
                              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 ${msg.sender === "user" ? "bg-primary-600 text-white rounded-br-none" : "bg-slate-100 text-slate-800 rounded-bl-none"
                                  }`}>
                                  {msg.text}
                                </div>
                              </div>
                            ))}
                          </div>
                          <form onSubmit={handleSendMessage} className="border-t p-1 flex gap-1 bg-white">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder={isEnglish ? "Type a reply..." : "اكتب ردًا..."}
                              className="flex-1 text-[9px] border rounded px-2 py-1 outline-none"
                            />
                            <button type="submit" className="bg-primary-600 text-white text-[9px] px-2.5 py-1 rounded font-bold">
                              {isEnglish ? "Send" : "إرسال"}
                            </button>
                          </form>
                        </div>
                      </div>
                      )}

                      {/* Launch Widget Button */}
                      <div className="flex justify-end mt-auto">
                        <button
                          onClick={() => setWidgetOpen(!widgetOpen)}
                          className="h-10 w-10 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 transition"
                        >
                          <MessageSquare size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Webhook logs simulation */}
                {activeTab === 3 && (
                  <div className="w-full font-mono text-[11px] bg-slate-900 text-slate-300 rounded-xl border border-slate-800 p-4 shadow-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-500">
                      <span>Webhook Request Console</span>
                      <span className="flex items-center gap-1"><Activity size={10} className="text-emerald-500 animate-pulse" /> Live</span>
                    </div>
                    <div className="space-y-1">
                      <div className="cursor-pointer hover:bg-slate-800 p-1 rounded" onClick={() => setExpandedLog(expandedLog === 0 ? null : 0)}>
                        <span className="text-emerald-500 font-bold">[200 OK]</span> Telegram Message Sent &bull; <span className="text-slate-500">12:04:15</span>
                        {expandedLog === 0 && (
                          <pre className="mt-1 bg-slate-950 p-2 rounded text-[10px] text-slate-400 overflow-x-auto">
                            {`{
  "channel": "telegram",
  "status": "success",
  "payload": {
    "chat_id": 98729312,
    "text": "Hello, how can I assist you?"
  }
}`}
                          </pre>
                        )}
                      </div>
                      <div className="cursor-pointer hover:bg-slate-800 p-1 rounded" onClick={() => setExpandedLog(expandedLog === 1 ? null : 1)}>
                        <span className="text-emerald-500 font-bold">[200 OK]</span> WhatsApp Template Sent &bull; <span className="text-slate-500">12:04:09</span>
                        {expandedLog === 1 && (
                          <pre className="mt-1 bg-slate-950 p-2 rounded text-[10px] text-slate-400 overflow-x-auto">
                            {`{
  "channel": "whatsapp",
  "status": "success",
  "template": "welcome_message"
}`}
                          </pre>
                        )}
                      </div>
                      <div className="cursor-pointer hover:bg-slate-800 p-1 rounded" onClick={() => setExpandedLog(expandedLog === 2 ? null : 2)}>
                        <span className="text-red-400 font-bold">[500 Error]</span> Messenger Send Failed &bull; <span className="text-slate-500">12:03:52</span>
                        {expandedLog === 2 && (
                          <pre className="mt-1 bg-slate-950 p-2 rounded text-[10px] text-red-300 overflow-x-auto">
                            {`{
  "channel": "facebook_messenger",
  "status": "error",
  "error": "OAuthException: Invalid Page Access Token (expired)"
}`}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>

        </motion.div>
      </section>

      {/* 4. CHANNELS SECTION - Leaving 200px */}
      <section id="section-1" className="bg-emerald-50/30 py-24">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] items-center"
        >
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-[42px] leading-tight">
              {copy.channelsTitle}
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              {isEnglish
                ? "ChatZi features functional, natively tested endpoints ready for production scaling. Connect external messenger channels directly in the settings dashboard."
                : "تتميز منصة ChatZi بوجود نقاط ربط برمجية فعلية ومختبرة وجاهزة للإنتاج الفعلي. يمكنك توصيل قنوات المراسلة الخارجية بسهولة."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {copy.channels.map((channel, i) => (
              <div
                key={channel}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-primary-600 transition-colors group-hover:bg-primary-50">
                  <PlugZap className="text-primary-500" size={22} />
                </span>
                <div>
                  <span className="block font-bold text-slate-800 text-[15px]">{channel}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Natively Supported</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 5. SECURITY SECTION - Chrome Secure Browsing Style (Leaving 200px) */}
      <section id="section-2" className="bg-blue-50/30 py-24 text-slate-900 relative overflow-hidden">
        {/* Abstract grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] items-center"
        >
          <div className="space-y-6">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <LockKeyhole size={28} />
            </span>
            <h2 className="text-3xl font-extrabold sm:text-4xl md:text-[42px] leading-tight">
              {copy.securityTitle}
            </h2>
          </div>

          <div className="space-y-6 text-lg leading-relaxed text-slate-700">
            <p>{copy.security}</p>

            <div className="grid gap-4 sm:grid-cols-2 mt-6">
              <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                <span className="text-xs font-semibold text-slate-800">Tenant-Scoped Database Filters</span>
              </div>
              <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                <span className="text-xs font-semibold text-slate-800">AES Key Cryptography</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 6. FAQ & PRICING - Google Help Center Accordion Style (Leaving 200px) */}
      <section id="section-3" className="py-24 bg-rose-50/30">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12"
        >

          {/* Pricing Banner */}
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-primary-50/50 to-indigo-50/50 p-8 md:p-10 text-center shadow-sm mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900">{copy.pricingTitle}</h2>
            <p className="mt-4 text-slate-600 leading-relaxed text-base">
              {copy.pricing}
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h3 className="text-2xl font-extrabold text-slate-900 text-center mb-8">
              {isEnglish ? "Frequently Asked Questions" : "الأسئلة الشائعة"}
            </h3>

            {copy.faq.map(([question, answer], index) => {
              const isFaqOpen = openFaq === index;
              return (
                <div
                  key={question}
                  className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden transition-all duration-300 hover:border-slate-300 shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaq(isFaqOpen ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-right font-bold text-slate-800 hover:text-slate-900 transition-colors text-base"
                  >
                    <span className="text-right flex-1 pr-4">{question}</span>
                    {isFaqOpen ? <ChevronUp size={20} className="text-primary-600" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ${isFaqOpen ? "max-h-[300px] border-t border-slate-100" : "max-h-0"
                      }`}
                  >
                    <p className="p-6 text-sm leading-relaxed text-slate-600 bg-slate-50/50">
                      {answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* 7. PRE-FOOTER CTA SECTION - Google Chrome Download Banner Style (Leaving 200px) */}
      <section className="relative py-24 text-center overflow-hidden">
        {/* Vibrant Mesh Gradient Background */}
        <div className="absolute inset-0 z-0 pointer-events-none" style={{
          background: 'linear-gradient(45deg, #1e3a8a 0%, #c026d3 50%, #fcd34d 100%)'
        }}></div>
        
        {/* Overlay to add depth */}
        <div className="absolute inset-0 bg-slate-900/10 pointer-events-none mix-blend-overlay"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12 text-white"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl leading-tight">
            {isEnglish ? "Automate support on every channel" : "أتمت الدعم على كل القنوات الآن"}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90 font-medium">
            {isEnglish 
              ? "Join thousands of businesses that use ChatZi to manage customer relationships and drive sales."
              : "انضم لآلاف الشركات التي تستخدم شاتزي لإدارة علاقات العملاء وزيادة المبيعات."}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-4 text-[15px] font-bold text-white shadow-xl shadow-slate-900/20 transition hover:scale-[1.02] active:scale-95 hover:bg-slate-800"
            >
              {copy.start}
              <ArrowIcon size={18} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* 8. FOOTER - Google Chrome Clean Style (Leaving 200px) */}
      <footer className="border-t border-slate-100 bg-white py-12 text-center text-sm text-slate-500">
        <div className="mx-auto max-w-[1920px] px-6 xl:px-[200px] lg:px-24 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-bold">
              <img src="/images/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
            </span>
            <span className="font-extrabold text-slate-700">ChatZi</span>
          </div>

          <p className="text-xs text-slate-400 font-semibold">{copy.footer}</p>

          <div className="flex gap-4 text-xs text-slate-400 font-semibold">
            <Link href="/privacy" className="hover:text-primary-600">{isEnglish ? "Privacy Policy" : "سياسة الخصوصية"}</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-primary-600">{isEnglish ? "Terms of Service" : "شروط الخدمة"}</Link>
            <span>&bull;</span>
            <Link href="/data-deletion" className="hover:text-primary-600">{isEnglish ? "Data Deletion" : "حذف البيانات"}</Link>
          </div>
        </div>
      </footer>

      {isLoginOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsLoginOpen(false)}
              className="absolute top-4 right-4 z-50 text-slate-400 hover:text-slate-800 transition p-2 bg-slate-100/50 hover:bg-slate-200 rounded-full"
              title="Close"
            >
              <X size={20} />
            </button>
            <Suspense fallback={<div className="text-center py-6 text-sm text-white">Loading...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      )}

      {botId && (
        <Script
          src="/widget.js"
          data-bot-id={botId}
          strategy="lazyOnload"
        />
      )}
    </main>
  );
}

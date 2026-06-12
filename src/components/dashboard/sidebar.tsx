"use client";

import Link from "next/link";
import {
  Bot,
  BookOpenText,
  Brain,
  ContactRound,
  CreditCard,
  Gauge,
  Inbox,
  KeyRound,
  Menu,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  PlaySquare,
  Plus,
  PlugZap,
  Settings,
  Sparkles,
  Users,
  X,
  Download,
  Bell,
  ClipboardCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { usePathname, useRouter } from "next/navigation";
import { SignOutButton } from "@/components/dashboard/sign-out";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

type NavLink = {
  href: string;
  label: string;
  icon: typeof Gauge;
};

function isLinkActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function Sidebar({ role }: { role?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const currentPath = pathname || "";
  const router = useRouter();

  const primaryLinks: NavLink[] = [
    { href: "/dashboard", label: t.nav.home, icon: Gauge },
    { href: "/dashboard/conversations", label: t.nav.conversations, icon: MessageSquare },
    { href: "/dashboard/tickets", label: locale === "ar" ? "التذاكر" : "Tickets", icon: ClipboardCheck },
    { href: "/dashboard/contacts", label: locale === "ar" ? "جهات الاتصال" : "Contacts", icon: ContactRound },
    { href: "/dashboard/ai-settings", label: t.nav.aiSettings, icon: Brain },
    ...(role === "admin" ? [{ href: "/admin/ai-models", label: locale === "ar" ? "مفاتيح AI" : "AI API Keys", icon: KeyRound }] : []),
    { href: "/dashboard/settings", label: t.nav.settings, icon: Settings },
  ];

  const bottomNavLinks: NavLink[] = [
    { href: "/dashboard", label: t.nav.home, icon: Gauge },
    { href: "/dashboard/conversations", label: t.nav.conversations, icon: MessageSquare },
    { href: "/dashboard/tickets", label: locale === "ar" ? "التذاكر" : "Tickets", icon: ClipboardCheck },
    { href: "/dashboard/notifications", label: locale === "ar" ? "الإشعارات" : "Notifications", icon: Bell },
    { href: "/dashboard/tasks", label: locale === "ar" ? "المهام" : "Tasks", icon: ClipboardCheck },
    { href: "/dashboard/settings", label: t.nav.settings, icon: Settings },
  ];

  const drawerLinks: NavLink[] = [
    { href: "/dashboard", label: t.nav.home, icon: Gauge },
    { href: "/dashboard/conversations", label: t.nav.conversations, icon: MessageSquare },
    { href: "/dashboard/tickets", label: locale === "ar" ? "التذاكر" : "Tickets", icon: ClipboardCheck },
    { href: "/dashboard/contacts", label: locale === "ar" ? "جهات الاتصال" : "Contacts", icon: ContactRound },
    { href: "/dashboard/channels", label: t.nav.channels, icon: PlugZap },
    { href: "/dashboard/knowledge", label: t.nav.knowledge, icon: BookOpenText },
    { href: "/dashboard/bots", label: t.nav.bots, icon: Bot },
    { href: "/dashboard/personas", label: locale === "ar" ? "الموظفون الآليون" : "AI Personas", icon: Users },
    { href: "/dashboard/simulator", label: locale === "ar" ? "محاكي البوت" : "Bot Simulator", icon: PlaySquare },
    ...(role === "admin" ? [{ href: "/admin/ai-models", label: locale === "ar" ? "مفاتيح AI" : "AI API Keys", icon: KeyRound }] : []),
    { href: "/dashboard/billing", label: t.nav.billing, icon: CreditCard },
    { href: "/dashboard/settings", label: t.nav.settings, icon: Settings },
  ];

  const quickActions = [
    { href: "/dashboard/conversations", label: locale === "ar" ? "محادثة جديدة" : "New Conversation", icon: MessageSquare },
    { href: "/dashboard/contacts", label: locale === "ar" ? "عميل جديد" : "New Contact", icon: ContactRound },
    { href: "/dashboard/bots/new", label: locale === "ar" ? "بوت جديد" : "New Bot", icon: Bot },
    { href: "/dashboard/channels", label: locale === "ar" ? "قناة جديدة" : "New Channel", icon: PlugZap },
  ];

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setFabOpen(false);
  }, [pathname]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  const localeSwitchLabel = locale === "en" ? "العربية (AR)" : "English (EN)";

  return (
    <>
      <aside
        className={`hidden shrink-0 lg:flex lg:flex-col relative z-0 bg-transparent text-white transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar">
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                  <Inbox size={20} />
                </span>
                {!collapsed ? (
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold tracking-tight">ChatZi</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{t.common.dashboard}</p>
                  </div>
                ) : null}
              </div>
              <button
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={t.nav.collapseMenu}
              >
                {collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
              </button>
            </div>
          </div>

          <nav className="space-y-1.5 px-3">
            {drawerLinks.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(currentPath, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200 ${
                    active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                  title={item.label}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 border-t border-white/5 p-4">
          {!collapsed ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                <Sparkles size={12} />
                {locale === "ar" ? "وضع الهاتف المحمول" : "Mobile CRM mode"}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-300">
                {locale === "ar"
                  ? "تنقل أسرع، محادثات آنية، وتجربة أصلية للهاتف."
                  : "Faster navigation, live conversations, and a native-feeling mobile workspace."}
              </p>
            </div>
          ) : null}

          <button
            onClick={() => {
              setLocale(locale === "en" ? "ar" : "en");
              router.refresh();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-3 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            title={locale === "en" ? "تحويل للعربية" : "Switch to English"}
          >
            {collapsed ? (locale === "en" ? "AR" : "EN") : localeSwitchLabel}
          </button>
        </div>
      </aside>

      <button
        className="touch-target safe-top fixed top-3 z-50 rounded-2xl border border-slate-200 bg-white/95 px-3 text-ink shadow-soft backdrop-blur lg:hidden rtl:left-3 ltr:right-3"
        onClick={() => setMobileOpen(true)}
        aria-label={t.nav.openMenu}
      >
        <Menu size={20} />
      </button>

      {mobileOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label={t.nav.closeMenu} />
          <aside className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col bg-[#0B0C1E] text-white lg:hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-md shadow-indigo-600/30">
                  <Inbox size={22} />
                </span>
                <div>
                  <p className="text-lg font-extrabold">ChatZi</p>
                  <p className="text-xs text-indigo-300">{locale === "ar" ? "لوحة الهاتف" : "Mobile Workspace"}</p>
                </div>
              </div>
              <button className="touch-target rounded-2xl border border-white/10 bg-white/5 text-slate-200" onClick={() => setMobileOpen(false)} aria-label={t.nav.closeMenu}>
                <X size={18} className="mx-auto" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <section>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {locale === "ar" ? "التنقل" : "Navigation"}
                </p>
                <div className="space-y-2">
                  {drawerLinks.map((item) => {
                    const Icon = item.icon;
                    const active = isLinkActive(currentPath, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          active ? "bg-indigo-600 text-white" : "bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                        }`}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section className="mt-7">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {locale === "ar" ? "إجراءات سريعة" : "Quick actions"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href + action.label}
                        href={action.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-start transition hover:bg-white/[0.08]"
                      >
                        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-300">
                          <Icon size={18} />
                        </span>
                        <span className="block text-sm font-semibold text-white">{action.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {installPrompt ? (
                <section className="mt-7 rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                  <p className="text-sm font-semibold text-white">
                    {locale === "ar" ? "ثبّت ChatZi على هاتفك" : "Install ChatZi on your phone"}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-indigo-100">
                    {locale === "ar"
                      ? "احصل على تجربة أقرب للتطبيق مع تشغيل من الشاشة الرئيسية."
                      : "Get an app-like experience with home-screen launch and faster access."}
                  </p>
                  <button type="button" onClick={handleInstall} className="btn-primary mt-4 w-full">
                    <Download size={16} />
                    {locale === "ar" ? "تثبيت التطبيق" : "Install App"}
                  </button>
                </section>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setLocale(locale === "en" ? "ar" : "en");
                  router.refresh();
                }}
                className="touch-target w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white"
              >
                {locale === "en" ? "العربية" : "English"}
              </button>
              <SignOutButton />
            </div>
          </aside>
        </>
      ) : null}

      <nav className="safe-bottom fixed inset-x-3 z-40 lg:hidden bottom-mobile-nav">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-[1.75rem] border border-slate-200 bg-white/95 px-2 py-2 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          {bottomNavLinks.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(currentPath, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                  active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon size={18} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="fixed z-40 lg:hidden rtl:left-4 ltr:right-4" style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}>
        <div className="flex flex-col items-end gap-3 rtl:items-start">
          {fabOpen ? (
            <div className="w-56 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div className="space-y-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href + action.label + "-fab"}
                      href={action.href}
                      onClick={() => setFabOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        <Icon size={18} />
                      </span>
                      <span>{action.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setFabOpen((value) => !value)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
            aria-label={locale === "ar" ? "إجراءات سريعة" : "Quick actions"}
          >
            <Plus size={22} className={fabOpen ? "rotate-45 transition-transform" : "transition-transform"} />
          </button>
        </div>
      </div>
    </>
  );
}

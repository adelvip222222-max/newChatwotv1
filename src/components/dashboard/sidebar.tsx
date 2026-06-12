"use client";

import Link from "next/link";
import {
  Bot,
  BookOpenText,
  Brain,
  CreditCard,
  Gauge,
  Inbox,
  LockKeyhole,
  Menu,
  MessageSquare,
  TicketCheck,
  PanelRightClose,
  PanelRightOpen,
  PlaySquare,
  PlugZap,
  Settings,
  Users,
  Activity
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();

  const links = [
    { href: "/dashboard", label: t.nav.home, icon: Gauge },
    { href: "/dashboard/simulator", label: locale === "ar" ? "محاكي البوت" : "Bot Simulator", icon: PlaySquare },
    { href: "/dashboard/bots", label: t.nav.bots, icon: Bot },
    { href: "/dashboard/conversations", label: t.nav.conversations, icon: MessageSquare },
    { href: "/dashboard/tickets", label: locale === "ar" ? "التذاكر" : "Tickets", icon: TicketCheck },
    { href: "/dashboard/channels", label: t.nav.channels, icon: PlugZap },
    { href: "/dashboard/ai-settings", label: t.nav.aiSettings, icon: Brain },
    { href: "/dashboard/billing", label: t.nav.billing, icon: CreditCard },
    { href: "/dashboard/settings", label: t.nav.settings, icon: Settings }
  ];

  return (
    <>
      <button
        className="fixed rtl:left-3 ltr:right-3 top-3 z-50 rounded-md border border-slate-200 bg-white p-2 text-ink shadow-soft lg:hidden"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label={t.nav.openMenu}
      >
        <Menu size={20} />
      </button>
      <aside
        className={`fixed inset-y-0 rtl:right-0 ltr:left-0 z-40 rtl:border-l ltr:border-r border-slate-200 bg-ink text-white transition-all lg:sticky lg:top-0 lg:h-screen lg:self-start flex flex-col justify-between ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full lg:rtl:translate-x-0 lg:ltr:translate-x-0"}`}
      >
        <div className="flex flex-col overflow-y-auto min-h-0 flex-1">
          {/* Header */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                  <Inbox size={20} />
                </span>
                {!collapsed ? (
                  <div className="min-w-0">
                    <p className="text-lg font-bold">ChatZi</p>
                    <p className="text-xs text-slate-300">{t.common.dashboard}</p>
                  </div>
                ) : null}
              </div>
              <button
                className="hidden rounded-md p-2 text-slate-200 hover:bg-white/10 lg:block"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={t.nav.collapseMenu}
              >
                {collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
              </button>
            </div>
          </div>

          {/* Links */}
          <nav className="space-y-1 px-3">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  title={item.label}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-white/5 px-2 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            title={locale === "en" ? "تحويل للعربية" : "Switch to English"}
          >
            {collapsed ? (locale === "en" ? "AR" : "EN") : (locale === "en" ? "العربية (AR)" : "English (EN)")}
          </button>
        </div>
      </aside>
      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={t.nav.closeMenu}
        />
      ) : null}
    </>
  );
}

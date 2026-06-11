"use client";

import Link from "next/link";
import {
  LockKeyhole,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  CreditCard,
  Users,
  Activity,
  Gauge,
  ShieldCheck,
  LayoutDashboard,
  Terminal
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useRouter } from "next/navigation";

export function SidebarAdmin() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();

  const links = [
    { href: "/admin", label: locale === "ar" ? "الرئيسية" : "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: t.nav.adminUsers, icon: Users },
    { href: "/admin/ai-models", label: t.nav.adminAi, icon: LockKeyhole },
    { href: "/admin/billing", label: t.nav.adminBilling, icon: CreditCard },
    { href: "/admin/subscriptions", label: locale === "ar" ? "إدارة الاشتراكات" : "Subscriptions", icon: Activity },
    { href: "/developer", label: locale === "ar" ? "لوحة المطور" : "Developer", icon: Terminal }
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
      <div className={`hidden lg:block shrink-0 transition-all ${collapsed ? "w-20" : "w-64"}`} />
      <aside
        className={`fixed inset-y-0 rtl:right-0 ltr:left-0 z-40 rtl:border-l ltr:border-r border-slate-200 bg-slate-950 text-white transition-all lg:top-0 lg:h-screen flex flex-col justify-between ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full lg:rtl:translate-x-0 lg:ltr:translate-x-0"}`}
      >
        <div className="flex flex-col overflow-y-auto min-h-0 flex-1 no-scrollbar">
          {/* Header */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                  <ShieldCheck size={20} />
                </span>
                {!collapsed ? (
                  <div className="min-w-0">
                    <p className="text-lg font-bold">ChatZi</p>
                    <p className="text-xs text-slate-300">الإدارة (Admin)</p>
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
            onClick={() => {
              setLocale(locale === "en" ? "ar" : "en");
              router.refresh();
            }}
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

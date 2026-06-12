"use client";

import { usePathname, useRouter } from "next/navigation";
import { Languages, Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";

export function GlobalShellControls() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const { resolvedTheme, toggleTheme } = useTheme();

  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin")) {
    return null;
  }

  const nextLocale = locale === "en" ? "ar" : "en";

  function switchLocale() {
    setLocale(nextLocale);
    if (pathname === "/" && nextLocale === "ar") router.push("/ar");
    if (pathname === "/ar" && nextLocale === "en") router.push("/");
  }

  return (
    <div className="fixed bottom-4 ltr:right-4 rtl:left-4 z-[90] flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 p-1.5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <button
        type="button"
        onClick={switchLocale}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
        title={locale === "en" ? "Switch to Arabic" : "Switch to English"}
      >
        <Languages size={16} />
        {nextLocale.toUpperCase()}
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label={locale === "ar" ? "تبديل المظهر" : "Toggle theme"}
        title={resolvedTheme === "dark" ? (locale === "ar" ? "الوضع المضيء" : "Light mode") : (locale === "ar" ? "الوضع المظلم" : "Dark mode")}
      >
        {resolvedTheme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const isAr = locale === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-md border border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-900/50" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80"
      aria-label={isAr ? "تبديل المظهر" : "Toggle theme"}
      title={resolvedTheme === "dark" ? (isAr ? "الوضع المضيء" : "Light mode") : (isAr ? "الوضع المظلم" : "Dark mode")}
    >
      {resolvedTheme === "dark" ? (
        <Sun size={18} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon size={18} className="text-slate-600 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}

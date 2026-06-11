"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { en, ar, type TranslationDict } from "@/lib/i18n";

type Locale = "en" | "ar";

type I18nContextType = {
  locale: Locale;
  t: TranslationDict;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    // Write cookie that is read by next/headers on the server
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
    localStorage.setItem("locale", newLocale);
  };

  useEffect(() => {
    // Sync with localStorage on client mount if it differs
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && saved !== locale) {
      setLocale(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = (locale === "ar" ? ar : en) as unknown as TranslationDict;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ locale, t, dir, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

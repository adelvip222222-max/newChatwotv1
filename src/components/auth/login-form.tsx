"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t, locale, setLocale } = useI18n();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false
    });
    setLoading(false);

    if (result?.error) {
      setError(t.auth.invalidCredentials);
      return;
    }

    router.push(searchParams.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel w-full max-w-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm font-semibold text-accent">ChatZi</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">{t.auth.loginTitle}</h1>
        </div>
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          className="text-xs font-semibold text-accent border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          {locale === "en" ? "العربية" : "English"}
        </button>
      </div>
      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      
      <label className="label" htmlFor="email">{t.auth.emailLabel}</label>
      <input className="field mb-4" id="email" name="email" type="email" required />
      
      <label className="label" htmlFor="password">{t.auth.passwordLabel}</label>
      <input className="field mb-5" id="password" name="password" type="password" required />
      
      <button className="btn-primary w-full" disabled={loading}>
        <LogIn size={18} />
        {loading ? t.common.loading : t.auth.loginButton}
      </button>
      
      <a href="/register" className="mt-4 block text-center text-sm font-medium text-accent">
        {t.auth.noAccount} {t.auth.registerLink}
      </a>
    </form>
  );
}

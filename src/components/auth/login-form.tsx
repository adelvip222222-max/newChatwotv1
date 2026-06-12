"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const loginCopy = {
  en: {
    title: "Login",
    username: "Email",
    usernamePlaceholder: "Type your email",
    password: "Password",
    passwordPlaceholder: "Type your password",
    forgotPassword: "Forgot password?",
    loading: "Loading...",
    submit: "Login",
    signUpHint: "New to ChatZi?",
    signUp: "Sign up",
    invalid: "Invalid credentials"
  },
  ar: {
    title: "تسجيل الدخول",
    username: "البريد الإلكتروني",
    usernamePlaceholder: "اكتب بريدك الإلكتروني",
    password: "كلمة المرور",
    passwordPlaceholder: "اكتب كلمة المرور",
    forgotPassword: "نسيت كلمة المرور؟",
    loading: "جاري الدخول...",
    submit: "دخول",
    signUpHint: "جديد في ChatZi؟",
    signUp: "إنشاء حساب",
    invalid: "بيانات الدخول غير صحيحة"
  }
} as const;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, dir } = useI18n();
  const copy = loginCopy[locale];
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((response) => response.json())
      .then((providers) => setGoogleEnabled(Boolean(providers?.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

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
      setError(copy.invalid);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form
      dir={dir}
      onSubmit={onSubmit}
      className="theme-rescue relative z-10 flex min-h-[520px] w-full max-w-[390px] flex-col rounded-[10px] bg-white px-6 py-10 shadow-[0_3px_20px_0px_rgba(0,0,0,0.1)] dark:bg-slate-950 sm:px-[50px] sm:py-[60px]"
    >
      <h1 className="mb-10 text-center text-[30px] font-bold leading-[1.2] text-slate-900 sm:mb-[50px]">
        {copy.title}
      </h1>

      {error ? <p className="callout-error mb-4">{error}</p> : null}

      {googleEnabled ? (
        <>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-[25px] border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-bold text-[#4285f4]">G</span>
            {locale === "ar" ? "المتابعة باستخدام Google" : "Continue with Google"}
          </button>
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400">{locale === "ar" ? "أو" : "or"}</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      ) : null}

      <div className="mb-7">
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="email">
          {copy.username}
        </label>
        <div className="flex items-center border-b-2 border-slate-200 pb-2 pt-1 transition-colors focus-within:border-primary-500 dark:border-slate-800">
          <User className="mx-3 shrink-0 text-slate-400" size={16} strokeWidth={2.5} />
          <input
            className="w-full bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
            id="email"
            name="email"
            type="email"
            dir="ltr"
            placeholder={copy.usernamePlaceholder}
            required
          />
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="password">
          {copy.password}
        </label>
        <div className="flex items-center border-b-2 border-slate-200 pb-2 pt-1 transition-colors focus-within:border-primary-500 dark:border-slate-800">
          <Lock className="mx-3 shrink-0 text-slate-400" size={16} strokeWidth={2.5} />
          <input
            className="w-full bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={copy.passwordPlaceholder}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-slate-400 transition-colors hover:text-primary-500 focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="mb-7 flex justify-end">
        <a href="#" className="text-[13px] text-slate-500 transition-colors hover:text-primary-600">
          {copy.forgotPassword}
        </a>
      </div>

      <button
        className="mb-8 w-full rounded-[25px] bg-primary-600 py-[15px] text-sm font-bold uppercase tracking-widest text-white shadow-[0_10px_30px_-10px_rgba(166,75,244,0.6)] transition-all hover:scale-[1.02] hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={loading}
      >
        {loading ? copy.loading : copy.submit}
      </button>

      <div className="mt-auto text-center">
        <span className="mb-2 block text-sm text-slate-500">{copy.signUpHint}</span>
        <a href="/register" className="text-sm font-bold uppercase tracking-widest text-slate-900 transition-colors hover:text-primary-600">
          {copy.signUp}
        </a>
      </div>
    </form>
  );
}

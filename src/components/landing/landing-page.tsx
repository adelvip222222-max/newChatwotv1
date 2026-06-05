import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft, ArrowRight, Bot, Languages, LockKeyhole, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import { landingContent, type LandingLocale } from "@/lib/landing-content";

const iconMap = [Bot, Sparkles, PlugZap, ShieldCheck];

export function LandingPage({ locale, botId }: { locale: LandingLocale; botId?: string }) {
  const copy = landingContent[locale];
  const isEnglish = locale === "en";
  const ArrowIcon = isEnglish ? ArrowRight : ArrowLeft;

  return (
    <main dir={copy.dir} lang={copy.lang} className="min-h-screen bg-[#f7f8fb] text-ink">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <Link href={isEnglish ? "/en" : "/"} className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white">
            <Bot size={21} />
          </span>
          <span className="text-xl font-bold">ChatZi</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {copy.nav.map((item) => (
            <a key={item} href={`#${item}`} className="hover:text-accent">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={isEnglish ? "/ar" : "/"} className="btn-secondary px-3" title="Language">
            <Languages size={17} />
            {isEnglish ? "AR" : "EN"}
          </Link>
          <Link href="/login" className="btn-secondary">
            {copy.login}
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-1 text-sm font-semibold text-accent">
            <Sparkles size={16} />
            {copy.heroLabel}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-ink md:text-6xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{copy.subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              {copy.primary}
              <ArrowIcon size={18} />
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              {copy.secondary}
            </Link>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {copy.stats.map(([value, label]) => (
              <div key={label} className="rounded-md border border-slate-200 bg-white p-4">
                <p className="text-2xl font-bold text-ink">{value}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <Image
            src="/images/chatzi-hero.png"
            alt="ChatZi product dashboard"
            width={1400}
            height={900}
            priority
            className="rounded-md border border-slate-200 bg-white shadow-soft"
          />
        </div>
      </section>

      <section id={copy.nav[0]} className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-bold text-ink">{copy.featuresTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {copy.features.map(([title, body], index) => {
              const Icon = iconMap[index] || Bot;
              return (
                <article key={title} className="rounded-md border border-slate-200 p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-accent/10 text-accent">
                    <Icon size={21} />
                  </div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id={copy.nav[1]} className="mx-auto grid max-w-7xl gap-6 px-4 py-16 lg:grid-cols-3 lg:px-8">
        <div className="lg:col-span-1">
          <h2 className="text-3xl font-bold text-ink">{copy.channelsTitle}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {copy.channels.map((channel) => (
            <div key={channel} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4">
              <PlugZap className="text-coral" size={20} />
              <span className="font-semibold">{channel}</span>
            </div>
          ))}
        </div>
      </section>

      <section id={copy.nav[2]} className="bg-ink py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-2 lg:px-8">
          <div>
            <LockKeyhole size={28} className="text-primary-300" />
            <h2 className="mt-4 text-3xl font-bold">{copy.securityTitle}</h2>
          </div>
          <p className="text-lg leading-9 text-slate-200">{copy.security}</p>
        </div>
      </section>

      <section id={copy.nav[3]} className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="rounded-md border border-slate-200 bg-white p-6 md:p-8">
          <h2 className="text-3xl font-bold text-ink">{copy.pricingTitle}</h2>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">{copy.pricing}</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {copy.faq.map(([question, answer]) => (
            <article key={question} className="rounded-md border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-ink">{question}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {copy.footer}
      </footer>
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

import type { Metadata, Viewport } from "next";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

// ─── SEO & Metadata ──────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "ChatZi — منصة المحادثات الذكية",
    template: "%s | ChatZi",
  },
  description:
    "منصة ChatZi للمحادثات الذكية متعددة القنوات — WhatsApp، Telegram، Facebook، وأكثر. مدعوم بالذكاء الاصطناعي.",
  robots: { index: false, follow: false }, // Private SaaS — no public indexing
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// ─── Root Layout ─────────────────────────────────────────────────────────────
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className="transition-colors duration-fast">
      <head>
        {/*
         * Google Fonts preconnect — critical for performance.
         * Tajawal: Arabic-optimised face (400, 500, 600, 700, 800)
         * Inter:   Latin companion — same optical metrics as Tajawal
         * Both are loaded in globals.css via @import.
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && systemDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  
                  // Also set dynamic lang/dir from localStorage to prevent flash of wrong layout
                  var locale = localStorage.getItem('locale') || 'en';
                  document.documentElement.lang = locale;
                  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <NextTopLoader color="#9b59d0" height={3} showSpinner={false} />
        <I18nProvider initialLocale={locale}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

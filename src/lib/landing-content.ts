export type LandingLocale = "ar" | "en";

export const landingContent = {
  ar: {
    lang: "ar",
    dir: "rtl",
    nav: ["المنتج", "القنوات", "الأمان", "الأسعار"],
    login: "دخول",
    start: "ابدأ الآن",
    heroLabel: "منصة شات بوت عربية متعددة القنوات",
    title: "ChatZi لإدارة محادثات العملاء بالذكاء الاصطناعي",
    subtitle:
      "اربط موقعك وقنوات Telegram وWhatsApp وMessenger في منصة واحدة، واضبط نماذج AI لكل بوت مع عزل كامل لبيانات كل مستأجر.",
    primary: "إنشاء حساب",
    secondary: "عرض لوحة التحكم",
    stats: [
      ["5", "قنوات جاهزة"],
      ["RTL", "واجهة عربية"],
      ["AI", "نماذج متعددة"],
      ["24/7", "ردود تلقائية"]
    ],
    featuresTitle: "كل ما تحتاجه لتشغيل دعم ذكي",
    features: [
      ["إدارة متعددة المستأجرين", "كل شركة لها بوتات وقنوات ومحادثات معزولة بالكامل."],
      ["مكتبة نماذج AI", "الأدمن فقط يضيف مفاتيح ونماذج OpenAI أو النماذج المتوافقة."],
      ["Widget للموقع", "سكريبت واحد يضيف زر محادثة احترافي لأي موقع."],
      ["Webhook Logs", "تتبع أخطاء وربط القنوات الخارجية من لوحة واحدة."]
    ],
    channelsTitle: "قنوات فعلية وليست placeholders",
    channels: ["Website Widget", "Telegram Bot API", "WhatsApp Cloud API", "Facebook Messenger", "Generic Webhook"],
    securityTitle: "جاهز لبيئة إنتاج محترمة",
    security:
      "تشفير مفاتيح AI قبل حفظها، إخفاء المفاتيح في الواجهة، حماية NextAuth، عزل tenantId في كل استعلام، وصلاحيات Admin للعمليات الحساسة.",
    pricingTitle: "ابدأ بتشغيلك المحلي ثم انشر",
    pricing:
      "استخدم MongoDB محلي أو Atlas، أضف مفاتيح القنوات في البيئة، ثم انشر على Vercel أو VPS بدون الاعتماد على Tiledesk.",
    faqTitle: "أسئلة سريعة",
    faq: [
      ["هل يدعم العربية؟", "نعم، لوحة التحكم RTL والصفحة العامة تدعم العربية والإنجليزية."],
      ["هل أحتاج مفتاح OpenAI لكل بوت؟", "يمكن استخدام مفتاح عام من env أو مفاتيح خاصة يديرها الأدمن من لوحة Admin."],
      ["هل القنوات حقيقية؟", "نعم، توجد endpoints فعلية للربط مع Telegram وWhatsApp وMessenger والويب هوك."]
    ],
    footer: "ChatZi - منصة محادثات AI متعددة المستأجرين"
  },
  en: {
    lang: "en",
    dir: "ltr",
    nav: ["Product", "Channels", "Security", "Pricing"],
    login: "Sign in",
    start: "Start now",
    heroLabel: "Multi-channel AI chatbot platform",
    title: "ChatZi helps teams automate customer conversations",
    subtitle:
      "Connect your website, Telegram, WhatsApp, and Messenger in one tenant-safe workspace. Manage AI models and API keys with admin-only controls.",
    primary: "Create account",
    secondary: "Open dashboard",
    stats: [
      ["5", "Ready channels"],
      ["RTL", "Arabic UI"],
      ["AI", "Model library"],
      ["24/7", "Automated replies"]
    ],
    featuresTitle: "A practical stack for intelligent support",
    features: [
      ["Multi-tenant control", "Each company gets isolated bots, channels, conversations, and settings."],
      ["AI model library", "Admins manage OpenAI and compatible model credentials away from regular users."],
      ["Website widget", "One script adds a clean chat experience to any website."],
      ["Webhook logs", "Track external channel payloads, delivery state, and errors from the dashboard."]
    ],
    channelsTitle: "Real integrations, not placeholders",
    channels: ["Website Widget", "Telegram Bot API", "WhatsApp Cloud API", "Facebook Messenger", "Generic Webhook"],
    securityTitle: "Built for production-minded teams",
    security:
      "Encrypted AI keys, masked secrets, NextAuth protection, tenant-scoped queries, and admin-only access for sensitive operations.",
    pricingTitle: "Run locally, deploy cleanly",
    pricing:
      "Use local MongoDB or Atlas, add channel keys through environment variables, then deploy to Vercel or a VPS without Tiledesk.",
    faqTitle: "Quick questions",
    faq: [
      ["Does it support Arabic?", "Yes. The dashboard is RTL and the public website supports Arabic and English."],
      ["Do I need one OpenAI key per bot?", "You can use a global env key or admin-managed model credentials."],
      ["Are channels implemented?", "Yes. Telegram, WhatsApp, Messenger, website widget, and generic webhook endpoints are implemented."]
    ],
    footer: "ChatZi - Multi-tenant AI conversation platform"
  }
} as const;

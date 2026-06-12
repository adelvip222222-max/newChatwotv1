"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

const privacyCopy = {
  en: {
    title: "Privacy Policy",
    lastUpdated: "Last Updated: June 2026",
    sections: [
      ["1. Introduction", "Chatzi AI Solutions FZE LLC (\"Chatzi\", \"we\", \"our\", or \"us\") provides software solutions that enable businesses to manage customer communications, automate conversations, and operate AI-powered customer support across multiple communication channels. This Privacy Policy explains how we collect, use, store, and protect information when customers use our platform and services."],
      ["2. Information We Collect", "We may collect:\n• Account information such as name, email address, company name, and contact details.\n• Communication data exchanged through connected channels such as WhatsApp, Facebook Messenger, Instagram, Telegram, email, and other supported platforms.\n• Knowledge Base content uploaded by customers.\n• Usage and analytics information related to platform performance and service delivery.\n• Technical information including IP addresses, browser information, device information, and system logs."],
      ["3. How We Use Information", "We use collected information to:\n• Provide and maintain our services.\n• Deliver AI-powered customer support and automation features.\n• Improve platform functionality and performance.\n• Provide customer support and technical assistance.\n• Prevent abuse, fraud, unauthorized access, and security incidents.\n• Comply with applicable legal obligations."],
      ["4. Customer Data Ownership", "Customers retain ownership of their business data, messages, documents, and content uploaded to Chatzi. Chatzi acts as a technology service provider and processes customer data solely for the purpose of delivering the services requested by the customer."],
      ["5. Data Security", "We implement commercially reasonable technical and organizational measures to protect customer information from unauthorized access, disclosure, alteration, or destruction."],
      ["6. Third-Party Services", "Our platform may integrate with third-party services including Meta (Facebook, Instagram, WhatsApp), Telegram, OpenAI, Google services, and other providers selected by customers. Use of such services may be subject to their respective privacy policies and terms."],
      ["7. Data Retention", "We retain information only for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce agreements."],
      ["8. International Transfers", "Information may be processed and stored in jurisdictions outside the customer's country, including cloud infrastructure providers used to operate the service."],
      ["9. User Rights", "Customers may request access, correction, export, or deletion of their data, subject to applicable legal requirements."],
      ["10. Contact Information", "For privacy-related inquiries:\nChatzi AI Solutions FZE LLC\nWebsite: https://chatzi.io\nEmail: info@chatzi.io\nUnited Arab Emirates"],
      ["11. Changes", "We may update this Privacy Policy periodically. Updated versions will be posted on our website with a revised effective date."]
    ],
    back: "Back to registration"
  },
  ar: {
    title: "سياسة الخصوصية",
    lastUpdated: "آخر تحديث: يونيو ٢٠٢٦",
    sections: [
      ["١. مقدمة", "تقدم شركة Chatzi AI Solutions FZE LLC (\"Chatzi\" أو \"نحن\" أو \"لنا\") حلولاً برمجية تمكن الشركات من إدارة تواصل العملاء، أتمتة المحادثات، وتشغيل دعم العملاء المدعوم بالذكاء الاصطناعي عبر قنوات اتصال متعددة. توضح سياسة الخصوصية هذه كيف نقوم بجمع واستخدام وتخزين وحماية المعلومات عندما يستخدم العملاء منصتنا وخدماتنا."],
      ["٢. المعلومات التي نجمعها", "قد نجمع:\n• معلومات الحساب مثل الاسم، عنوان البريد الإلكتروني، اسم الشركة، وبيانات الاتصال.\n• بيانات الاتصال المتبادلة عبر القنوات المتصلة مثل واتساب، فيسبوك ماسنجر، إنستغرام، تليجرام، البريد الإلكتروني، والمنصات الأخرى المدعومة.\n• محتوى قاعدة المعرفة المرفوع من قبل العملاء.\n• معلومات الاستخدام والتحليلات المتعلقة بأداء المنصة وتقديم الخدمة.\n• المعلومات التقنية بما في ذلك عناوين IP، معلومات المتصفح، معلومات الجهاز، وسجلات النظام."],
      ["٣. كيف نستخدم المعلومات", "نستخدم المعلومات التي تم جمعها من أجل:\n• تقديم وصيانة خدماتنا.\n• توفير دعم العملاء المدعوم بالذكاء الاصطناعي وميزات الأتمتة.\n• تحسين وظائف المنصة وأدائها.\n• تقديم دعم العملاء والمساعدة التقنية.\n• منع سوء الاستخدام، الاحتيال، الوصول غير المصرح به، والحوادث الأمنية.\n• الامتثال للالتزامات القانونية المعمول بها."],
      ["٤. ملكية بيانات العملاء", "يحتفظ العملاء بملكية بيانات أعمالهم، رسائلهم، مستنداتهم، والمحتوى المرفوع إلى Chatzi. تعمل Chatzi كمزود خدمة تقنية وتقوم بمعالجة بيانات العملاء فقط لغرض تقديم الخدمات التي يطلبها العميل."],
      ["٥. أمن البيانات", "نحن نطبق تدابير تقنية وتنظيمية معقولة تجارياً لحماية معلومات العملاء من الوصول غير المصرح به، الكشف عنها، تعديلها، أو تدميرها."],
      ["٦. خدمات الأطراف الثالثة", "قد تتكامل منصتنا مع خدمات أطراف ثالثة بما في ذلك Meta (فيسبوك، إنستغرام، واتساب)، تليجرام، OpenAI، خدمات Google، ومزودين آخرين يختارهم العملاء. قد يخضع استخدام هذه الخدمات لسياسات الخصوصية والشروط الخاصة بها."],
      ["٧. الاحتفاظ بالبيانات", "نحتفظ بالمعلومات فقط للفترة اللازمة لتقديم الخدمات، الامتثال للالتزامات القانونية، حل النزاعات، وتنفيذ الاتفاقيات."],
      ["٨. النقل الدولي للبيانات", "قد تتم معالجة وتخزين المعلومات في ولايات قضائية خارج بلد العميل، بما في ذلك مزودي البنية التحتية السحابية المستخدمين لتشغيل الخدمة."],
      ["٩. حقوق المستخدم", "يجوز للعملاء طلب الوصول إلى بياناتهم، تصحيحها، تصديرها، أو حذفها، مع مراعاة المتطلبات القانونية المعمول بها."],
      ["١٠. معلومات الاتصال", "للاستفسارات المتعلقة بالخصوصية:\nChatzi AI Solutions FZE LLC\nالموقع الإلكتروني: https://chatzi.io\nالبريد الإلكتروني: info@chatzi.io\nالإمارات العربية المتحدة"],
      ["١١. التغييرات", "قد نقوم بتحديث سياسة الخصوصية هذه بشكل دوري. سيتم نشر الإصدارات المحدثة على موقعنا الإلكتروني مع تاريخ سريان معدل."]
    ],
    back: "العودة لصفحة التسجيل"
  }
} as const;

export function PrivacyContent() {
  const { locale, dir } = useI18n();
  const copy = privacyCopy[locale];

  return (
    <main dir={dir} className="theme-rescue min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-950 sm:p-8 md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">{copy.title}</h1>
          <p className="text-sm text-slate-500">{copy.lastUpdated}</p>
        </div>

        <div className="space-y-8">
          {copy.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="mb-3 text-xl font-bold text-slate-800">{heading}</h2>
              <div className="text-slate-600 whitespace-pre-line leading-relaxed">{body}</div>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-center dark:border-slate-800">
          <Link href="/register" className="font-semibold text-primary-600 hover:underline">
            {copy.back}
          </Link>
        </div>
      </article>
    </main>
  );
}

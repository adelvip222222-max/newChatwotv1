"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

const termsCopy = {
  en: {
    title: "Terms of Service",
    lastUpdated: "Last Updated: June 2026",
    sections: [
      ["1. Acceptance of Terms", "By accessing or using Chatzi services, you agree to be bound by these Terms of Service."],
      ["2. Services", "Chatzi provides software-as-a-service (SaaS) solutions that enable businesses to:\n• Manage customer communications.\n• Operate AI-powered customer support.\n• Connect and manage messaging channels.\n• Automate workflows and customer interactions.\n• Analyze and organize customer communication data."],
      ["3. Customer Responsibilities", "Customers agree to:\n• Provide accurate information.\n• Maintain the security of their accounts.\n• Use the platform in compliance with applicable laws and platform policies.\n• Obtain all necessary permissions required to communicate with end users."],
      ["4. Prohibited Activities", "Customers may not use Chatzi to:\n• Send spam or unsolicited communications.\n• Violate applicable laws or regulations.\n• Distribute malicious software.\n• Engage in fraudulent, deceptive, or abusive activities.\n• Infringe intellectual property rights."],
      ["5. Third-Party Platforms", "Chatzi integrates with third-party services including Meta platforms, WhatsApp Business Platform, Instagram, Facebook Messenger, Telegram, and other providers.\nAvailability of such integrations may depend on third-party policies and approvals."],
      ["6. Intellectual Property", "Chatzi retains all rights, title, and interest in its software, technology, trademarks, and related intellectual property.\nCustomers retain ownership of their business content and uploaded data."],
      ["7. Service Availability", "While we strive to maintain reliable service, Chatzi does not guarantee uninterrupted availability and may perform maintenance, upgrades, or modifications as necessary."],
      ["8. Limitation of Liability", "To the maximum extent permitted by law, Chatzi shall not be liable for indirect, incidental, consequential, special, or punitive damages arising from use of the platform."],
      ["9. Indemnification", "Customers agree to indemnify and hold harmless Chatzi from claims arising from misuse of the platform or violation of these Terms."],
      ["10. Termination", "We may suspend or terminate accounts that violate these Terms, applicable laws, or third-party platform requirements."],
      ["11. Governing Law", "These Terms shall be governed by the laws applicable within the United Arab Emirates."],
      ["12. Contact", "Chatzi AI Solutions FZE LLC\nWebsite: https://chatzi.io\nEmail: info@chatzi.io"]
    ],
    back: "Back to registration"
  },
  ar: {
    title: "شروط الخدمة",
    lastUpdated: "آخر تحديث: يونيو ٢٠٢٦",
    sections: [
      ["١. قبول الشروط", "بوصولك إلى خدمات Chatzi أو استخدامك لها، فإنك توافق على الالتزام بشروط الخدمة هذه."],
      ["٢. الخدمات", "تقدم Chatzi حلول برمجيات كخدمة (SaaS) تمكّن الشركات من:\n• إدارة تواصل العملاء.\n• تشغيل دعم العملاء المدعوم بالذكاء الاصطناعي.\n• ربط وإدارة قنوات المراسلة.\n• أتمتة مسارات العمل وتفاعلات العملاء.\n• تحليل وتنظيم بيانات تواصل العملاء."],
      ["٣. مسؤوليات العميل", "يوافق العملاء على:\n• تقديم معلومات دقيقة.\n• الحفاظ على أمان حساباتهم.\n• استخدام المنصة بما يتوافق مع القوانين المعمول بها وسياسات المنصة.\n• الحصول على جميع الأذونات اللازمة المطلوبة للتواصل مع المستخدمين النهائيين."],
      ["٤. الأنشطة المحظورة", "لا يجوز للعملاء استخدام Chatzi في:\n• إرسال رسائل مزعجة أو اتصالات غير مرغوب فيها.\n• انتهاك القوانين أو اللوائح المعمول بها.\n• توزيع برامج ضارة.\n• الانخراط في أنشطة احتيالية أو خادعة أو مسيئة.\n• التعدي على حقوق الملكية الفكرية."],
      ["٥. منصات الأطراف الثالثة", "تتكامل Chatzi مع خدمات أطراف ثالثة بما في ذلك منصات Meta، ومنصة WhatsApp Business، وInstagram، وFacebook Messenger، وTelegram، ومزودين آخرين.\nقد يعتمد توفر هذه التكاملات على سياسات وموافقات الأطراف الثالثة."],
      ["٦. الملكية الفكرية", "تحتفظ Chatzi بجميع الحقوق والملكية والمصالح في برمجياتها وتقنياتها وعلاماتها التجارية والملكية الفكرية ذات الصلة.\nيحتفظ العملاء بملكية محتوى أعمالهم والبيانات المرفوعة."],
      ["٧. توفر الخدمة", "على الرغم من سعينا للحفاظ على خدمة موثوقة، لا تضمن Chatzi توفراً مستمراً وقد تقوم بإجراء أعمال صيانة أو ترقيات أو تعديلات حسب الضرورة."],
      ["٨. تحديد المسؤولية", "إلى أقصى حد يسمح به القانون، لن تكون Chatzi مسؤولة عن أي أضرار غير مباشرة أو عرضية أو تبعية أو خاصة أو تأديبية تنشأ عن استخدام المنصة."],
      ["٩. التعويض", "يوافق العملاء على تعويض وحماية Chatzi من أي مطالبات تنشأ عن سوء استخدام المنصة أو انتهاك هذه الشروط."],
      ["١٠. إنهاء الخدمة", "قد نقوم بتعليق أو إنهاء الحسابات التي تنتهك هذه الشروط أو القوانين المعمول بها أو متطلبات منصات الأطراف الثالثة."],
      ["١١. القانون المطبق", "تخضع هذه الشروط للقوانين المعمول بها في دولة الإمارات العربية المتحدة."],
      ["١٢. معلومات الاتصال", "Chatzi AI Solutions FZE LLC\nالموقع الإلكتروني: https://chatzi.io\nالبريد الإلكتروني: info@chatzi.io"]
    ],
    back: "العودة لصفحة التسجيل"
  }
} as const;

export function TermsContent() {
  const { locale, dir } = useI18n();
  const copy = termsCopy[locale];

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

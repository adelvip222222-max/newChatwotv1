"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

const deletionCopy = {
  en: {
    title: "User Data Deletion Instructions",
    lastUpdated: "Last Updated: June 2026",
    sections: [
      ["Data Deletion Request", "At Chatzi AI Solutions FZE LLC, we respect users' privacy and their right to control their personal data.\nIf you would like to request the deletion of your personal information or data associated with your use of Chatzi services, please contact us using one of the methods below."],
      ["How to Request Data Deletion", "Send an email to:\ninfo@chatzi.io\n\nwith the subject:\nData Deletion Request\n\nPlease include:\n• Your full name\n• Your email address\n• Your company name (if applicable)\n• A description of the data you would like deleted"],
      ["What Happens Next", "Upon receiving your request, we may verify your identity to protect your information from unauthorized access or deletion.\nOnce verified, we will review your request and delete eligible personal data within a reasonable period, unless we are legally required to retain certain information."],
      ["Data That May Be Retained", "Certain information may be retained where required by:\n• Applicable laws and regulations\n• Fraud prevention and security requirements\n• Contractual obligations\n• Financial or tax recordkeeping requirements"],
      ["Third-Party Services", "If your data has been processed through third-party services connected to Chatzi (including Meta, WhatsApp, Facebook, Instagram, Telegram, Google services, or other providers), you may also need to contact those providers directly regarding data stored within their systems."],
      ["Contact Information", "Chatzi AI Solutions FZE LLC\nWebsite: https://chatzi.io\nEmail: info@chatzi.io"]
    ],
    back: "Back to registration"
  },
  ar: {
    title: "تعليمات حذف بيانات المستخدم",
    lastUpdated: "آخر تحديث: يونيو ٢٠٢٦",
    sections: [
      ["طلب حذف البيانات", "في Chatzi AI Solutions FZE LLC، نحن نحترم خصوصية المستخدمين وحقهم في التحكم في بياناتهم الشخصية.\nإذا كنت ترغب في طلب حذف معلوماتك الشخصية أو البيانات المرتبطة باستخدامك لخدمات Chatzi، يرجى الاتصال بنا باستخدام إحدى الطرق أدناه."],
      ["كيفية طلب حذف البيانات", "أرسل بريداً إلكترونياً إلى:\ninfo@chatzi.io\n\nمع العنوان:\nطلب حذف بيانات\n\nيرجى تضمين:\n• اسمك الكامل\n• عنوان بريدك الإلكتروني\n• اسم شركتك (إن وجد)\n• وصفاً للبيانات التي ترغب في حذفها"],
      ["ماذا يحدث بعد ذلك", "عند استلام طلبك، قد نقوم بالتحقق من هويتك لحماية معلوماتك من الوصول أو الحذف غير المصرح به.\nبمجرد التحقق، سنقوم بمراجعة طلبك وحذف البيانات الشخصية المؤهلة خلال فترة معقولة، ما لم نكن ملزمين قانونياً بالاحتفاظ بمعلومات معينة."],
      ["البيانات التي قد يتم الاحتفاظ بها", "قد يتم الاحتفاظ ببعض المعلومات عند الاقتضاء بموجب:\n• القوانين واللوائح المعمول بها\n• متطلبات منع الاحتيال والأمن\n• الالتزامات التعاقدية\n• متطلبات حفظ السجلات المالية أو الضريبية"],
      ["خدمات الأطراف الثالثة", "إذا تمت معالجة بياناتك من خلال خدمات أطراف ثالثة متصلة بـ Chatzi (بما في ذلك Meta، وWhatsApp، وFacebook، وInstagram، وTelegram، وخدمات Google، أو مزودين آخرين)، فقد تحتاج أيضاً إلى الاتصال بهؤلاء المزودين مباشرةً بخصوص البيانات المخزنة داخل أنظمتهم."],
      ["معلومات الاتصال", "Chatzi AI Solutions FZE LLC\nالموقع الإلكتروني: https://chatzi.io\nالبريد الإلكتروني: info@chatzi.io"]
    ],
    back: "العودة لصفحة التسجيل"
  }
} as const;

export function DeletionContent() {
  const { locale, dir } = useI18n();
  const copy = deletionCopy[locale];

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

"use client";
import Link from "next/link";

import { useEffect, useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserPlus, Upload, FileSpreadsheet, Download, CheckCircle2, Loader2, ArrowLeft, Store, Stethoscope, Building2, TerminalSquare, Lightbulb, Globe, AlignLeft, Briefcase, Mic, X, MessageCircle, Users } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getDefaultIndustryKnowledgeDocuments, getDefaultIndustryLabel, type DefaultIndustryId } from "@/lib/knowledge-default-templates";

type Industry = DefaultIndustryId | null;

const INDUSTRIES: { id: Industry; icon: React.ReactNode; template?: string }[] = [
  { id: "ecommerce", icon: <Store size={24} />, template: "ecommerce-template.xlsx" },
  { id: "medical", icon: <Stethoscope size={24} />, template: "medical-template.xlsx" },
  { id: "realestate", icon: <Building2 size={24} />, template: "realestate-template.xlsx" },
  { id: "tech", icon: <TerminalSquare size={24} />, template: "tech-solutions-template.xlsx" },
  { id: "other", icon: <Lightbulb size={24} /> }
];

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [botId, setBotId] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const { t, locale, setLocale } = useI18n();

  // Step 2 State
  const [industry, setIndustry] = useState<Industry>(null);
  const [file, setFile] = useState<File | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companyProfile, setCompanyProfile] = useState("");
  const [servicesDesc, setServicesDesc] = useState("");
  const [defaultKnowledgeSeeded, setDefaultKnowledgeSeeded] = useState(false);
  
  // Step 3 State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((response) => response.json())
      .then((providers) => setGoogleEnabled(Boolean(providers?.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  function formatRegisterError(message: string) {
    if (/password/i.test(message) && /12/.test(message)) {
      return locale === "ar"
        ? "كلمة المرور يجب أن تكون 12 حرفا على الأقل وتحتوي على حرف كبير وحرف صغير ورقم."
        : "Password must be at least 12 characters and include uppercase, lowercase, and a number.";
    }
    return message;
  }

  async function onRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      tenantName: form.get("tenantName")
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(formatRegisterError(data.error || t.errors.serverError));
        setLoading(false);
        return;
      }

      await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        redirect: false
      });

      if (data.botId) {
        setBotId(data.botId);
        setStep(2);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(t.auth.unexpectedError);
    } finally {
      setLoading(false);
    }
  }

  async function onUploadKnowledge(options?: { seedOnly?: boolean }) {
    if (!botId) return;
    setLoading(true);
    setError("");

    const selectedIndustry = industry || "other";
    const selectedIndustryLabel = getDefaultIndustryLabel(selectedIndustry, locale === "ar" ? "ar" : "en");

    const postData = async (formData: FormData) => {
      formData.append("botId", botId);
      formData.append("collectionName", "عام");
      const res = await fetch("/api/knowledge", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error || t.auth.linkError);
    };

    const postTextKnowledge = async (payload: {
      title: string;
      sourceType: "custom_text";
      categoryName: string;
      text: string;
      tags?: string[];
    }) => {
      const fd = new FormData();
      fd.append("title", payload.title);
      fd.append("sourceType", payload.sourceType);
      fd.append("categoryName", payload.categoryName);
      fd.append("text", payload.text);
      fd.append("tags", ["onboarding", selectedIndustry, ...(payload.tags || [])].join(","));
      await postData(fd);
    };

    try {
      // Always seed a safe baseline knowledge package for the selected template.
      // This gives the bot an immediate business scope and roughly half-ready KB
      // before the owner adds detailed products, prices, policies, or FAQs.
      if (!defaultKnowledgeSeeded) {
        const defaultDocs = getDefaultIndustryKnowledgeDocuments(selectedIndustry);
        for (const doc of defaultDocs) {
          await postTextKnowledge({
            title: `${doc.title} — ${selectedIndustryLabel}`,
            sourceType: doc.sourceType,
            categoryName: doc.categoryName,
            text: doc.text,
            tags: doc.tags,
          });
        }
        setDefaultKnowledgeSeeded(true);
      }

      if (!options?.seedOnly) {
        if (file) {
          const fd = new FormData();
          fd.append("title", `بيانات مجمعة (${file.name})`);
          fd.append("sourceType", "excel");
          fd.append("categoryName", "البيانات الأساسية");
          fd.append("tags", ["onboarding", selectedIndustry, "uploaded-template"].join(","));
          fd.append("file", file);
          await postData(fd);
        }

        if (websiteUrl.trim()) {
          const fd = new FormData();
          fd.append("title", "الموقع الإلكتروني الرسمي");
          fd.append("sourceType", "website");
          fd.append("categoryName", "الروابط");
          fd.append("tags", ["onboarding", selectedIndustry, "website"].join(","));
          fd.append("sourceUrl", websiteUrl.trim());
          await postData(fd);
        }

        if (companyProfile.trim()) {
          await postTextKnowledge({
            title: "نبذة عن النشاط التجاري",
            sourceType: "custom_text",
            categoryName: "معلومات الشركة",
            text: companyProfile.trim(),
            tags: ["company-profile"],
          });
        }

        if (servicesDesc.trim()) {
          await postTextKnowledge({
            title: "الخدمات والسياسات",
            sourceType: "custom_text",
            categoryName: "الخدمات",
            text: servicesDesc.trim(),
            tags: ["services", "policies"],
          });
        }
      }

      setStep(3);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.uploadError);
      setLoading(false);
    }
  }

  function handleSkipKnowledge() {
    void onUploadKnowledge({ seedOnly: true });
  }

  function handleActivationContinue() {
    if (!phoneNumber.trim() || !emailCode.trim() || !phoneCode.trim()) {
      setError(locale === "ar" ? "التفعيل مطلوب قبل المتابعة. أدخل رقم الهاتف وكود تفعيل البريد وكود تفعيل الهاتف." : "Activation is required before continuing. Enter phone number, email activation code, and phone activation code.");
      return;
    }
    setError("");
    setStep(4);
  }

  function finishOnboarding() {
    router.push("/dashboard");
    router.refresh();
  }

  const renderProgress = () => {
    const steps = [
      locale === "ar" ? "التسجيل" : "Register",
      locale === "ar" ? "القوالب" : "Templates",
      locale === "ar" ? "التفعيل" : "Activation",
      locale === "ar" ? "القنوات" : "Channels",
      locale === "ar" ? "الموظفون" : "AI agents"
    ];
    return (
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {steps.map((label, index) => {
          const active = step === index + 1;
          const done = step > index + 1;
          return (
            <span key={label} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${active ? "bg-primary-600 text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {index + 1}. {label}
            </span>
          );
        })}
      </div>
    );
  };

  const renderStep = () => {
    if (step === 5) {
      return (
        <div className="panel w-full max-w-lg p-6 md:p-8">
          {renderProgress()}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 shadow-sm ring-4 ring-primary-50">
              <Users size={24} />
            </div>
            <h1 className="text-2xl font-bold text-ink">{locale === "ar" ? "إضافة الموظفين الآليين" : "Add AI employees"}</h1>
            <p className="mt-2 text-sm text-accent leading-relaxed">
              {locale === "ar" ? "يمكنك إنشاء موظف مبيعات، دعم فني، حجز أو فواتير الآن، أو تخطي الخطوة والعودة لها لاحقًا." : "Create sales, support, booking, or billing AI employees now, or skip and return later."}
            </p>
          </div>
          <div className="grid gap-3">
            <a href="/dashboard/personas/new" className="btn-primary w-full justify-center">
              <Users size={18} />
              {locale === "ar" ? "إضافة موظف آلي" : "Add AI employee"}
            </a>
            <button type="button" onClick={finishOnboarding} className="btn-secondary w-full justify-center">
              {locale === "ar" ? "تخطي وإنهاء" : "Skip and finish"}
            </button>
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="panel w-full max-w-lg p-6 md:p-8">
          {renderProgress()}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 shadow-sm ring-4 ring-primary-50">
              <MessageCircle size={24} />
            </div>
            <h1 className="text-2xl font-bold text-ink">{locale === "ar" ? "ربط القنوات" : "Connect channels"}</h1>
            <p className="mt-2 text-sm text-accent leading-relaxed">
              {locale === "ar" ? "اربط WhatsApp أو Messenger أو Instagram الآن، أو تخطَ هذه الخطوة مؤقتًا." : "Connect WhatsApp, Messenger, or Instagram now, or skip this step for now."}
            </p>
          </div>
          <div className="grid gap-3">
            <Link href="/dashboard/channels" className="btn-primary w-full justify-center">
              <MessageCircle size={18} />
              {locale === "ar" ? "فتح صفحة القنوات" : "Open channels page"}
            </Link>
            <button type="button" onClick={() => setStep(5)} className="btn-secondary w-full justify-center">
              {locale === "ar" ? "تخطي القنوات" : "Skip channels"}
            </button>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
      <div className="panel w-full max-w-lg p-6 md:p-8">
        {renderProgress()}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 shadow-sm ring-4 ring-primary-50">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-ink">{t.auth.step3Title}</h1>
          <p className="mt-2 text-sm text-accent leading-relaxed">
            {t.auth.step3Subtitle}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t.auth.phoneLabel}</label>
            <input 
              type="tel"
              className="field" 
              placeholder="+201234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">{t.auth.emailCodeLabel}</label>
            <input 
              type="text"
              className="field" 
              placeholder="123456"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t.auth.phoneCodeLabel}</label>
            <input 
              type="text"
              className="field" 
              placeholder="123456"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button 
            onClick={handleActivationContinue} 
            className="btn-primary w-full"
          >
            <CheckCircle2 size={18} />
            {t.auth.finishButton}
          </button>
          
          <p className="rounded-lg bg-amber-50 p-3 text-center text-xs font-semibold text-amber-700">
            {locale === "ar" ? "هذه الخطوة إجبارية قبل ربط القنوات. يمكن لاحقًا استبدالها بخدمة OTP فعلية." : "This step is required before connecting channels. It can later be wired to a real OTP provider."}
          </p>
        </div>
      </div>
      );
    }

    if (step === 2) {
      const selectedObj = INDUSTRIES.find(i => i.id === industry);
      
      return (
      <div className="panel w-full max-w-2xl p-6 md:p-8">
        {renderProgress()}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 shadow-sm ring-4 ring-primary-50">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-ink">{t.auth.step2Success}</h1>
          <p className="mt-2 text-sm text-accent leading-relaxed">
            {t.auth.step2Subtitle}
          </p>
          <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold leading-relaxed text-emerald-700">
            {locale === "ar"
              ? "عند اختيار القالب سنضيف تلقائيًا معرفة عامة آمنة تغطي قرابة نصف احتياجات البوت كبداية، ثم يمكنك إكمالها بملفك أو موقعك أو وصف نشاطك."
              : "When you choose a template, we automatically seed a safe baseline knowledge package that covers about half of the bot setup, then you can enrich it with your file, website, or business description."}
          </p>
        </div>

        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-100">{error}</p> : null}

        {/* Industry Selector */}
        <div className="mb-6">
          <label className="mb-3 block text-sm font-semibold text-slate-800">{t.auth.step2Field1}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {INDUSTRIES.map((ind) => {
              const indKey = ind.id as keyof typeof t.auth.industries;
              const tr = t.auth.industries[indKey] || { title: "", desc: "" };
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => setIndustry(ind.id)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all ${
                    industry === ind.id 
                      ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-500" 
                      : "border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:bg-slate-50"
                  }`}
                >
                  <div className={industry === ind.id ? "text-primary-600" : "text-slate-400"}>
                    {ind.icon}
                  </div>
                  <div>
                    <span className="block text-sm font-bold">{tr.title}</span>
                    <span className="mt-1 block text-[10px] text-slate-500">{tr.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {industry && (
          <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
            <h3 className="font-semibold text-slate-800 border-b pb-3 text-sm">
              {t.auth.step2Field2}
            </h3>

            {/* Template Download & File Upload */}
            {selectedObj?.template && (
              <div className="flex flex-col gap-3 rounded-lg bg-white p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.auth.excelTemplate}</p>
                    <p className="text-xs text-slate-500 mt-1">{t.auth.excelTemplateHint}</p>
                  </div>
                  <a
                    href={`/templates/${selectedObj.template}`}
                    download
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                  >
                    <Download size={14} />
                    {t.auth.excelTemplateDownload}
                  </a>
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed py-4 transition-colors ${
                    file ? "border-primary-400 bg-primary-50/50" : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" accept=".xlsx,.xls,.csv" />
                  {file ? (
                    <div className="text-center">
                      <FileSpreadsheet size={20} className="mx-auto text-primary-600 mb-1" />
                      <p className="text-xs font-medium text-primary-900" dir="ltr">{file.name}</p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500">
                      <Upload size={20} className="mx-auto mb-1 opacity-50" />
                      <span className="text-xs font-medium">{t.auth.excelTemplateUpload}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manual Text Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Globe size={14} className="text-slate-400" />
                  {t.auth.websiteUrl}
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  className="field text-sm"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <AlignLeft size={14} className="text-slate-400" />
                  {t.auth.companyDescription}
                </label>
                <textarea
                  rows={2}
                  placeholder="..."
                  className="field text-sm resize-none"
                  value={companyProfile}
                  onChange={(e) => setCompanyProfile(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Briefcase size={14} className="text-slate-400" />
                  {t.auth.servicesDescription}
                </label>
                <textarea
                  rows={3}
                  placeholder="..."
                  className="field text-sm resize-none"
                  value={servicesDesc}
                  onChange={(e) => setServicesDesc(e.target.value)}
                />
              </div>
            </div>

          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button 
            onClick={onUploadKnowledge} 
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {loading ? t.auth.processing : t.auth.saveContinueButton}
          </button>
          
          <button 
            onClick={handleSkipKnowledge}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            {loading
              ? t.auth.processing
              : locale === "ar"
                ? "استخدام البيانات الافتراضية والمتابعة"
                : "Use default knowledge and continue"}
            <ArrowLeft size={16} className="rtl:rotate-0 rotate-180" />
          </button>
        </div>
      </div>
      );
    }

    return (
      <form onSubmit={onRegisterSubmit} className="w-full">
        {renderProgress()}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">{t.auth.registerTitle}</h1>
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="text-xs font-semibold text-accent border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {locale === "en" ? "العربية" : "English"}
          </button>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-100">{error}</p> : null}

        {googleEnabled ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-bold text-[#4285f4]">G</span>
              {locale === "ar" ? "المتابعة باستخدام Google" : "Continue with Google"}
            </button>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400">{locale === "ar" ? "أو" : "or"}</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        ) : null}
        
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1" htmlFor="name">{t.auth.nameLabel}</label>
            <input className="w-full border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none transition-colors" id="name" name="name" placeholder={t.auth.nameLabel} required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1" htmlFor="tenantName">{t.auth.companyLabel}</label>
            <input className="w-full border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none transition-colors" id="tenantName" name="tenantName" placeholder={t.auth.companyLabel} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 font-semibold mb-1" htmlFor="email">{t.auth.emailLabel}</label>
            <input className="w-full border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none transition-colors" id="email" name="email" type="email" placeholder={t.auth.emailLabel} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 font-semibold mb-1" htmlFor="password">{t.auth.passwordLabel}</label>
            <input
              className="w-full border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none transition-colors"
              id="password"
              name="password"
              type="password"
              placeholder={t.auth.passwordLabel}
              minLength={12}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}"
              title={locale === "ar" ? "12 حرفا على الأقل مع حرف كبير وحرف صغير ورقم" : "At least 12 characters with uppercase, lowercase, and a number"}
              required
            />
            <p className="mt-2 text-xs text-slate-400">
              {locale === "ar" ? "12 حرفا على الأقل مع حرف كبير وحرف صغير ورقم." : "At least 12 characters with uppercase, lowercase, and a number."}
            </p>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <input 
              type="checkbox" 
              id="terms" 
              name="terms" 
              required 
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-1 border-slate-300 text-primary-600 focus:ring-primary-500 rounded cursor-pointer" 
            />
            <label htmlFor="terms" className="text-xs text-slate-500 cursor-pointer select-none">
              {locale === "en" ? "I agree to the " : "أوافق على "}
              <a href="/terms" className="text-slate-800 hover:text-primary-600 hover:underline" target="_blank" onClick={(e) => e.stopPropagation()}>
                {locale === "en" ? "Terms and Conditions" : "شروط الخدمة"}
              </a>
            </label>
          </div>
          <div className="flex items-start gap-2">
            <input 
              type="checkbox" 
              id="privacy" 
              name="privacy" 
              required 
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-1 border-slate-300 text-primary-600 focus:ring-primary-500 rounded cursor-pointer" 
            />
            <label htmlFor="privacy" className="text-xs text-slate-500 cursor-pointer select-none">
              {locale === "en" ? "I agree to the " : "أقر بموافقتي على "}
              <a href="/privacy" className="text-slate-800 hover:text-primary-600 hover:underline" target="_blank" onClick={(e) => e.stopPropagation()}>
                {locale === "en" ? "Privacy Policy" : "سياسة الخصوصية"}
              </a>
            </label>
          </div>
        </div>
        
        <button 
          className="w-full md:w-auto px-10 py-3 rounded-md bg-[#b87cff] text-white font-bold tracking-wide hover:bg-[#a662f5] transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed" 
          disabled={!agreedTerms || !agreedPrivacy || loading}
        >
          {loading ? <Loader2 size={18} className="animate-spin inline mr-2" /> : null}
          {loading ? t.auth.registering : (locale === "en" ? "Register" : "إنشاء حساب")}
        </button>
        
        <div className="mt-6 text-sm text-slate-500">
          {locale === "en" ? "Already a member? " : "لديك حساب بالفعل؟ "}
          <a href="/login" className="text-[#b87cff] hover:underline font-semibold transition">
            {locale === "en" ? "Login" : "تسجيل الدخول"}
          </a>
        </div>
      </form>
    );
  };

  return (
    <div className="theme-rescue relative z-10 flex min-h-[600px] w-full max-w-[1000px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[30px] md:flex-row">
      {/* Left Panel */}
      <div className="w-full md:w-5/12 bg-[#31334c] p-10 text-white flex flex-col justify-center relative">
        <div className="mb-12 flex items-center gap-3">
          <img src="/images/logo.png" alt="ChatZi Logo" className="h-10" />
        </div>
        <h2 className="text-4xl font-bold mb-6 text-white leading-tight">
          {locale === "en" ? "Start our journey" : "ابدأ رحلتنا"}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-sm">
          {locale === "en" 
            ? "Join ChatZi today and revolutionize the way you communicate with your customers. Experience the power of omnichannel AI to build better relationships."
            : "انضم إلى منصة ChatZi اليوم وطوّر طريقة تواصلك مع عملائك لتجربة استثنائية وبناء علاقات أفضل من خلال الذكاء الاصطناعي."}
        </p>
      </div>
      
      {/* Right Panel */}
      <div className="w-full md:w-7/12 p-8 md:p-14 flex flex-col justify-center">
        {renderStep()}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserPlus, Upload, FileSpreadsheet, Download, CheckCircle2, Loader2, ArrowLeft, Store, Stethoscope, Building2, TerminalSquare, Lightbulb, Globe, AlignLeft, Briefcase, Mic, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Industry = "ecommerce" | "medical" | "realestate" | "tech" | "other" | null;

const INDUSTRIES: { id: Industry; icon: React.ReactNode; template?: string }[] = [
  { id: "ecommerce", icon: <Store size={24} />, template: "ecommerce-template.xlsx" },
  { id: "medical", icon: <Stethoscope size={24} />, template: "medical-template.xlsx" },
  { id: "realestate", icon: <Building2 size={24} />, template: "realestate-template.xlsx" },
  { id: "tech", icon: <TerminalSquare size={24} />, template: "tech-solutions-template.xlsx" },
  { id: "other", icon: <Lightbulb size={24} /> }
];

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [botId, setBotId] = useState("");
  const { t, locale, setLocale } = useI18n();

  // Step 2 State
  const [industry, setIndustry] = useState<Industry>(null);
  const [file, setFile] = useState<File | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companyProfile, setCompanyProfile] = useState("");
  const [servicesDesc, setServicesDesc] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setError(data.error || t.errors.serverError);
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

  async function onUploadKnowledge() {
    if (!botId) return;
    setLoading(true);
    setError("");

    const postData = async (formData: FormData) => {
      formData.append("botId", botId);
      formData.append("collectionName", "عام");
      const res = await fetch("/api/knowledge", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error || t.auth.linkError);
    };

    try {
      if (file) {
        const fd = new FormData();
        fd.append("title", `بيانات مجمعة (${file.name})`);
        fd.append("sourceType", "excel");
        fd.append("categoryName", "البيانات الأساسية");
        fd.append("file", file);
        await postData(fd);
      }

      if (websiteUrl.trim()) {
        const fd = new FormData();
        fd.append("title", "الموقع الإلكتروني الرسمي");
        fd.append("sourceType", "website");
        fd.append("categoryName", "الروابط");
        fd.append("sourceUrl", websiteUrl.trim());
        await postData(fd);
      }

      if (companyProfile.trim()) {
        const fd = new FormData();
        fd.append("title", "نبذة عن النشاط التجاري");
        fd.append("sourceType", "custom_text");
        fd.append("categoryName", "معلومات الشركة");
        fd.append("text", companyProfile.trim());
        await postData(fd);
      }

      if (servicesDesc.trim()) {
        const fd = new FormData();
        fd.append("title", "الخدمات والسياسات");
        fd.append("sourceType", "custom_text");
        fd.append("categoryName", "الخدمات");
        fd.append("text", servicesDesc.trim());
        await postData(fd);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.uploadError);
      setLoading(false);
    }
  }

  function handleSkip() {
    router.push("/dashboard");
    router.refresh();
  }

  if (step === 2) {
    const selectedObj = INDUSTRIES.find(i => i.id === industry);
    
    return (
      <div className="panel w-full max-w-2xl p-6 md:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 shadow-sm ring-4 ring-primary-50">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-ink">{t.auth.step2Success}</h1>
          <p className="mt-2 text-sm text-accent leading-relaxed">
            {t.auth.step2Subtitle}
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
            onClick={handleSkip}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            {t.auth.skipButton}
            <ArrowLeft size={16} className="rtl:rotate-0 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onRegisterSubmit} className="panel w-full max-w-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm font-semibold text-accent">ChatZi</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">{t.auth.registerTitle}</h1>
        </div>
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          className="text-xs font-semibold text-accent border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          {locale === "en" ? "العربية" : "English"}
        </button>
      </div>
      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-100">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{t.auth.nameLabel}</label>
          <input className="field" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="tenantName">{t.auth.companyLabel}</label>
          <input className="field" id="tenantName" name="tenantName" required />
        </div>
        <div>
          <label className="label" htmlFor="email">{t.auth.emailLabel}</label>
          <input className="field" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.passwordLabel}</label>
          <input className="field" id="password" name="password" type="password" minLength={8} required />
        </div>
      </div>
      <button className="btn-primary mt-6 w-full" disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
        {loading ? t.auth.registering : t.auth.registerButton}
      </button>
      <a href="/login" className="mt-4 block text-center text-sm font-medium text-accent hover:text-primary-600 transition">
        {t.auth.alreadyHaveAccount}
      </a>
    </form>
  );
}

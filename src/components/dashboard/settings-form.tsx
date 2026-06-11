"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import { UserRound, Building2, Lock, Palette, Languages, Loader2 } from "lucide-react";

interface SettingsFormProps {
  initialData: {
    userName: string;
    userEmail: string;
    tenantName: string;
    userRole: string;
  };
}

export function SettingsForm({ initialData }: SettingsFormProps) {
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isAr = locale === "ar";
  
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantMsg, setTenantMsg] = useState({ type: "", text: "" });

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: "", text: "" });
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      currentPassword: formData.get("currentPassword") || undefined,
      newPassword: formData.get("newPassword") || undefined,
    };

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setProfileMsg({ type: "success", text: result.message });
      router.refresh();
      (e.target as HTMLFormElement).reset(); // clear passwords
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleTenantSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTenantSaving(true);
    setTenantMsg({ type: "", text: "" });
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/settings/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("tenantName") })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setTenantMsg({ type: "success", text: result.message });
      router.refresh();
    } catch (err: any) {
      setTenantMsg({ type: "error", text: err.message });
    } finally {
      setTenantSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <div className="panel overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="flex items-center gap-2 font-bold text-ink">
            <UserRound size={18} className="text-indigo-600 dark:text-indigo-400" />
            {isAr ? "إعدادات الحساب الشخصي" : "Personal Account Settings"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr ? "قم بتحديث بياناتك الشخصية وكلمة المرور" : "Update your personal information and password"}
          </p>
        </div>
        <div className="p-5">
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? "الاسم الكامل" : "Full Name"}
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={initialData.userName}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? "البريد الإلكتروني" : "Email Address"}
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={initialData.userEmail}
                  required
                  className="input-field"
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <Lock size={16} />
                {isAr ? "تغيير كلمة المرور (اختياري)" : "Change Password (Optional)"}
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isAr ? "كلمة المرور الحالية" : "Current Password"}
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isAr ? "كلمة المرور الجديدة" : "New Password"}
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    minLength={8}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {profileMsg.text && (
              <div className={`mt-2 rounded-md p-3 text-sm ${profileMsg.type === "error" ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                {profileMsg.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button disabled={profileSaving} type="submit" className="btn-primary w-full md:w-auto">
                {profileSaving && <Loader2 size={16} className="animate-spin ltr:mr-2 rtl:ml-2" />}
                {isAr ? "حفظ التعديلات" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Tenant Settings */}
      {(initialData.userRole === "admin" || initialData.userRole === "owner") && (
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="flex items-center gap-2 font-bold text-ink">
              <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
              {isAr ? "إعدادات الشركة / مساحة العمل" : "Workspace Settings"}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isAr ? "إدارة إعدادات الشركة (متاحة للمشرفين فقط)" : "Manage workspace settings (Admins only)"}
            </p>
          </div>
          <div className="p-5">
            <form onSubmit={handleTenantSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? "اسم الشركة" : "Workspace Name"}
                </label>
                <input
                  type="text"
                  name="tenantName"
                  defaultValue={initialData.tenantName}
                  required
                  className="input-field max-w-md"
                />
              </div>

              {tenantMsg.text && (
                <div className={`mt-2 max-w-md rounded-md p-3 text-sm ${tenantMsg.type === "error" ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"}`}>
                  {tenantMsg.text}
                </div>
              )}

              <div className="flex pt-2">
                <button disabled={tenantSaving} type="submit" className="btn-primary w-full md:w-auto">
                  {tenantSaving && <Loader2 size={16} className="animate-spin ltr:mr-2 rtl:ml-2" />}
                  {isAr ? "تحديث اسم الشركة" : "Update Workspace Name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Preferences */}
      <div className="panel overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="flex items-center gap-2 font-bold text-ink">
            <Palette size={18} className="text-indigo-600 dark:text-indigo-400" />
            {isAr ? "المظهر واللغة" : "Appearance & Language"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr ? "تخصيص تجربة المستخدم" : "Customize your user experience"}
          </p>
        </div>
        <div className="p-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Languages size={16}/>
                {isAr ? "لغة الواجهة" : "Interface Language"}
              </label>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setLocale("ar"); router.refresh(); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${locale === 'ar' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  العربية
                </button>
                <button 
                  onClick={() => { setLocale("en"); router.refresh(); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${locale === 'en' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  English
                </button>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Palette size={16}/>
                {isAr ? "المظهر العام" : "Theme"}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "light", label: isAr ? "مضيء" : "Light" },
                  { id: "dark", label: isAr ? "داكن" : "Dark" },
                  { id: "system", label: isAr ? "النظام" : "System" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id as "light" | "dark" | "system")}
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      theme === option.id
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? `الوضع النشط الآن: ${resolvedTheme === "dark" ? "داكن" : "مضيء"}`
                  : `Currently applied: ${resolvedTheme === "dark" ? "Dark" : "Light"}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

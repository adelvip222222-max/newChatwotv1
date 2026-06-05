"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Star, ToggleLeft, ToggleRight, Sparkles, Cpu, Globe } from "lucide-react";

type AiModelRow = {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  isDefault: boolean;
  isActive: boolean;
  hasApiKey: boolean;
};

// ── Provider presets ──────────────────────────────────────────────────────────
const PRESETS = [
  {
    label: "Gemini 2.0 Flash",
    icon: "✨",
    payload: { name: "Gemini 2.0 Flash", provider: "google-gemini", model: "gemini-2.0-flash", baseUrl: "" },
  },
  {
    label: "Gemini 1.5 Pro",
    icon: "🧠",
    payload: { name: "Gemini 1.5 Pro", provider: "google-gemini", model: "gemini-1.5-pro", baseUrl: "" },
  },
  {
    label: "GPT-4o Mini",
    icon: "🤖",
    payload: { name: "GPT-4o Mini", provider: "openai", model: "gpt-4o-mini", baseUrl: "" },
  },
  {
    label: "GPT-4o",
    icon: "💡",
    payload: { name: "GPT-4o", provider: "openai", model: "gpt-4o", baseUrl: "" },
  },
  {
    label: "OpenRouter Free",
    icon: "🔀",
    payload: { name: "OpenRouter Free", provider: "openai-compatible", model: "mistralai/mistral-7b-instruct:free", baseUrl: "https://openrouter.ai/api/v1" },
  },
  {
    label: "OpenRouter Gemini Flash",
    icon: "⚡",
    payload: { name: "Gemini Flash (OpenRouter)", provider: "openai-compatible", model: "google/gemini-flash-1.5", baseUrl: "https://openrouter.ai/api/v1" },
  },
] as const;

const PROVIDER_LABELS: Record<string, string> = {
  "openai":             "OpenAI",
  "openai-compatible":  "OpenAI Compatible (OpenRouter, Groq…)",
  "google-gemini":      "Google Gemini",
};

const PROVIDER_KEY_HINT: Record<string, string> = {
  "openai":            "sk-... (مفتاح OpenAI)",
  "openai-compatible": "sk-or-... (مفتاح OpenRouter/Groq/غيره)",
  "google-gemini":     "AIza... (مفتاح Google AI Studio)",
};

export function AiModelAdmin({ models }: { models: AiModelRow[] }) {
  const router = useRouter();
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>("openai");
  const [formData, setFormData] = useState({
    name: "", model: "", baseUrl: "", apiKey: "", isDefault: false, isActive: true,
  });

  function applyPreset(preset: typeof PRESETS[number]) {
    setProvider(preset.payload.provider);
    setFormData((prev) => ({
      ...prev,
      name:    preset.payload.name,
      model:   preset.payload.model,
      baseUrl: preset.payload.baseUrl,
    }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess(""); setLoading(true);

    const response = await fetch("/api/admin/ai-models", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...formData, provider }),
    });
    const body = await response.json();
    setLoading(false);

    if (!response.ok) { setError(body.error || "تعذر حفظ النموذج."); return; }
    setSuccess("✅ تم حفظ نموذج AI بنجاح.");
    setFormData({ name: "", model: "", baseUrl: "", apiKey: "", isDefault: false, isActive: true });
    router.refresh();
  }

  async function toggle(id: string, field: "isDefault" | "isActive", value: boolean) {
    setError("");
    const response = await fetch(`/api/admin/ai-models/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ [field]: value }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error || "تعذر تحديث النموذج.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">

      {/* ── Add Model Form ── */}
      <form onSubmit={onSubmit} className="panel p-5">
        <div className="mb-5 flex items-center gap-2">
          <Plus size={18} className="text-accent" />
          <h2 className="text-lg font-bold text-ink">إضافة نموذج AI جديد</h2>
        </div>

        {/* Presets */}
        <div className="mb-5">
          <p className="label mb-2">اختر من الإعدادات المسبقة (Presets)</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                {preset.icon} {preset.label}
              </button>
            ))}
          </div>
        </div>

        {error   ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>   : null}
        {success ? <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Name */}
          <div>
            <label className="label" htmlFor="ai-name">الاسم الداخلي</label>
            <input
              className="field" id="ai-name" required
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="Gemini Production"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="label" htmlFor="ai-provider">المزود</label>
            <select
              className="field" id="ai-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {Object.entries(PROVIDER_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="label" htmlFor="ai-model">Model ID</label>
            <input
              className="field font-mono text-sm" id="ai-model" required
              value={formData.model}
              onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))}
              placeholder="gemini-2.0-flash"
            />
          </div>

          {/* API Key — per model */}
          <div className="xl:col-span-2">
            <label className="label" htmlFor="ai-apikey">
              مفتاح API الخاص بهذا النموذج
              <span className="mr-1 text-xs font-normal text-slate-400">(مشفر · اختياري إذا كان مضبوطاً في .env)</span>
            </label>
            <input
              className="field font-mono text-sm" id="ai-apikey"
              type="password" autoComplete="off"
              value={formData.apiKey}
              onChange={(e) => setFormData((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder={PROVIDER_KEY_HINT[provider] || "المفتاح..."}
            />
            <p className="mt-1 text-xs text-slate-500">
              {provider === "google-gemini"
                ? "احصل على مفتاح Gemini من: aistudio.google.com/apikey"
                : provider === "openai-compatible"
                ? "يمكن استخدام OpenRouter مجاناً من: openrouter.ai/keys"
                : "من: platform.openai.com/api-keys"}
            </p>
          </div>

          {/* Base URL — only for compatible */}
          {provider === "openai-compatible" ? (
            <div>
              <label className="label" htmlFor="ai-base">Base URL</label>
              <input
                className="field font-mono text-sm" id="ai-base" dir="ltr"
                value={formData.baseUrl}
                onChange={(e) => setFormData((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://openrouter.ai/api/v1"
              />
            </div>
          ) : null}

          {/* Toggles */}
          <div className="flex items-end gap-5 pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox" className="h-4 w-4 accent-primary-600"
                checked={formData.isDefault}
                onChange={(e) => setFormData((p) => ({ ...p, isDefault: e.target.checked }))}
              />
              <Star size={14} className="text-amber-400" />
              افتراضي
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox" className="h-4 w-4 accent-primary-600"
                checked={formData.isActive}
                onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              />
              مفعّل
            </label>
          </div>
        </div>

        <button className="btn-primary mt-5" disabled={loading}>
          <Save size={18} />
          {loading ? "جار الحفظ..." : "حفظ النموذج"}
        </button>
      </form>

      {/* ── Models table ── */}
      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-ink">نماذج AI المضافة ({models.length})</h2>
        </div>
        {models.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-right">الاسم</th>
                  <th className="p-3 text-right">المزود</th>
                  <th className="p-3 text-right">Model</th>
                  <th className="p-3 text-right">مفتاح API</th>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {models.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-ink">
                      <div className="flex items-center gap-2">
                        {item.isDefault ? <Star size={14} className="text-amber-400 shrink-0" /> : null}
                        {item.name}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.provider === "google-gemini"
                          ? "bg-blue-50 text-blue-700"
                          : item.provider === "openai-compatible"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-green-50 text-green-700"
                      }`}>
                        {item.provider === "google-gemini" ? <Sparkles size={11} /> : item.provider === "openai-compatible" ? <Globe size={11} /> : <Cpu size={11} />}
                        {PROVIDER_LABELS[item.provider] || item.provider}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-600" dir="ltr">{item.model}</td>
                    <td className="p-3 text-xs">
                      {item.hasApiKey
                        ? <span className="text-emerald-600">🔐 محفوظ ومشفر</span>
                        : <span className="text-slate-400">من .env</span>}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.isActive ? "مفعّل" : "معطّل"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs"
                          onClick={() => toggle(item.id, "isActive", !item.isActive)}
                        >
                          {item.isActive ? <ToggleRight size={14} className="text-emerald-600" /> : <ToggleLeft size={14} />}
                          {item.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                        {!item.isDefault ? (
                          <button
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs"
                            onClick={() => toggle(item.id, "isDefault", true)}
                          >
                            <Star size={12} className="text-amber-400" />
                            افتراضي
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-500">
            لا توجد نماذج AI بعد. استخدم الإعدادات المسبقة أعلاه لإضافة Gemini أو OpenAI بسرعة.
          </p>
        )}
      </section>
    </div>
  );
}

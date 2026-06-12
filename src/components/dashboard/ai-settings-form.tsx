"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";

type AiSettingsFormProps = {
  tenantId: string;
  bots: Array<{ id: string; name: string }>;
  aiModels: Array<{ id: string; name: string; provider: string; model: string; isDefault: boolean }>;
  initial?: {
    botId: string;
    aiModelId: string;
    isEnabled: boolean;
    temperature: number;
    systemPrompt: string;
    language?: string;
    role?: string;
    tone?: string;
    responseLength?: string;
    fallbackMessage?: string;
    useEmojis?: boolean;
  };
};

const fallbackAr = "عذرًا، لم أفهم طلبك جيدًا. هل يمكنك التوضيح؟";
const fallbackEn = "Sorry, I did not fully understand your request. Could you clarify?";

const copy = {
  ar: {
    bot: "البوت",
    model: "نموذج AI",
    language: "لغة البوت",
    role: "وظيفة البوت",
    tone: "نبرة الحديث",
    responseLength: "طول الإجابة",
    systemPrompt: "التعليمات المخصصة الإضافية (System Prompt)",
    fallback: "رسالة الاعتذار (Fallback Message)",
    emojis: "استخدام الرموز التعبيرية (Emojis)",
    enabled: "تفعيل الذكاء الاصطناعي",
    save: "حفظ الإعدادات",
    test: "اختبار الرسالة",
    saved: "تم حفظ إعدادات AI.",
    saveError: "تعذر حفظ إعدادات AI.",
    testing: "جاري اختبار النموذج...",
    testMessage: "اختبر إعدادات ChatZi برسالة قصيرة.",
    noReply: "لم يصل رد.",
    testError: "فشل اختبار الرسالة.",
    auto: "تلقائي (حسب لغة العميل)",
    arabic: "العربية",
    english: "الإنجليزية",
    assistant: "مساعد عام",
    customerService: "خدمة عملاء",
    techSupport: "دعم فني",
    sales: "مبيعات",
    receptionist: "موظف استقبال",
    neutral: "حيادي / موضوعي",
    formal: "رسمي / احترافي",
    casual: "ودي / غير رسمي",
    playful: "مرح / لطيف",
    empathetic: "متعاطف / متفهم",
    short: "قصير ومختصر",
    medium: "متوسط",
    long: "طويل ومفصل"
  },
  en: {
    bot: "Bot",
    model: "AI model",
    language: "Bot language",
    role: "Bot role",
    tone: "Conversation tone",
    responseLength: "Response length",
    systemPrompt: "Additional custom instructions (System Prompt)",
    fallback: "Fallback message",
    emojis: "Use emojis",
    enabled: "Enable AI",
    save: "Save settings",
    test: "Test message",
    saved: "AI settings saved.",
    saveError: "Unable to save AI settings.",
    testing: "Testing model...",
    testMessage: "Test ChatZi settings with a short message.",
    noReply: "No reply received.",
    testError: "Message test failed.",
    auto: "Auto (customer language)",
    arabic: "Arabic",
    english: "English",
    assistant: "General assistant",
    customerService: "Customer service",
    techSupport: "Technical support",
    sales: "Sales",
    receptionist: "Receptionist",
    neutral: "Neutral / objective",
    formal: "Formal / professional",
    casual: "Friendly / casual",
    playful: "Playful / light",
    empathetic: "Empathetic / understanding",
    short: "Short and concise",
    medium: "Medium",
    long: "Long and detailed"
  }
} as const;

export function AiSettingsForm({ tenantId, bots, aiModels, initial }: AiSettingsFormProps) {
  const { locale } = useI18n();
  const labels = copy[locale];
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testReply, setTestReply] = useState("");
  const [selectedBot, setSelectedBot] = useState(initial?.botId || bots[0]?.id || "");
  const [selectedAiModel, setSelectedAiModel] = useState(
    initial?.aiModelId || aiModels.find((item) => item.isDefault)?.id || aiModels[0]?.id || ""
  );

  async function save(form: HTMLFormElement) {
    const data = new FormData(form);
    const payload = {
      botId: selectedBot,
      aiModelId: selectedAiModel,
      isEnabled: data.get("isEnabled") === "on",
      temperature: Number(data.get("temperature") || 0.4),
      systemPrompt: String(data.get("systemPrompt") || DEFAULT_SYSTEM_PROMPT),
      language: String(data.get("language") || "auto"),
      role: String(data.get("role") || "assistant"),
      tone: String(data.get("tone") || "neutral"),
      responseLength: String(data.get("responseLength") || "medium"),
      fallbackMessage: String(data.get("fallbackMessage") || (locale === "ar" ? fallbackAr : fallbackEn)),
      useEmojis: data.get("useEmojis") === "on"
    };

    const response = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || labels.saveError);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await save(event.currentTarget);
      setSuccess(labels.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.saveError);
    }
  }

  async function onTest(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    setError("");
    setTestReply(labels.testing);
    try {
      await save(form);
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          botId: selectedBot,
          message: labels.testMessage,
          conversationId: ""
        })
      });
      const body = await response.json();
      setTestReply(body.reply || body.error || labels.noReply);
    } catch (err) {
      setTestReply("");
      setError(err instanceof Error ? err.message : labels.testError);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel max-w-4xl p-5">
      {error ? <p className="callout-error mb-4">{error}</p> : null}
      {success ? <p className="callout-success mb-4">{success}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="botId">{labels.bot}</label>
          <select className="field" id="botId" value={selectedBot} onChange={(event) => setSelectedBot(event.target.value)}>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="temperature">Temperature</label>
          <input className="field" id="temperature" name="temperature" type="number" min="0" max="2" step="0.1" defaultValue={initial?.temperature ?? 0.4} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select label={labels.language} id="language" name="language" defaultValue={initial?.language || "auto"} options={[
          ["auto", labels.auto],
          ["arabic", labels.arabic],
          ["english", labels.english]
        ]} />
        <Select label={labels.role} id="role" name="role" defaultValue={initial?.role || "assistant"} options={[
          ["assistant", labels.assistant],
          ["customer_service", labels.customerService],
          ["tech_support", labels.techSupport],
          ["sales", labels.sales],
          ["receptionist", labels.receptionist]
        ]} />
        <div>
          <label className="label" htmlFor="aiModelId">{labels.model}</label>
          <select
            className="field"
            id="aiModelId"
            value={selectedAiModel}
            onChange={(event) => setSelectedAiModel(event.target.value)}
            required
          >
            {aiModels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.model}
              </option>
            ))}
          </select>
        </div>
        <Select label={labels.tone} id="tone" name="tone" defaultValue={initial?.tone || "neutral"} options={[
          ["neutral", labels.neutral],
          ["formal", labels.formal],
          ["casual", labels.casual],
          ["playful", labels.playful],
          ["empathetic", labels.empathetic]
        ]} />
        <Select label={labels.responseLength} id="responseLength" name="responseLength" defaultValue={initial?.responseLength || "medium"} options={[
          ["short", labels.short],
          ["medium", labels.medium],
          ["long", labels.long]
        ]} />
      </div>

      <label className="label mt-4" htmlFor="systemPrompt">{labels.systemPrompt}</label>
      <textarea className="field min-h-36" id="systemPrompt" name="systemPrompt" defaultValue={initial?.systemPrompt || DEFAULT_SYSTEM_PROMPT} />

      <label className="label mt-4" htmlFor="fallbackMessage">{labels.fallback}</label>
      <textarea className="field min-h-20" id="fallbackMessage" name="fallbackMessage" defaultValue={initial?.fallbackMessage || (locale === "ar" ? fallbackAr : fallbackEn)} />

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input name="useEmojis" type="checkbox" defaultChecked={initial?.useEmojis ?? true} />
          {labels.emojis}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input name="isEnabled" type="checkbox" defaultChecked={initial?.isEnabled ?? true} />
          {labels.enabled}
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn-primary">
          <Save size={18} />
          {labels.save}
        </button>
        <button type="button" className="btn-secondary" onClick={onTest}>
          <Send size={18} />
          {labels.test}
        </button>
      </div>
      {testReply ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-7 text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">{testReply}</p> : null}
    </form>
  );
}

function Select({
  label,
  id,
  name,
  defaultValue,
  options
}: {
  label: string;
  id: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select className="field" id={id} name={name} defaultValue={defaultValue}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
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

export function AiSettingsForm({ tenantId, bots, aiModels, initial }: AiSettingsFormProps) {
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
      fallbackMessage: String(data.get("fallbackMessage") || "عذراً، لم أفهم طلبك جيداً. هل يمكنك التوضيح؟"),
      useEmojis: data.get("useEmojis") === "on"
    };

    const response = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "تعذر حفظ إعدادات AI.");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await save(event.currentTarget);
      setSuccess("تم حفظ إعدادات AI.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ إعدادات AI.");
    }
  }

  async function onTest(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    setError("");
    setTestReply("جاري اختبار النموذج...");
    try {
      await save(form);
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          botId: selectedBot,
          message: "اختبر إعدادات ChatZi برسالة قصيرة.",
          conversationId: ""
        })
      });
      const body = await response.json();
      setTestReply(body.reply || body.error || "لم يصل رد.");
    } catch (err) {
      setTestReply("");
      setError(err instanceof Error ? err.message : "فشل اختبار الرسالة.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel max-w-4xl p-5">
      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="botId">البوت</label>
          <select className="field" id="botId" value={selectedBot} onChange={(event) => setSelectedBot(event.target.value)}>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="aiModelId">نموذج AI</label>
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
        <div>
          <label className="label" htmlFor="temperature">Temperature</label>
          <input
            className="field"
            id="temperature"
            name="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            defaultValue={initial?.temperature ?? 0.4}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <div>
          <label className="label" htmlFor="language">لغة البوت</label>
          <select className="field" id="language" name="language" defaultValue={initial?.language || "auto"}>
            <option value="auto">تلقائي (حسب لغة العميل)</option>
            <option value="arabic">العربية</option>
            <option value="english">الإنجليزية</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="role">وظيفة البوت</label>
          <select className="field" id="role" name="role" defaultValue={initial?.role || "assistant"}>
            <option value="assistant">مساعد عام</option>
            <option value="customer_service">خدمة عملاء</option>
            <option value="tech_support">دعم فني</option>
            <option value="sales">مبيعات</option>
            <option value="receptionist">موظف استقبال</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tone">نبرة الحديث</label>
          <select className="field" id="tone" name="tone" defaultValue={initial?.tone || "neutral"}>
            <option value="neutral">حيادي / موضوعي</option>
            <option value="formal">رسمي / احترافي</option>
            <option value="casual">ودي / غير رسمي</option>
            <option value="playful">مرح / لطيف</option>
            <option value="empathetic">متعاطف / متفهم</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="responseLength">طول الإجابة</label>
          <select className="field" id="responseLength" name="responseLength" defaultValue={initial?.responseLength || "medium"}>
            <option value="short">قصير ومختصر</option>
            <option value="medium">متوسط</option>
            <option value="long">طويل ومفصل</option>
          </select>
        </div>
      </div>
      <label className="label mt-4" htmlFor="systemPrompt">التعليمات المخصصة الإضافية (System Prompt)</label>
      <textarea
        className="field min-h-36"
        id="systemPrompt"
        name="systemPrompt"
        defaultValue={initial?.systemPrompt || DEFAULT_SYSTEM_PROMPT}
      />
      
      <label className="label mt-4" htmlFor="fallbackMessage">رسالة الاعتذار (Fallback Message)</label>
      <textarea
        className="field min-h-20"
        id="fallbackMessage"
        name="fallbackMessage"
        defaultValue={initial?.fallbackMessage || "عذراً، لم أفهم طلبك جيداً. هل يمكنك التوضيح؟"}
      />

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input name="useEmojis" type="checkbox" defaultChecked={initial?.useEmojis ?? true} />
          استخدام الرموز التعبيرية (Emojis)
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input name="isEnabled" type="checkbox" defaultChecked={initial?.isEnabled ?? true} />
          تفعيل الذكاء الاصطناعي
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn-primary">
          <Save size={18} />
          حفظ الإعدادات
        </button>
        <button type="button" className="btn-secondary" onClick={onTest}>
          <Send size={18} />
          اختبار الرسالة
        </button>
      </div>
      {testReply ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-7 text-slate-700">{testReply}</p> : null}
    </form>
  );
}

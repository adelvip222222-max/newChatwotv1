"use client";

import { useState } from "react";
import { Link2, RadioTower, Save, Send } from "lucide-react";

type ChannelType = "website" | "telegram" | "whatsapp" | "facebook" | "webhook";

type ChannelFormProps = {
  type: ChannelType;
  title: string;
  bots: Array<{ id: string; name: string }>;
  initial?: {
    botId: string;
    name: string;
    isActive: boolean;
    config: Record<string, unknown>;
  };
  logs: Array<{ id: string; status: string; error: string; createdAt: string }>;
  baseUrl: string;
};

const endpointMap: Record<ChannelType, string> = {
  website: "/widget.js",
  telegram: "/api/channels/telegram/webhook",
  whatsapp: "/api/channels/whatsapp/webhook",
  facebook: "/api/channels/facebook/webhook",
  webhook: "/api/channels/webhook/message"
};

export function ChannelForm({ type, title, bots, initial, logs, baseUrl }: ChannelFormProps) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState("");
  const [botId, setBotId] = useState(initial?.botId || bots[0]?.id || "");
  const initialPublicBase = String(initial?.config.publicBaseUrl || baseUrl).replace(/\/+$/, "");
  const [publicBaseUrl, setPublicBaseUrl] = useState(initialPublicBase);
  const endpoint = `${type === "telegram" ? publicBaseUrl : baseUrl}${endpointMap[type]}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading("save");
    const form = new FormData(event.currentTarget);
    const config: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("config.")) {
        config[key.replace("config.", "")] = value;
      }
    }

    const response = await fetch("/api/channels/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId,
        type,
        name: String(form.get("name") || title),
        isActive: form.get("isActive") === "on",
        config
      })
    });
    const body = await response.json();
    setLoading("");

    if (!response.ok) {
      setError(body.error || "تعذر حفظ القناة.");
      return;
    }

    setSuccess(type === "telegram" ? "تم حفظ قناة Telegram. يمكنك الآن ربط Webhook." : "تم حفظ القناة.");
  }

  async function setupTelegramWebhook() {
    setError("");
    setSuccess("");
    setLoading("setup");
    const response = await fetch("/api/channels/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId })
    });
    const body = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(body.error || "تعذر ربط Telegram Webhook.");
      return;
    }
    setSuccess(`تم ربط Telegram Webhook: ${body.webhookUrl}`);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="panel max-w-4xl p-5">
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="botId">البوت</label>
            <select className="field" id="botId" value={botId} onChange={(event) => setBotId(event.target.value)}>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>{bot.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="name">اسم القناة</label>
            <input className="field" id="name" name="name" defaultValue={initial?.name || title} />
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <RadioTower size={17} />
            نقطة الربط
          </div>
          <code className="mt-2 block overflow-auto rounded-md bg-white p-3 text-left text-xs text-slate-700" dir="ltr">
            {type === "website" ? `<script src="${endpoint}" data-bot-id="${botId || "BOT_ID"}"></script>` : endpoint}
          </code>
        </div>

        <ChannelSpecificFields
          type={type}
          config={initial?.config || {}}
          publicBaseUrl={publicBaseUrl}
          setPublicBaseUrl={setPublicBaseUrl}
        />

        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input name="isActive" type="checkbox" defaultChecked={initial?.isActive ?? true} />
          تفعيل القناة
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={loading === "save"}>
            <Save size={18} />
            {loading === "save" ? "جار الحفظ..." : "حفظ القناة"}
          </button>
          {type === "telegram" ? (
            <button className="btn-secondary" type="button" onClick={setupTelegramWebhook} disabled={loading === "setup" || !botId}>
              <Link2 size={18} />
              {loading === "setup" ? "جار الربط..." : "ربط Webhook الآن"}
            </button>
          ) : null}
          <a href="/dashboard/simulator" target="_blank" rel="noopener noreferrer" className="btn-secondary">
            تجربة ومراسلة البوت
          </a>
        </div>
      </form>

      <section className="panel max-w-4xl p-5">
        <h2 className="mb-4 text-lg font-bold text-ink">آخر Webhook Logs</h2>
        {logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-right">الحالة</th>
                  <th className="p-3 text-right">الخطأ</th>
                  <th className="p-3 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="p-3">{log.status}</td>
                    <td className="p-3">{log.error || "-"}</td>
                    <td className="p-3">{new Date(log.createdAt).toLocaleString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">لا توجد سجلات بعد.</p>
        )}
      </section>
    </div>
  );
}

function ChannelSpecificFields({
  type,
  config,
  publicBaseUrl,
  setPublicBaseUrl
}: {
  type: ChannelType;
  config: Record<string, unknown>;
  publicBaseUrl: string;
  setPublicBaseUrl: (value: string) => void;
}) {
  if (type === "website") {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="color">لون الزر</label>
          <input className="field" id="color" name="config.color" defaultValue={String(config.color || "#0f766e")} />
        </div>
        <div>
          <label className="label" htmlFor="welcome">رسالة الترحيب</label>
          <input className="field" id="welcome" name="config.welcome" defaultValue={String(config.welcome || "مرحبًا، كيف أساعدك؟")} />
        </div>
      </div>
    );
  }

  if (type === "telegram") {
    return (
      <div className="mt-4 grid gap-4">
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          {config.tokenConfigured ? "توكن Telegram محفوظ ومشفر. اترك الحقل فارغًا لو لا تريد تغييره." : "أدخل توكن Telegram من BotFather ثم احفظ القناة."}
        </div>
        <div>
          <label className="label" htmlFor="botToken">Telegram Bot Token</label>
          <input
            className="field"
            id="botToken"
            name="config.botToken"
            type="password"
            autoComplete="off"
            placeholder={config.tokenConfigured ? "••••••••••••••••••••" : "123456789:AA..."}
          />
        </div>
        <div>
          <label className="label" htmlFor="publicBaseUrl">الرابط العام HTTPS</label>
          <input
            className="field text-left"
            dir="ltr"
            id="publicBaseUrl"
            name="config.publicBaseUrl"
            value={publicBaseUrl}
            onChange={(event) => setPublicBaseUrl(event.target.value)}
            placeholder="https://your-domain.com أو https://xxxx.ngrok-free.app"
          />
          <p className="mt-1 text-xs text-slate-500">Telegram لا يقبل localhost. استخدم دومين HTTPS أو ngrok أثناء التجربة.</p>
        </div>
        <input type="hidden" name="config.webhookSecret" value={String(config.webhookSecret || "")} />
        {config.webhookUrl ? (
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <Send size={16} />
              Webhook مربوط
            </div>
            <p className="mt-1 break-all text-left" dir="ltr">{String(config.webhookUrl)}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (type === "whatsapp") {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800 md:col-span-2">
          {config.tokenConfigured ? "توكن WhatsApp محفوظ ومشفر. اترك الحقل فارغًا لو لا تريد تغييره." : "أدخل WhatsApp Access Token و Phone Number ID من Meta."}
        </div>
        <div>
          <label className="label" htmlFor="waToken">WhatsApp Access Token</label>
          <input className="field" id="waToken" name="config.accessToken" type="password" autoComplete="off" placeholder={config.tokenConfigured ? "••••••••••••••••" : "EAAG..."} />
        </div>
        <div>
          <label className="label" htmlFor="waPhone">Phone Number ID</label>
          <input className="field text-left" dir="ltr" id="waPhone" name="config.phoneNumberId" defaultValue={String(config.phoneNumberId || "")} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="waVerify">Verify Token</label>
          <input className="field text-left" dir="ltr" id="waVerify" name="config.verifyToken" defaultValue={String(config.verifyToken || "")} placeholder="اتركه فارغًا لتوليده تلقائيًا" />
          <p className="mt-1 text-xs text-slate-500">استخدم هذا التوكن في إعداد Webhook داخل Meta.</p>
        </div>
      </div>
    );
  }

  if (type === "facebook") {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800 md:col-span-2">
          {config.tokenConfigured ? "توكن Facebook محفوظ ومشفر. اترك الحقل فارغًا لو لا تريد تغييره." : "أدخل Page Access Token و Page ID من Meta."}
        </div>
        <div>
          <label className="label" htmlFor="fbToken">Page Access Token</label>
          <input className="field" id="fbToken" name="config.pageAccessToken" type="password" autoComplete="off" placeholder={config.tokenConfigured ? "••••••••••••••••" : "EAAG..."} />
        </div>
        <div>
          <label className="label" htmlFor="fbPage">Page ID</label>
          <input className="field text-left" dir="ltr" id="fbPage" name="config.pageId" defaultValue={String(config.pageId || "")} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="fbVerify">Verify Token</label>
          <input className="field text-left" dir="ltr" id="fbVerify" name="config.verifyToken" defaultValue={String(config.verifyToken || "")} placeholder="اتركه فارغًا لتوليده تلقائيًا" />
          <p className="mt-1 text-xs text-slate-500">استخدم هذا التوكن في إعداد Webhook داخل Meta.</p>
        </div>
      </div>
    );
  }

  return <p className="mt-4 text-sm leading-7 text-slate-600">أرسل tenantId و botId و userId و message إلى نقطة الربط للحصول على reply.</p>;
}

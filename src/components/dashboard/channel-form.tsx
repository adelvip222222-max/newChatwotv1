"use client";

import { useState } from "react";
import { KeyRound, Link2, RadioTower, Save, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type ChannelType = "website" | "telegram" | "whatsapp" | "facebook" | "instagram" | "email" | "api" | "webhook";

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
  instagram: "/api/channels/webhook/message",
  email: "/api/channels/webhook/message",
  api: "/api/channels/webhook/message",
  webhook: "/api/channels/webhook/message"
};

declare global {
  interface Window {
    FB?: any;
  }
}

const copy = {
  ar: {
    bot: "البوت",
    channelName: "اسم القناة",
    endpoint: "نقطة الربط",
    enabled: "تفعيل القناة",
    save: "حفظ القناة",
    saving: "جار الحفظ...",
    saved: "تم حفظ القناة.",
    telegramSaved: "تم حفظ قناة Telegram. يمكنك الآن ربط Webhook.",
    saveError: "تعذر حفظ القناة.",
    setupWebhook: "ربط Webhook الآن",
    settingUp: "جار الربط...",
    setupError: "تعذر ربط Telegram Webhook.",
    setupSuccess: "تم ربط Telegram Webhook",
    testBot: "تجربة ومراسلة البوت",
    logsTitle: "آخر Webhook Logs",
    status: "الحالة",
    error: "الخطأ",
    date: "التاريخ",
    noLogs: "لا توجد سجلات بعد.",
    configuredToken: "التوكن محفوظ ومشفر. اترك الحقل فارغًا إذا لم ترد تغييره.",
    telegramEmpty: "أدخل توكن Telegram من BotFather ثم احفظ القناة.",
    whatsappEmpty: "أدخل WhatsApp Access Token و Phone Number ID من Meta.",
    facebookEmpty: "أدخل Page Access Token و Page ID من Meta.",
    instagramEmpty: "أدخل Instagram Access Token و Business Account ID.",
    passwordConfigured: "كلمة المرور محفوظة ومشفرة. اترك الحقل فارغًا إذا لم ترد تغييرها.",
    emailEmpty: "أدخل بيانات SMTP أو صندوق البريد الخاص بالقناة.",
    apiEmpty: "أدخل مفتاح API وقيود الاستقبال إن وجدت.",
    webhookEmpty: "استخدم هذه القناة لاستقبال رسائل من أي نظام خارجي.",
    buttonColor: "لون الزر",
    welcome: "رسالة الترحيب",
    publicUrl: "الرابط العام HTTPS",
    publicUrlHint: "Telegram لا يقبل localhost. استخدم دومين HTTPS أو ngrok أثناء التجربة.",
    verifyToken: "Verify Token",
    verifyHint: "استخدم هذا التوكن في إعداد Webhook داخل Meta.",
    leaveBlank: "اتركه فارغًا لتوليده تلقائيًا",
    phoneId: "Phone Number ID",
    pageId: "Page ID",
    accountId: "Business Account ID",
    emailAddress: "عنوان البريد",
    smtpHost: "SMTP Host",
    smtpPort: "SMTP Port",
    smtpUser: "SMTP User",
    smtpPassword: "SMTP Password",
    apiKey: "API Key",
    allowedOrigin: "Allowed Origin",
    signingSecret: "Signing Secret",
    genericHelp: "أرسل tenantId و botId و userId و message إلى نقطة الربط للحصول على reply."
  },
  en: {
    bot: "Bot",
    channelName: "Channel name",
    endpoint: "Connection endpoint",
    enabled: "Enable channel",
    save: "Save channel",
    saving: "Saving...",
    saved: "Channel saved.",
    telegramSaved: "Telegram channel saved. You can now link the Webhook.",
    saveError: "Unable to save channel.",
    setupWebhook: "Link Webhook now",
    settingUp: "Linking...",
    setupError: "Unable to link Telegram Webhook.",
    setupSuccess: "Telegram Webhook linked",
    testBot: "Test and message bot",
    logsTitle: "Latest Webhook Logs",
    status: "Status",
    error: "Error",
    date: "Date",
    noLogs: "No logs yet.",
    configuredToken: "Token is saved and encrypted. Leave the field blank to keep it unchanged.",
    telegramEmpty: "Enter the Telegram token from BotFather, then save the channel.",
    whatsappEmpty: "Enter the WhatsApp Access Token and Phone Number ID from Meta.",
    facebookEmpty: "Enter the Page Access Token and Page ID from Meta.",
    instagramEmpty: "Enter the Instagram Access Token and Business Account ID.",
    passwordConfigured: "Password is saved and encrypted. Leave the field blank to keep it unchanged.",
    emailEmpty: "Enter SMTP or mailbox settings for this channel.",
    apiEmpty: "Enter the API key and optional receiving restrictions.",
    webhookEmpty: "Use this channel to receive messages from any external system.",
    buttonColor: "Button color",
    welcome: "Welcome message",
    publicUrl: "HTTPS public URL",
    publicUrlHint: "Telegram does not accept localhost. Use an HTTPS domain or ngrok during testing.",
    verifyToken: "Verify Token",
    verifyHint: "Use this token inside Meta Webhook settings.",
    leaveBlank: "Leave blank to generate automatically",
    phoneId: "Phone Number ID",
    pageId: "Page ID",
    accountId: "Business Account ID",
    emailAddress: "Email address",
    smtpHost: "SMTP Host",
    smtpPort: "SMTP Port",
    smtpUser: "SMTP User",
    smtpPassword: "SMTP Password",
    apiKey: "API Key",
    allowedOrigin: "Allowed Origin",
    signingSecret: "Signing Secret",
    genericHelp: "Send tenantId, botId, userId, and message to the endpoint to receive a reply."
  }
} as const;

export function ChannelForm({ type, title, bots, initial, logs, baseUrl }: ChannelFormProps) {
  const { locale } = useI18n();
  const labels = copy[locale];
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
      setError(body.error || labels.saveError);
      return;
    }

    setSuccess(type === "telegram" ? labels.telegramSaved : labels.saved);
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
      setError(body.error || labels.setupError);
      return;
    }
    setSuccess(`${labels.setupSuccess}: ${body.webhookUrl}`);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="panel max-w-4xl p-5">
        {error ? <p className="callout-error mb-4">{error}</p> : null}
        {success ? <p className="callout-success mb-4">{success}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="botId">{labels.bot}</label>
            <select className="field" id="botId" value={botId} onChange={(event) => setBotId(event.target.value)}>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>{bot.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="name">{labels.channelName}</label>
            <input className="field" id="name" name="name" defaultValue={initial?.name || title} />
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <RadioTower size={17} />
            {labels.endpoint}
          </div>
          <code className="mt-2 block overflow-auto rounded-md bg-white p-3 text-left text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-200" dir="ltr">
            {type === "website" ? `<script src="${endpoint}" data-bot-id="${botId || "BOT_ID"}"></script>` : endpoint}
          </code>
        </div>

        <ChannelSpecificFields
          type={type}
          config={initial?.config || {}}
          publicBaseUrl={publicBaseUrl}
          setPublicBaseUrl={setPublicBaseUrl}
          labels={labels}
        />

        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input name="isActive" type="checkbox" defaultChecked={initial?.isActive ?? true} />
          {labels.enabled}
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={loading === "save"}>
            <Save size={18} />
            {loading === "save" ? labels.saving : labels.save}
          </button>
          {type === "telegram" ? (
            <button className="btn-secondary" type="button" onClick={setupTelegramWebhook} disabled={loading === "setup" || !botId}>
              <Link2 size={18} />
              {loading === "setup" ? labels.settingUp : labels.setupWebhook}
            </button>
          ) : null}
          <a href="/dashboard/simulator" target="_blank" rel="noopener noreferrer" className="btn-secondary">
            {labels.testBot}
          </a>
        </div>
      </form>

      <section className="panel max-w-4xl p-5">
        <h2 className="mb-4 text-lg font-bold text-ink">{labels.logsTitle}</h2>
        {logs.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {logs.map((log) => (
                <article key={log.id} className="mobile-card">
                  <div className="flex items-center justify-between gap-3">
                    <span className={log.status === "success" ? "badge-success" : "badge-neutral"}>{log.status}</span>
                    <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{log.error || "-"}</p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{labels.status}</th>
                    <th>{labels.error}</th>
                    <th>{labels.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.status}</td>
                      <td>{log.error || "-"}</td>
                      <td>{new Date(log.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{labels.noLogs}</p>
        )}
      </section>
    </div>
  );
}

function ChannelSpecificFields({
  type,
  config,
  publicBaseUrl,
  setPublicBaseUrl,
  labels
}: {
  type: ChannelType;
  config: Record<string, unknown>;
  publicBaseUrl: string;
  setPublicBaseUrl: (value: string) => void;
  labels: typeof copy.ar | typeof copy.en;
}) {
  if (type === "website") {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label={labels.buttonColor} id="color" name="config.color" defaultValue={String(config.color || "#0f766e")} />
        <Field label={labels.welcome} id="welcome" name="config.welcome" defaultValue={String(config.welcome || "مرحبًا، كيف أساعدك؟")} />
      </div>
    );
  }

  if (type === "telegram") {
    return (
      <div className="mt-4 grid gap-4">
        <Info>{config.tokenConfigured ? labels.configuredToken : labels.telegramEmpty}</Info>
        <Field
          label="Telegram Bot Token"
          id="botToken"
          name="config.botToken"
          type="password"
          autoComplete="off"
          placeholder={config.tokenConfigured ? "••••••••••••••••••••" : "123456789:AA..."}
        />
        <div>
          <label className="label" htmlFor="publicBaseUrl">{labels.publicUrl}</label>
          <input
            className="field text-left"
            dir="ltr"
            id="publicBaseUrl"
            name="config.publicBaseUrl"
            value={publicBaseUrl}
            onChange={(event) => setPublicBaseUrl(event.target.value)}
            placeholder="https://your-domain.com or https://xxxx.ngrok-free.app"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{labels.publicUrlHint}</p>
        </div>
        <input type="hidden" name="config.webhookSecret" value={String(config.webhookSecret || "")} />
        {config.webhookUrl ? (
          <div className="callout-success">
            <div className="flex items-center gap-2 font-bold">
              <Send size={16} />
              Webhook
            </div>
            <p className="mt-1 break-all text-left" dir="ltr">{String(config.webhookUrl)}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (type === "whatsapp") {
    return (
      <div className="mt-4 grid gap-4">
        <MetaOAuthButton type={type} config={config} labels={labels} />
      </div>
    );
  }

  if (type === "facebook") {
    return (
      <div className="mt-4 grid gap-4">
        <MetaOAuthButton type={type} config={config} labels={labels} />
      </div>
    );
  }

  if (type === "instagram") {
    return (
      <div className="mt-4 grid gap-4">
        <MetaOAuthButton type={type} config={config} labels={labels} />
      </div>
    );
  }

  if (type === "email") {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Info className="md:col-span-2">{config.passwordConfigured ? labels.passwordConfigured : labels.emailEmpty}</Info>
        <Field label={labels.emailAddress} id="emailAddress" name="config.emailAddress" defaultValue={String(config.emailAddress || "")} dir="ltr" />
        <Field label={labels.smtpHost} id="smtpHost" name="config.smtpHost" defaultValue={String(config.smtpHost || "")} dir="ltr" />
        <Field label={labels.smtpPort} id="smtpPort" name="config.smtpPort" defaultValue={String(config.smtpPort || "587")} dir="ltr" />
        <Field label={labels.smtpUser} id="smtpUser" name="config.smtpUser" defaultValue={String(config.smtpUser || "")} dir="ltr" />
        <Field label={labels.smtpPassword} id="smtpPassword" name="config.smtpPassword" type="password" autoComplete="off" placeholder={config.passwordConfigured ? "••••••••••••" : ""} />
      </div>
    );
  }

  if (type === "api") {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Info className="md:col-span-2">{config.tokenConfigured ? labels.configuredToken : labels.apiEmpty}</Info>
        <Field label={labels.apiKey} id="apiKey" name="config.apiKey" type="password" autoComplete="off" placeholder={config.tokenConfigured ? "••••••••••••" : "sk_live_..."} />
        <Field label={labels.allowedOrigin} id="allowedOrigin" name="config.allowedOrigin" defaultValue={String(config.allowedOrigin || "")} dir="ltr" />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <Info>{labels.webhookEmpty}</Info>
      <Field label={labels.signingSecret} id="signingSecret" name="config.signingSecret" defaultValue={String(config.signingSecret || "")} dir="ltr" placeholder={labels.leaveBlank} />
      <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{labels.genericHelp}</p>
    </div>
  );
}

function MetaOAuthButton({ type, config, labels }: { type: string, config: Record<string, unknown>, labels: any }) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [oauthToken, setOauthToken] = useState<string>(String(config.oauthToken || ""));
  const appId = process.env.NEXT_PUBLIC_META_APP_ID || "";
  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/api/oauth/meta` : "";

  function openMetaLogin() {
    if (!appId) {
      alert("App ID is missing in environment variables.");
      return;
    }
    const scopes = type === "whatsapp" 
      ? "whatsapp_business_management,whatsapp_business_messaging"
      : "pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages";
    
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
    const popup = window.open(url, "Meta Login", "width=600,height=600");

    const messageListener = async (event: MessageEvent) => {
      if (event.data?.type === "META_OAUTH_SUCCESS") {
        window.removeEventListener("message", messageListener);
        setOauthToken(event.data.token);
        fetchAccounts(event.data.token);
      } else if (event.data?.type === "META_OAUTH_ERROR") {
        window.removeEventListener("message", messageListener);
        alert("OAuth Error: " + event.data.error);
      }
    };
    window.addEventListener("message", messageListener);
  }

  async function fetchAccounts(token: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/channels/meta/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type })
      });
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
        if (data.accounts.length > 0) setSelectedAccount(data.accounts[0].id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4 rounded border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900/30 dark:bg-blue-900/10">
      <div className="flex items-center gap-3">
        <button type="button" onClick={openMetaLogin} className="btn-primary bg-[#1877F2] hover:bg-[#0c63d4] text-white">
          Connect with Meta
        </button>
        {oauthToken && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected ✓</span>}
      </div>
      
      {loading && <p className="text-sm text-slate-500">جلب الحسابات المتاحة...</p>}
      
      {accounts.length > 0 && (
        <div className="mt-4 space-y-3">
          <label className="label">اختر الحساب المراد ربطه</label>
          <select 
            className="field"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.id})</option>
            ))}
          </select>
          <input type="hidden" name="config.oauthToken" value={oauthToken} />
          <input type="hidden" name="config.oauthProviderAccountId" value={selectedAccount} />
          {type === "whatsapp" && <input type="hidden" name="config.phoneNumberId" value={selectedAccount} />}
          {type === "facebook" && <input type="hidden" name="config.pageId" value={selectedAccount} />}
          {type === "instagram" && <input type="hidden" name="config.accountId" value={selectedAccount} />}
        </div>
      )}

      {!!config.tokenConfigured && accounts.length === 0 && (
        <p className="text-sm text-slate-500">القناة مربوطة مسبقاً بنظام التوكن المشفر.</p>
      )}
    </div>
  );
}

function VerifyFields({
  labels,
  config,
  prefix
}: {
  labels: typeof copy.ar | typeof copy.en;
  config: Record<string, unknown>;
  prefix: string;
}) {
  return (
    <div className="md:col-span-2">
      <label className="label" htmlFor={`${prefix}Verify`}>{labels.verifyToken}</label>
      <input
        className="field text-left"
        dir="ltr"
        id={`${prefix}Verify`}
        name="config.verifyToken"
        defaultValue={String(config.verifyToken || "")}
        placeholder={labels.leaveBlank}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{labels.verifyHint}</p>
    </div>
  );
}

function Field({
  label,
  id,
  name,
  defaultValue,
  type = "text",
  dir,
  autoComplete,
  placeholder
}: {
  label: string;
  id: string;
  name: string;
  defaultValue?: string;
  type?: string;
  dir?: "ltr" | "rtl";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        className={dir === "ltr" ? "field text-left" : "field"}
        id={id}
        name={name}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}

function Info({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`callout-info flex items-start gap-2 ${className}`}>
      <KeyRound size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

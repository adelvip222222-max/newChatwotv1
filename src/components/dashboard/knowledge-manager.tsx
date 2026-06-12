"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Bot,
  Brain,
  Clock3,
  DatabaseZap,
  FileUp,
  Globe,
  Loader2,
  RefreshCcw,
  Save,
  Settings2,
  Sliders,
  Zap,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type BotRow = {
  id: string; name: string;
  knowledgeEnabled: boolean; showKnowledgeSources: boolean;
  confidenceDirectThreshold: number; confidenceReviewThreshold: number;
  systemPrompt: string;
  autoFollowupEnabled: boolean; followupDelayMinutes: number; followupMaxAttempts: number;
  autoCloseEnabled: boolean; autoCloseAfterMinutes: number; autoCloseMessage: string;
};
type CategoryRow   = { id: string; name: string };
type CollectionRow = { id: string; categoryId: string; name: string };
type DocumentRow   = {
  id: string; title: string; sourceType: string; status: string; statusReason: string;
  tags: string[]; isTemporary: boolean; expiresAt: string;
  chunkCount: number; embeddingCount: number; needsRetraining: boolean; updatedAt: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────
const SOURCE_TYPES = [
  ["custom_text",      "✏️ نص مخصص / FAQ"],
  ["faq",              "❓ أسئلة شائعة (FAQ)"],
  ["product_catalog",  "🛒 كتالوج المنتجات"],
  ["services_catalog", "🏷️ كتالوج الخدمات"],
  ["pricing",          "💰 خطط الأسعار"],
  ["policies",         "📋 السياسات"],
  ["terms",            "📜 الشروط والأحكام"],
  ["support_article",  "🎯 مقال دعم"],
  ["manual",           "📖 دليل استخدام"],
  ["website",          "🌐 رابط موقع"],
  ["html",             "💻 صفحة HTML"],
  ["pdf",              "📄 PDF"],
  ["docx",             "📝 Word (DOCX)"],
  ["txt",              "📃 نص (TXT/CSV)"],
  ["excel",            "📊 Excel"],
] as const;

const FILE_TYPES = ["pdf", "docx", "txt", "csv", "excel"];
const URL_TYPES  = ["website", "html"];

const TABS = [
  { id: "primary",      label: "المعرفة الأساسية",  icon: BookOpenText },
  { id: "temporary",    label: "البيانات المؤقتة",  icon: Clock3       },
  { id: "bot-settings", label: "إعدادات البوت",     icon: Sliders      },
  { id: "instructions", label: "تعليمات الذكاء",    icon: Brain        },
  { id: "automation",   label: "الأتمتة",           icon: Zap          },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Main Component ─────────────────────────────────────────────────────────────
export function KnowledgeManager({
  bots, categories, collections, documents,
}: {
  bots: BotRow[]; categories: CategoryRow[];
  collections: CollectionRow[]; documents: DocumentRow[];
}) {
  const router = useRouter();
  const [activeTab,    setActiveTab]    = useState<TabId>("primary");
  const [sourceType,   setSourceType]   = useState("custom_text");
  const [categoryName, setCategoryName] = useState(categories[0]?.name || "الأسئلة الشائعة");
  const [selectedBot,  setSelectedBot]  = useState(bots[0]?.id || "");
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [loading,      setLoading]      = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const bot              = bots.find((b) => b.id === selectedBot);
  const category         = categories.find((c) => c.name === categoryName);
  const visibleCollections = useMemo(
    () => collections.filter((c) => !category || c.categoryId === category.id),
    [category, collections]
  );
  const primaryDocs   = documents.filter((d) => !d.isTemporary);
  const temporaryDocs = documents.filter((d) => d.isTemporary);

  // ── Shared helpers ─────────────────────────────────────────────────────────
  async function submitKnowledge(event: React.FormEvent<HTMLFormElement>, temporary: boolean) {
    event.preventDefault();
    setError(""); setSuccess(""); setLoading(temporary ? "temporary" : "primary");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("sourceType",  sourceType);
    form.set("categoryName", categoryName);
    form.set("botId",        selectedBot);
    form.set("isTemporary",  temporary ? "true" : "false");
    if (selectedFile) {
      form.set("file", selectedFile);
    }
    const res  = await fetch("/api/knowledge", { method: "POST", body: form });
    const body = await res.json();
    setLoading("");
    if (!res.ok) { setError(body.error || "تعذر حفظ مصدر المعرفة."); return; }
    formElement.reset();
    setSelectedFile(null);
    setSuccess(temporary ? "تم حفظ البيانات المؤقتة وتدريبها." : "تم حفظ المعرفة الأساسية وتدريبها.");
    router.refresh();
  }

  async function saveJson(
    path: string, loadingKey: string,
    payload: Record<string, unknown>, msg: string
  ) {
    setError(""); setSuccess(""); setLoading(loadingKey);
    const res  = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json();
    setLoading("");
    if (!res.ok) { setError(body.error || "تعذر الحفظ."); return; }
    setSuccess(msg); router.refresh();
  }

  async function retrainAll() {
    setError(""); setSuccess(""); setLoading("retrain");
    const res  = await fetch("/api/knowledge/retrain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId: selectedBot }) });
    const body = await res.json();
    setLoading("");
    if (!res.ok) { setError(body.error || "تعذر إعادة التدريب."); return; }
    setSuccess(`تمت إعادة تدريب ${body.count || 0} مصدر معرفة.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ── Top bar: bot selector + tabs ── */}
      <section className="panel p-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div>
            <label className="label">البوت</label>
            <select className="field" value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)}>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-1 rounded-lg bg-slate-100 p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const count = tab.id === "primary" ? primaryDocs.length : tab.id === "temporary" ? temporaryDocs.length : null;
                return (
                  <button
                    key={tab.id} type="button"
                    onClick={() => { setActiveTab(tab.id); setSelectedFile(null); }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                      activeTab === tab.id ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
                    }`}
                  >
                    <Icon size={15} />
                    {tab.label}
                    {count !== null ? <span className="text-xs text-slate-400">({count})</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Alerts ── */}
      {error   ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>     : null}
      {success ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

      {/* ── PRIMARY KNOWLEDGE ── */}
      {activeTab === "primary" ? (
        <KnowledgeUploadPanel
          temporary={false} sourceType={sourceType} setSourceType={setSourceType}
          categoryName={categoryName} setCategoryName={setCategoryName}
          categories={categories} collections={visibleCollections}
          onSubmit={(e) => submitKnowledge(e, false)} loading={loading === "primary"}
          documents={primaryDocs}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
        />
      ) : null}

      {/* ── TEMPORARY DATA ── */}
      {activeTab === "temporary" ? (
        <KnowledgeUploadPanel
          temporary sourceType={sourceType} setSourceType={setSourceType}
          categoryName={categoryName} setCategoryName={setCategoryName}
          categories={categories} collections={visibleCollections}
          onSubmit={(e) => submitKnowledge(e, true)} loading={loading === "temporary"}
          documents={temporaryDocs}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
        />
      ) : null}

      {/* ── BOT SETTINGS ── */}
      {activeTab === "bot-settings" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Knowledge settings */}
          <form
            onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/settings", "settings", { botId: selectedBot, knowledgeEnabled: d.get("knowledgeEnabled") === "on", showKnowledgeSources: d.get("showKnowledgeSources") === "on", confidenceDirectThreshold: Number(d.get("confidenceDirectThreshold") || 70), confidenceReviewThreshold: Number(d.get("confidenceReviewThreshold") || 40) }, "تم حفظ إعدادات قاعدة المعرفة."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <DatabaseZap size={18} className="text-accent" />
              <h2 className="font-bold text-ink text-base">قاعدة المعرفة</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="knowledgeEnabled" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.knowledgeEnabled ?? true} />
              تفعيل قاعدة المعرفة كمصدر أول للحقيقة
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="showKnowledgeSources" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.showKnowledgeSources ?? false} />
              إظهار الاستشهاد بالمصدر في الرد
            </label>
            <div>
              <label className="label">حد الثقة للرد المباشر (%)</label>
              <input className="field" name="confidenceDirectThreshold" type="number" defaultValue={bot?.confidenceDirectThreshold ?? 70} min="0" max="100" />
              <p className="mt-1 text-xs text-slate-500">إذا تجاوزت ثقة البحث هذه القيمة، يرد البوت مباشرة.</p>
            </div>
            <div>
              <label className="label">حد الثقة للسؤال التوضيحي (%)</label>
              <input className="field" name="confidenceReviewThreshold" type="number" defaultValue={bot?.confidenceReviewThreshold ?? 40} min="0" max="100" />
              <p className="mt-1 text-xs text-slate-500">بين هذه القيمة والحد الأول، يرد مع تنبيه. أقل منها، يطلب توضيحاً.</p>
            </div>
            <button className="btn-primary" disabled={loading === "settings" || !selectedBot}>
              <Save size={16} /> حفظ إعدادات المعرفة
            </button>
          </form>

          {/* Bot identity */}
          <form
            onSubmit={async (e) => { e.preventDefault(); const d = new FormData(e.currentTarget); await saveJson("/api/bots/" + selectedBot, "identity", { name: String(d.get("name") || ""), description: String(d.get("description") || ""), isActive: d.get("isActive") === "on" }, "تم تحديث بيانات البوت."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-accent" />
              <h2 className="font-bold text-ink text-base">هوية البوت</h2>
            </div>
            <div>
              <label className="label">اسم البوت</label>
              <input className="field" name="name" defaultValue={bot?.name || ""} required />
            </div>
            <div>
              <label className="label">وصف البوت</label>
              <textarea className="field min-h-20" name="description" defaultValue={""} placeholder="بوت خدمة عملاء لمتجر الإلكترونيات..." />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="isActive" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={true} />
              البوت مفعّل
            </label>
            <button className="btn-secondary" disabled={loading === "identity" || !selectedBot}>
              <Save size={16} /> حفظ بيانات البوت
            </button>
          </form>
        </div>
      ) : null}

      {/* ── AI INSTRUCTIONS ── */}
      {activeTab === "instructions" ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <form
            onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/instructions", "instructions", { botId: selectedBot, systemPrompt: String(d.get("systemPrompt") || "") }, "تم حفظ تعليمات الذكاء الاصطناعي."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-accent" />
              <div>
                <h2 className="font-bold text-ink">تعليمات الذكاء الاصطناعي (System Prompt)</h2>
                <p className="text-sm text-slate-500">حدد شخصية البوت، نبرته، وما يجب تجنبه.</p>
              </div>
            </div>
            <textarea
              className="field min-h-52 font-mono text-sm leading-relaxed"
              name="systemPrompt"
              defaultValue={bot?.systemPrompt || "أنت مساعد ذكي احترافي.\nاستخدم لغة عربية واضحة ومختصرة.\nاستند دائماً إلى قاعدة المعرفة في إجاباتك.\nلا تعط أسعاراً أو شروطاً غير موجودة في المصادر.\nإذا لم تجد إجابة واضحة، اطلب توضيحاً من المستخدم."}
            />
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              💡 <strong>نصائح:</strong> أضف اسم شركتك · حدد لغة الرد · اذكر ما لا يجب الحديث عنه · أضف جملة ترحيب مخصصة.
            </div>
            <button className="btn-primary" disabled={loading === "instructions" || !selectedBot}>
              <Save size={16} /> حفظ التعليمات
            </button>
          </form>

          <form
            onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/settings", "settings2", { botId: selectedBot, knowledgeEnabled: bot?.knowledgeEnabled ?? true, showKnowledgeSources: d.get("showKnowledgeSources") === "on", confidenceDirectThreshold: bot?.confidenceDirectThreshold ?? 70, confidenceReviewThreshold: bot?.confidenceReviewThreshold ?? 40 }, "تم حفظ خيارات العرض."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={18} className="text-accent" />
              <h2 className="font-bold text-ink">خيارات الثقة والعرض</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="showKnowledgeSources" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.showKnowledgeSources ?? false} />
              إظهار مصادر الإجابة للمستخدم
            </label>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p>🎯 ثقة الرد المباشر: <strong>{bot?.confidenceDirectThreshold ?? 70}%</strong></p>
              <p>🔍 ثقة السؤال التوضيحي: <strong>{bot?.confidenceReviewThreshold ?? 40}%</strong></p>
              <p className="mt-1 text-slate-400">لتغيير هذه القيم، اذهب إلى تبويب &quot;إعدادات البوت&quot;.</p>
            </div>
            <button className="btn-secondary" disabled={loading === "settings2" || !selectedBot}>
              <Save size={16} /> حفظ
            </button>
          </form>
        </section>
      ) : null}

      {/* ── AUTOMATION ── */}
      {activeTab === "automation" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/automation", "automation", { botId: selectedBot, autoFollowupEnabled: d.get("autoFollowupEnabled") === "on", followupDelayMinutes: Number(d.get("followupDelayMinutes") || 60), followupMaxAttempts: Number(d.get("followupMaxAttempts") || 1), autoCloseEnabled: d.get("autoCloseEnabled") === "on", autoCloseAfterMinutes: Number(d.get("autoCloseAfterMinutes") || 1440), autoCloseMessage: String(d.get("autoCloseMessage") || "") }, "تم حفظ إعدادات الأتمتة."); }}
          className="panel max-w-3xl p-5 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-accent" />
            <div>
              <h2 className="font-bold text-ink">الأتمتة</h2>
              <p className="text-sm text-slate-500">تحكم في المتابعة التلقائية وإغلاق المحادثات غير النشطة.</p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
              <input name="autoFollowupEnabled" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.autoFollowupEnabled ?? false} />
              تفعيل المتابعة التلقائية
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">تأخير المتابعة (دقيقة)</label>
                <input className="field" name="followupDelayMinutes" type="number" defaultValue={bot?.followupDelayMinutes ?? 60} min="1" />
              </div>
              <div>
                <label className="label">الحد الأقصى لمرات المتابعة</label>
                <input className="field" name="followupMaxAttempts" type="number" defaultValue={bot?.followupMaxAttempts ?? 1} min="0" max="5" />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
              <input name="autoCloseEnabled" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.autoCloseEnabled ?? false} />
              تفعيل الإغلاق التلقائي للمحادثات الخاملة
            </label>
            <div>
              <label className="label">مهلة عدم النشاط (دقيقة)</label>
              <input className="field" name="autoCloseAfterMinutes" type="number" defaultValue={bot?.autoCloseAfterMinutes ?? 1440} min="1" />
              <p className="mt-1 text-xs text-slate-500">1440 دقيقة = 24 ساعة</p>
            </div>
            <div>
              <label className="label">رسالة الإغلاق</label>
              <textarea className="field min-h-20" name="autoCloseMessage" defaultValue={bot?.autoCloseMessage || "تم إغلاق المحادثة تلقائياً لعدم وجود نشاط. يمكنك بدء محادثة جديدة في أي وقت."} />
            </div>
          </div>

          <button className="btn-primary" disabled={loading === "automation" || !selectedBot}>
            <Save size={16} /> حفظ إعدادات الأتمتة
          </button>
        </form>
      ) : null}

      {/* ── Retrain button ── */}
      <div className="flex items-center gap-3">
        <button className="btn-secondary" type="button" onClick={retrainAll} disabled={loading === "retrain" || !selectedBot}>
          <RefreshCcw size={16} className={loading === "retrain" ? "animate-spin" : ""} />
          {loading === "retrain" ? "جار إعادة التدريب..." : "إعادة تدريب كل المستندات"}
        </button>
        {loading === "retrain" ? <p className="text-sm text-slate-500">قد يستغرق هذا بعض الوقت…</p> : null}
      </div>
    </div>
  );
}

// ─── Upload Panel ───────────────────────────────────────────────────────────────
function KnowledgeUploadPanel({
  temporary, sourceType, setSourceType, categoryName, setCategoryName,
  categories, collections, onSubmit, loading, documents,
  selectedFile, setSelectedFile,
}: {
  temporary: boolean; sourceType: string; setSourceType: (v: string) => void;
  categoryName: string; setCategoryName: (v: string) => void;
  categories: CategoryRow[]; collections: CollectionRow[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean; documents: DocumentRow[];
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
}) {
  const isFile = FILE_TYPES.includes(sourceType);
  const isUrl  = URL_TYPES.includes(sourceType);
  const isSubmitDisabled = loading || (isFile && !selectedFile);

  return (
    <div className="space-y-5">
      {temporary ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          ⚡ تجاوز الأولوية: البيانات المؤقتة تغلب المعرفة الأساسية عند التعارض، وتُحذف تلقائياً بعد انتهاء الصلاحية.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="panel overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5 flex items-center gap-3">
          <DatabaseZap size={20} className="text-accent" />
          <div>
            <h2 className="font-bold text-ink">{temporary ? "رفع بيانات مؤقتة" : "إضافة معرفة جديدة"}</h2>
            <p className="text-xs text-slate-500">{temporary ? "عروض، أسعار موسمية، مخزون مؤقت…" : "منتجات، خدمات، سياسات، أسئلة شائعة…"}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Source type selector — visual cards */}
          <div>
            <label className="label mb-2">نوع المعرفة</label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_TYPES.map(([value, label]) => (
                <button
                  key={value} type="button"
                  onClick={() => { setSourceType(value); setSelectedFile(null); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    sourceType === value
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {temporary ? (
              <div>
                <label className="label">مدة الصلاحية (أيام)</label>
                <input className="field" name="expiresDays" type="number" defaultValue="7" min="1" max="365" />
              </div>
            ) : null}

            <div>
              <label className="label">التصنيف (Category)</label>
              <input className="field" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} list="kb-categories" required />
              <datalist id="kb-categories">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div>
              <label className="label">المجموعة (Collection)</label>
              <input className="field" name="collectionName" defaultValue={collections[0]?.name || "عام"} list="kb-collections" required />
              <datalist id="kb-collections">{collections.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div className={isFile ? "" : "md:col-span-2"}>
              <label className="label">العنوان</label>
              <input className="field" name="title" placeholder={temporary ? "عرض نهاية الأسبوع" : "سياسة الاسترجاع — المتجر الإلكتروني"} required />
            </div>

            <div>
              <label className="label">الوسوم (Tags)</label>
              <input className="field" name="tags" placeholder="أسعار, ضمان, شحن" />
              <p className="mt-1 text-xs text-slate-500">افصل الوسوم بفاصلة. تُحسّن دقة البحث بشكل كبير.</p>
            </div>

            {/* URL input */}
            {isUrl ? (
              <div className="md:col-span-2">
                <label className="label">رابط الصفحة</label>
                <div className="flex items-center gap-2">
                  <Globe size={18} className="shrink-0 text-slate-400" />
                  <input className="field" name="sourceUrl" dir="ltr" placeholder="https://example.com/about" />
                </div>
              </div>
            ) : null}

            {/* File upload */}
            {isFile ? (
              <div className="md:col-span-2">
                <label className="label">الملف</label>
                <div className="relative">
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-primary-400 hover:bg-primary-50">
                    <FileUp size={28} className={selectedFile ? "text-primary-600 animate-pulse" : "text-slate-400"} />
                    {selectedFile ? (
                      <div className="space-y-1">
                        <span className="block text-sm font-semibold text-primary-700">{selectedFile.name}</span>
                        <span className="block text-xs text-slate-500">
                          حجم الملف: {(selectedFile.size / 1024 / 1024).toFixed(2)} ميغابايت · النوع: {selectedFile.type || "مستند"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-600">اسقط الملف هنا أو انقر للاختيار</span>
                        <span className="text-xs text-slate-400">PDF, DOCX, XLSX, TXT, CSV — الحجم الأقصى 20MB</span>
                      </>
                    )}
                    <input
                      className="hidden"
                      name="file"
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls"
                      required={!selectedFile}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                    />
                  </label>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="absolute left-3 top-3 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                    >
                      إلغاء الملف
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Text area */}
            <div className="md:col-span-2">
              <label className="label">
                {sourceType === "faq" ? "الأسئلة والأجوبة" :
                 sourceType === "product_catalog" ? "تفاصيل المنتجات" :
                 sourceType === "pricing" ? "خطط الأسعار والمزايا" :
                 "النص أو المحتوى"}
              </label>
              <textarea
                className="field min-h-40 font-mono text-sm leading-relaxed"
                name="text"
                placeholder={
                  sourceType === "faq"
                    ? "س: ما هي مدة الضمان؟\nج: سنتان لكل المنتجات.\n\nس: هل يشمل الضمان الكسر العرضي؟\nج: لا، الضمان يغطي عيوب التصنيع فقط."
                    : sourceType === "pricing"
                    ? "الخطة الأساسية: 29 دولار/شهر — 5 مستخدمين — دعم بريد إلكتروني\nالخطة الاحترافية: 79 دولار/شهر — 20 مستخدم — دعم أولوية…"
                    : "ضع المحتوى المراد تدريب البوت عليه…"
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 p-5 flex flex-col gap-3">
          <button className="btn-primary" disabled={isSubmitDisabled}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جار الرفع والمعالجة والتدريب...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>رفع ومعالجة</span>
              </>
            )}
          </button>
        </div>
      </form>

      <DocumentsTable
        title={temporary ? "المستندات المؤقتة" : "المستندات الأساسية"}
        documents={documents}
      />
    </div>
  );
}

// ─── Documents Table ────────────────────────────────────────────────────────────
function DocumentsTable({ title, documents }: { title: string; documents: DocumentRow[] }) {
  const statusBadge = (status: string) => {
    if (status === "ready")      return "badge-success";
    if (status === "error")      return "badge-error";
    if (status === "duplicate")  return "badge-warning";
    if (status === "processing") return "badge-info";
    return "badge-neutral";
  };
  const statusLabel: Record<string, string> = {
    ready: "جاهز", error: "خطأ", duplicate: "مكرر",
    processing: "يُعالج", pending: "بانتظار",
  };

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-100 p-4 flex items-center justify-between">
        <h2 className="font-bold text-ink">{title} <span className="text-slate-400">({documents.length})</span></h2>
      </div>
      {documents.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right">المستند</th>
                <th className="p-3 text-right">النوع</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">الأجزاء</th>
                <th className="p-3 text-right">آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-ink">
                    {doc.title}
                    {doc.expiresAt ? <p className="mt-0.5 text-xs text-amber-600">⏰ ينتهي: {new Date(doc.expiresAt).toLocaleDateString("ar-EG")}</p> : null}
                    {doc.statusReason ? <p className="mt-0.5 text-xs text-red-500">{doc.statusReason}</p> : null}
                  </td>
                  <td className="p-3 text-slate-500">{doc.sourceType}</td>
                  <td className="p-3">
                    <span className={`badge ${statusBadge(doc.status)}`}>
                      {statusLabel[doc.status] || doc.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">{doc.chunkCount}</td>
                  <td className="p-3 text-slate-500">{doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("ar-EG") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-sm text-slate-500">لا توجد مستندات بعد. أضف أول مصدر معرفة من الأعلى.</p>
      )}
    </section>
  );
}

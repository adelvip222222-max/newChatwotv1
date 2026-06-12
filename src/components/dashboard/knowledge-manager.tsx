"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Bot,
  Brain,
  Clock3,
  Code,
  Coins,
  ClipboardList,
  DatabaseZap,
  FileSpreadsheet,
  FileText,
  FileUp,
  Globe,
  HelpCircle,
  LifeBuoy,
  Loader2,
  PenLine,
  RefreshCcw,
  Save,
  Trash2,
  Wand2,
  ScrollText,
  Settings2,
  ShoppingCart,
  Sliders,
  Tags,
  Zap,
  BookOpen,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

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

const FILE_TYPES = ["pdf", "docx", "txt", "csv", "excel"];
const URL_TYPES  = ["website", "html"];

// ─── Helper translation functions ──────────────────────────────────────────────
const getSourceTypes = (isAr: boolean) => [
  { value: "custom_text",      label: isAr ? "نص مخصص / FAQ" : "Custom Text / FAQ", icon: PenLine },
  { value: "faq",              label: isAr ? "أسئلة شائعة (FAQ)" : "FAQ (Q&A)", icon: HelpCircle },
  { value: "product_catalog",  label: isAr ? "كتالوج المنتجات" : "Product Catalog", icon: ShoppingCart },
  { value: "services_catalog", label: isAr ? "كتالوج الخدمات" : "Services Catalog", icon: Tags },
  { value: "pricing",          label: isAr ? "خطط الأسعار" : "Pricing Plans", icon: Coins },
  { value: "policies",         label: isAr ? "السياسات" : "Policies", icon: ClipboardList },
  { value: "terms",            label: isAr ? "الشروط والأحكام" : "Terms & Conditions", icon: ScrollText },
  { value: "support_article",  label: isAr ? "مقال دعم" : "Support Article", icon: LifeBuoy },
  { value: "manual",           label: isAr ? "دليل استخدام" : "User Manual", icon: BookOpen },
  { value: "website",          label: isAr ? "رابط موقع" : "Website URL", icon: Globe },
  { value: "html",             label: isAr ? "صفحة HTML" : "HTML Page", icon: Code },
  { value: "pdf",              label: isAr ? "PDF" : "PDF Document", icon: FileText },
  { value: "docx",             label: isAr ? "Word (DOCX)" : "Word (DOCX)", icon: FileText },
  { value: "txt",              label: isAr ? "نص (TXT/CSV)" : "Text (TXT/CSV)", icon: FileText },
  { value: "excel",            label: isAr ? "Excel" : "Excel Sheet", icon: FileSpreadsheet },
] as const;

const getTabs = (isAr: boolean) => [
  { id: "primary",      label: isAr ? "المعرفة الأساسية" : "Primary Knowledge",  icon: BookOpenText },
  { id: "temporary",    label: isAr ? "البيانات المؤقتة" : "Temporary Data",  icon: Clock3       },
  { id: "bot-settings", label: isAr ? "إعدادات البوت" : "Bot Settings",     icon: Sliders      },
  { id: "instructions", label: isAr ? "تعليمات الذكاء" : "AI Instructions",    icon: Brain        },
  { id: "automation",   label: isAr ? "الأتمتة" : "Automation",           icon: Zap          },
] as const;

// ─── Main Component ─────────────────────────────────────────────────────────────
export function KnowledgeManager({
  bots, categories, collections, documents,
}: {
  bots: BotRow[]; categories: CategoryRow[];
  collections: CollectionRow[]; documents: DocumentRow[];
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const isAr = locale === "ar";

  const SOURCE_TYPES = useMemo(() => getSourceTypes(isAr), [isAr]);
  const TABS = useMemo(() => getTabs(isAr), [isAr]);
  type TabId = (typeof TABS)[number]["id"];

  const [activeTab,    setActiveTab]    = useState<TabId>("primary");
  const [sourceType,   setSourceType]   = useState("custom_text");
  const [categoryName, setCategoryName] = useState(categories[0]?.name || (isAr ? "الأسئلة الشائعة" : "FAQ"));
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
    if (!res.ok) { setError(body.error || (isAr ? "تعذر حفظ مصدر المعرفة." : "Could not save the knowledge source.")); return; }
    formElement.reset();
    setSelectedFile(null);
    setSuccess(temporary ? (isAr ? "تم حفظ البيانات المؤقتة وتدريبها." : "Temporary data saved and trained.") : (isAr ? "تم حفظ المعرفة الأساسية وتدريبها." : "Primary knowledge saved and trained."));
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
    if (!res.ok) { setError(body.error || (isAr ? "تعذر الحفظ." : "Could not save settings.")); return; }
    setSuccess(msg); router.refresh();
  }

  async function retrainAll() {
    setError(""); setSuccess(""); setLoading("retrain");
    const res  = await fetch("/api/knowledge/retrain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botId: selectedBot }) });
    const body = await res.json();
    setLoading("");
    if (!res.ok) { setError(body.error || (isAr ? "تعذر إعادة التدريب." : "Could not retrain documents.")); return; }
    setSuccess(isAr ? `تمت إعادة تدريب ${body.count || 0} مصدر معرفة.` : `Successfully retrained ${body.count || 0} knowledge sources.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ── Top bar: bot selector + tabs ── */}
      <section className="panel p-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div>
            <label className="label">{isAr ? "البوت" : "Bot"}</label>
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
          isAr={isAr}
          SOURCE_TYPES={SOURCE_TYPES}
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
          isAr={isAr}
          SOURCE_TYPES={SOURCE_TYPES}
        />
      ) : null}

      {/* ── BOT SETTINGS ── */}
      {activeTab === "bot-settings" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Knowledge settings */}
          <form
            onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/settings", "settings", { botId: selectedBot, knowledgeEnabled: d.get("knowledgeEnabled") === "on", showKnowledgeSources: d.get("showKnowledgeSources") === "on", confidenceDirectThreshold: Number(d.get("confidenceDirectThreshold") || 70), confidenceReviewThreshold: Number(d.get("confidenceReviewThreshold") || 40) }, isAr ? "تم حفظ إعدادات قاعدة المعرفة." : "Knowledge base settings saved."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <DatabaseZap size={18} className="text-accent" />
              <h2 className="font-bold text-ink text-base">{isAr ? "قاعدة المعرفة" : "Knowledge Base"}</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="knowledgeEnabled" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.knowledgeEnabled ?? true} />
              {isAr ? "تفعيل قاعدة المعرفة كمصدر أول للحقيقة" : "Enable knowledge base as primary source of truth"}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="showKnowledgeSources" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.showKnowledgeSources ?? false} />
              {isAr ? "إظهار الاستشهاد بالمصدر في الرد" : "Show citation sources in responses"}
            </label>
            <div>
              <label className="label">{isAr ? "حد الثقة للرد المباشر (%)" : "Direct response confidence threshold (%)"}</label>
              <input className="field" name="confidenceDirectThreshold" type="number" defaultValue={bot?.confidenceDirectThreshold ?? 70} min="0" max="100" />
              <p className="mt-1 text-xs text-slate-500">
                {isAr ? "إذا تجاوزت ثقة البحث هذه القيمة، يرد البوت مباشرة." : "If search confidence exceeds this value, the bot answers directly."}
              </p>
            </div>
            <div>
              <label className="label">{isAr ? "حد الثقة للسؤال التوضيحي (%)" : "Clarifying question confidence threshold (%)"}</label>
              <input className="field" name="confidenceReviewThreshold" type="number" defaultValue={bot?.confidenceReviewThreshold ?? 40} min="0" max="100" />
              <p className="mt-1 text-xs text-slate-500">
                {isAr ? "بين هذه القيمة والحد الأول، يرد مع تنبيه. أقل منها، يطلب توضيحاً." : "Between this value and the first limit, it replies with a warning. Below this, it asks for clarification."}
              </p>
            </div>
            <button className="btn-primary" disabled={loading === "settings" || !selectedBot}>
              <Save size={16} /> {isAr ? "حفظ إعدادات المعرفة" : "Save Knowledge Settings"}
            </button>
          </form>

          {/* Bot identity */}
          <form
            onSubmit={async (e) => { e.preventDefault(); const d = new FormData(e.currentTarget); await saveJson("/api/bots/" + selectedBot, "identity", { name: String(d.get("name") || ""), description: String(d.get("description") || ""), isActive: d.get("isActive") === "on" }, isAr ? "تم تحديث بيانات البوت." : "Bot identity updated."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-accent" />
              <h2 className="font-bold text-ink text-base">{isAr ? "هوية البوت" : "Bot Identity"}</h2>
            </div>
            <div>
              <label className="label">{isAr ? "اسم البوت" : "Bot Name"}</label>
              <input className="field" name="name" defaultValue={bot?.name || ""} required />
            </div>
            <div>
              <label className="label">{isAr ? "وصف البوت" : "Bot Description"}</label>
              <textarea className="field min-h-20" name="description" defaultValue={""} placeholder={isAr ? "بوت خدمة عملاء لمتجر الإلكترونيات..." : "Customer service bot for electronics store..."} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="isActive" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={true} />
              {isAr ? "البوت مفعّل" : "Bot is enabled"}
            </label>
            <button className="btn-secondary" disabled={loading === "identity" || !selectedBot}>
              <Save size={16} /> {isAr ? "حفظ بيانات البوت" : "Save Bot Info"}
            </button>
          </form>
        </div>
      ) : null}

      {/* ── AI INSTRUCTIONS ── */}
      {activeTab === "instructions" ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <form
            onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/instructions", "instructions", { botId: selectedBot, systemPrompt: String(d.get("systemPrompt") || "") }, isAr ? "تم حفظ تعليمات الذكاء الاصطناعي." : "AI instructions saved."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-accent" />
              <div>
                <h2 className="font-bold text-ink">{isAr ? "تعليمات الذكاء الاصطناعي (System Prompt)" : "AI Instructions (System Prompt)"}</h2>
                <p className="text-sm text-slate-500">{isAr ? "حدد شخصية البوت، نبرته، وما يجب تجنبه." : "Define the bot's persona, tone, and what to avoid."}</p>
              </div>
            </div>
            <textarea
              className="field min-h-52 font-mono text-sm leading-relaxed"
              name="systemPrompt"
              defaultValue={bot?.systemPrompt || (isAr 
                ? "أنت مساعد ذكي احترافي.\nاستخدم لغة عربية واضحة ومختصرة.\nاستند دائماً إلى قاعدة المعرفة في إجاباتك.\nلا تعط أسعاراً أو شروطاً غير موجودة في المصادر.\nإذا لم تجد إجابة واضحة، اطلب توضيحاً من المستخدم."
                : "You are a professional intelligent assistant.\nUse clear and concise language.\nAlways base your answers on the knowledge base.\nDo not give prices or terms not present in the sources.\nIf you do not find a clear answer, ask the user for clarification."
              )}
            />
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              {isAr 
                ? "💡 نصائح: أضف اسم شركتك · حدد لغة الرد · اذكر ما لا يجب الحديث عنه · أضف جملة ترحيب مخصصة."
                : "💡 Tips: Add your company name · Specify response language · Mention what to avoid · Add a custom greeting."}
            </div>
            <button className="btn-primary" disabled={loading === "instructions" || !selectedBot}>
              <Save size={16} /> {isAr ? "حفظ التعليمات" : "Save Instructions"}
            </button>
          </form>

          <form
            onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/settings", "settings2", { botId: selectedBot, knowledgeEnabled: bot?.knowledgeEnabled ?? true, showKnowledgeSources: d.get("showKnowledgeSources") === "on", confidenceDirectThreshold: bot?.confidenceDirectThreshold ?? 70, confidenceReviewThreshold: bot?.confidenceReviewThreshold ?? 40 }, isAr ? "تم حفظ خيارات العرض." : "Display settings saved."); }}
            className="panel p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={18} className="text-accent" />
              <h2 className="font-bold text-ink">{isAr ? "خيارات الثقة والعرض" : "Confidence & Display Options"}</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input name="showKnowledgeSources" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.showKnowledgeSources ?? false} />
              {isAr ? "إظهار مصادر الإجابة للمستخدم" : "Show answer sources to the user"}
            </label>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p>{isAr ? "🎯 ثقة الرد المباشر: " : "🎯 Direct Response Confidence: "}<strong>{bot?.confidenceDirectThreshold ?? 70}%</strong></p>
              <p>{isAr ? "🔍 ثقة السؤال التوضيحي: " : "🔍 Clarifying Question Confidence: "}<strong>{bot?.confidenceReviewThreshold ?? 40}%</strong></p>
              <p className="mt-1 text-slate-450">
                {isAr ? "لتغيير هذه القيم، اذهب إلى تبويب \"إعدادات البوت\"." : "To change these values, go to the 'Bot Settings' tab."}
              </p>
            </div>
            <button className="btn-secondary" disabled={loading === "settings2" || !selectedBot}>
              <Save size={16} /> {isAr ? "حفظ" : "Save"}
            </button>
          </form>
        </section>
      ) : null}

      {/* ── AUTOMATION ── */}
      {activeTab === "automation" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); saveJson("/api/knowledge/automation", "automation", { botId: selectedBot, autoFollowupEnabled: d.get("autoFollowupEnabled") === "on", followupDelayMinutes: Number(d.get("followupDelayMinutes") || 60), followupMaxAttempts: Number(d.get("followupMaxAttempts") || 1), autoCloseEnabled: d.get("autoCloseEnabled") === "on", autoCloseAfterMinutes: Number(d.get("autoCloseAfterMinutes") || 1440), autoCloseMessage: String(d.get("autoCloseMessage") || "") }, isAr ? "تم حفظ إعدادات الأتمتة." : "Automation settings saved."); }}
          className="panel max-w-3xl p-5 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-accent" />
            <div>
              <h2 className="font-bold text-ink">{isAr ? "الأتمتة" : "Automation"}</h2>
              <p className="text-sm text-slate-500">{isAr ? "تحكم في المتابعة التلقائية وإغلاق المحادثات غير النشطة." : "Control automatic follow-up and closure of inactive conversations."}</p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
              <input name="autoFollowupEnabled" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.autoFollowupEnabled ?? false} />
              {isAr ? "تفعيل المتابعة التلقائية" : "Enable Automatic Follow-up"}
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">{isAr ? "تأخير المتابعة (دقيقة)" : "Follow-up Delay (minutes)"}</label>
                <input className="field" name="followupDelayMinutes" type="number" defaultValue={bot?.followupDelayMinutes ?? 60} min="1" />
              </div>
              <div>
                <label className="label">{isAr ? "الحد الأقصى لمرات المتابعة" : "Max Follow-up Attempts"}</label>
                <input className="field" name="followupMaxAttempts" type="number" defaultValue={bot?.followupMaxAttempts ?? 1} min="0" max="5" />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
              <input name="autoCloseEnabled" type="checkbox" className="h-4 w-4 accent-primary-600" defaultChecked={bot?.autoCloseEnabled ?? false} />
              {isAr ? "تفعيل الإغلاق التلقائي للمحادثات الخاملة" : "Enable Auto-close for Idle Conversations"}
            </label>
            <div>
              <label className="label">{isAr ? "مهلة عدم النشاط (دقيقة)" : "Inactivity Timeout (minutes)"}</label>
              <input className="field" name="autoCloseAfterMinutes" type="number" defaultValue={bot?.autoCloseAfterMinutes ?? 1440} min="1" />
              <p className="mt-1 text-xs text-slate-500">{isAr ? "1440 دقيقة = 24 ساعة" : "1440 minutes = 24 hours"}</p>
            </div>
            <div>
              <label className="label">{isAr ? "رسالة الإغلاق" : "Closure Message"}</label>
              <textarea className="field min-h-20" name="autoCloseMessage" defaultValue={bot?.autoCloseMessage || (isAr ? "تم إغلاق المحادثة تلقائياً لعدم وجود نشاط. يمكنك بدء محادثة جديدة في أي وقت." : "The conversation was closed automatically due to inactivity. You can start a new conversation at any time.")} />
            </div>
          </div>

          <button className="btn-primary" disabled={loading === "automation" || !selectedBot}>
            <Save size={16} /> {isAr ? "حفظ إعدادات الأتمتة" : "Save Automation Settings"}
          </button>
        </form>
      ) : null}

      {/* ── Retrain button ── */}
      <div className="flex items-center gap-3">
        <button className="btn-secondary" type="button" onClick={retrainAll} disabled={loading === "retrain" || !selectedBot}>
          <RefreshCcw size={16} className={loading === "retrain" ? "animate-spin" : ""} />
          {loading === "retrain" ? (isAr ? "جار إعادة التدريب..." : "Retraining...") : (isAr ? "إعادة تدريب كل المستندات" : "Retrain all documents")}
        </button>
        {loading === "retrain" ? <p className="text-sm text-slate-500">{isAr ? "قد يستغرق هذا بعض الوقت…" : "This might take some time..."}</p> : null}
      </div>
    </div>
  );
}

// ─── Upload Panel ───────────────────────────────────────────────────────────────
function KnowledgeUploadPanel({
  temporary, sourceType, setSourceType, categoryName, setCategoryName,
  categories, collections, onSubmit, loading, documents,
  selectedFile, setSelectedFile, isAr, SOURCE_TYPES
}: {
  temporary: boolean; sourceType: string; setSourceType: (v: string) => void;
  categoryName: string; setCategoryName: (v: string) => void;
  categories: CategoryRow[]; collections: CollectionRow[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean; documents: DocumentRow[];
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  isAr: boolean;
  SOURCE_TYPES: ReturnType<typeof getSourceTypes>;
}) {
  const isFile = FILE_TYPES.includes(sourceType);
  const isUrl  = URL_TYPES.includes(sourceType);
  const isSubmitDisabled = loading || (isFile && !selectedFile);

  return (
    <div className="space-y-5">
      {temporary ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {isAr 
            ? "⚡ تجاوز الأولوية: البيانات المؤقتة تغلب المعرفة الأساسية عند التعارض، وتُحذف تلقائياً بعد انتهاء الصلاحية."
            : "⚡ Priority Override: Temporary data overrides primary knowledge in case of conflict, and is automatically deleted after expiration."}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="panel overflow-hidden">
        <div className="border-b border-slate-100 bg-white p-5 flex items-center gap-3">
          <DatabaseZap size={20} className="text-accent" />
          <div>
            <h2 className="font-bold text-ink">{temporary ? (isAr ? "رفع بيانات مؤقتة" : "Upload Temporary Data") : (isAr ? "إضافة معرفة جديدة" : "Add New Knowledge")}</h2>
            <p className="text-xs text-slate-500">
              {temporary 
                ? (isAr ? "عروض، أسعار موسمية، مخزون مؤقت…" : "Offers, seasonal prices, temporary stock...") 
                : (isAr ? "منتجات، خدمات، سياسات، أسئلة شائعة…" : "Products, services, policies, FAQs...")}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Source type selector — visual cards */}
          <div>
            <label className="label mb-2">{isAr ? "نوع المعرفة" : "Knowledge Type"}</label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value} type="button"
                  onClick={() => { setSourceType(value); setSelectedFile(null); }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    sourceType === value
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {temporary ? (
              <div>
                <label className="label">{isAr ? "مدة الصلاحية (أيام)" : "Validity Duration (days)"}</label>
                <input className="field" name="expiresDays" type="number" defaultValue="7" min="1" max="365" />
              </div>
            ) : null}

            <div>
              <label className="label">{isAr ? "التصنيف (Category)" : "Category"}</label>
              <input className="field" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} list="kb-categories" required />
              <datalist id="kb-categories">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div>
              <label className="label">{isAr ? "المجموعة (Collection)" : "Collection"}</label>
              <input className="field" name="collectionName" defaultValue={collections[0]?.name || (isAr ? "عام" : "general")} list="kb-collections" required />
              <datalist id="kb-collections">{collections.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div className={isFile ? "" : "md:col-span-2"}>
              <label className="label">{isAr ? "العنوان" : "Title"}</label>
              <input className="field" name="title" placeholder={temporary ? (isAr ? "عرض نهاية الأسبوع" : "Weekend Offer") : (isAr ? "سياسة الاسترجاع — المتجر الإلكتروني" : "Return Policy - E-Commerce")} required />
            </div>

            <div>
              <label className="label">{isAr ? "الوسوم (Tags)" : "Tags"}</label>
              <input className="field" name="tags" placeholder={isAr ? "أسعار, ضمان, شحن" : "pricing, warranty, shipping"} />
              <p className="mt-1 text-xs text-slate-500">{isAr ? "افصل الوسوم بفاصلة. تُحسّن دقة البحث بشكل كبير." : "Separate tags with commas. This significantly improves search accuracy."}</p>
            </div>

            {/* URL input */}
            {isUrl ? (
              <div className="md:col-span-2">
                <label className="label">{isAr ? "رابط الصفحة" : "Page URL"}</label>
                <div className="flex items-center gap-2">
                  <Globe size={18} className="shrink-0 text-slate-400" />
                  <input className="field" name="sourceUrl" dir="ltr" placeholder="https://example.com/about" />
                </div>
              </div>
            ) : null}

            {/* File upload */}
            {isFile ? (
              <div className="md:col-span-2">
                <label className="label">{isAr ? "الملف" : "File"}</label>
                <div className="relative">
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-primary-400 hover:bg-primary-50">
                    <FileUp size={28} className={selectedFile ? "text-primary-600 animate-pulse" : "text-slate-400"} />
                    {selectedFile ? (
                      <div className="space-y-1">
                        <span className="block text-sm font-semibold text-primary-700">{selectedFile.name}</span>
                        <span className="block text-xs text-slate-500">
                          {isAr ? "حجم الملف: " : "File size: "}{(selectedFile.size / 1024 / 1024).toFixed(2)} {isAr ? "ميغابايت" : "MB"} · {isAr ? "النوع: " : "Type: "}{selectedFile.type || (isAr ? "مستند" : "Document")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-600">{isAr ? "اسقط الملف هنا أو انقر للاختيار" : "Drop file here or click to choose"}</span>
                        <span className="text-xs text-slate-400">{isAr ? "PDF, DOCX, XLSX, TXT, CSV — الحجم الأقصى 20MB" : "PDF, DOCX, XLSX, TXT, CSV — Max Size 20MB"}</span>
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
                      {isAr ? "إلغاء الملف" : "Cancel file"}
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Text area */}
            <div className="md:col-span-2">
              <label className="label">
                {sourceType === "faq" ? (isAr ? "الأسئلة والأجوبة" : "Questions & Answers") :
                 sourceType === "product_catalog" ? (isAr ? "تفاصيل المنتجات" : "Product Details") :
                 sourceType === "pricing" ? (isAr ? "خطط الأسعار والمزايا" : "Pricing Plans & Features") :
                 (isAr ? "النص أو المحتوى" : "Text or Content")}
              </label>
              <textarea
                className="field min-h-40 font-mono text-sm leading-relaxed"
                name="text"
                placeholder={
                  sourceType === "faq"
                    ? (isAr 
                      ? "س: ما هي مدة الضمان؟\nج: سنتان لكل المنتجات.\n\nس: هل يشمل الضمان الكسر العرضي؟\nج: لا، الضمان يغطي عيوب التصنيع فقط."
                      : "Q: What is the warranty duration?\nA: Two years for all products.\n\nQ: Does the warranty cover accidental breakage?\nA: No, the warranty covers manufacturing defects only."
                    )
                    : sourceType === "pricing"
                    ? (isAr
                      ? "الخطة الأساسية: 29 دولار/شهر — 5 مستخدمين — دعم بريد إلكتروني\nالخطة الاحترافية: 79 دولار/شهر — 20 مستخدم — دعم أولوية…"
                      : "Basic Plan: $29/month — 5 users — email support\nPro Plan: $79/month — 20 users — priority support..."
                    )
                    : (isAr ? "ضع المحتوى المراد تدريب البوت عليه…" : "Place the content you want to train the bot on...")
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
                <span>{isAr ? "جار الرفع والمعالجة والتدريب..." : "Uploading, processing, and training..."}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isAr ? "رفع ومعالجة" : "Upload & Process"}</span>
              </>
            )}
          </button>
        </div>
      </form>

      <DocumentsTable
        title={temporary ? (isAr ? "المستندات المؤقتة" : "Temporary Documents") : (isAr ? "المستندات الأساسية" : "Primary Documents")}
        documents={documents}
        isAr={isAr}
      />
    </div>
  );
}

// ─── Documents Table ────────────────────────────────────────────────────────────
function DocumentsTable({ title, documents, isAr }: { title: string; documents: DocumentRow[]; isAr: boolean }) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState("");
  const [editDoc, setEditDoc] = useState<null | { id: string; title: string; rawText: string; sourceUrl: string; tags: string[] }>(null);
  const [tableError, setTableError] = useState("");

  const statusBadge = (status: string) => {
    if (status === "ready")      return "badge-success";
    if (status === "error")      return "badge-error";
    if (status === "duplicate")  return "badge-warning";
    if (status === "processing") return "badge-info";
    return "badge-neutral";
  };
  const statusLabel: Record<string, string> = {
    ready: isAr ? "جاهز" : "Ready",
    error: isAr ? "خطأ" : "Error",
    duplicate: isAr ? "مكرر" : "Duplicate",
    processing: isAr ? "يُعالج" : "Processing",
    pending: isAr ? "بانتظار" : "Pending",
    needs_retraining: isAr ? "يحتاج تدريب" : "Needs retraining",
  };

  async function readJson<T = any>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || (isAr ? "فشل الطلب." : "Request failed."));
    return body as T;
  }

  async function openEdit(id: string) {
    setTableError("");
    setWorkingId(id);
    try {
      const body = await readJson<{ document: { id: string; title: string; rawText: string; sourceUrl: string; tags: string[] } }>(
        await fetch(`/api/knowledge/${id}`, { cache: "no-store" })
      );
      setEditDoc(body.document);
    } catch (error) {
      setTableError(error instanceof Error ? error.message : "Error");
    } finally {
      setWorkingId("");
    }
  }

  async function saveEdit() {
    if (!editDoc) return;
    setWorkingId(editDoc.id);
    setTableError("");
    try {
      await readJson(await fetch(`/api/knowledge/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editDoc.title,
          rawText: editDoc.rawText,
          sourceUrl: editDoc.sourceUrl,
          tags: editDoc.tags
        })
      }));
      setEditDoc(null);
      router.refresh();
    } catch (error) {
      setTableError(error instanceof Error ? error.message : "Error");
    } finally {
      setWorkingId("");
    }
  }

  async function retrain(id: string) {
    setWorkingId(id);
    setTableError("");
    try {
      await readJson(await fetch("/api/knowledge/retrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id })
      }));
      router.refresh();
    } catch (error) {
      setTableError(error instanceof Error ? error.message : "Error");
    } finally {
      setWorkingId("");
    }
  }

  async function rewrite(id: string) {
    if (!window.confirm(isAr ? "إعادة صياغة هذا المصدر بالذكاء الاصطناعي؟" : "Rewrite this source with AI?")) return;
    setWorkingId(id);
    setTableError("");
    try {
      await readJson(await fetch(`/api/knowledge/${id}/rewrite`, { method: "POST" }));
      router.refresh();
    } catch (error) {
      setTableError(error instanceof Error ? error.message : "Error");
    } finally {
      setWorkingId("");
    }
  }

  async function remove(id: string) {
    if (!window.confirm(isAr ? "حذف مصدر المعرفة نهائيًا؟" : "Delete this knowledge source permanently?")) return;
    setWorkingId(id);
    setTableError("");
    try {
      await readJson(await fetch(`/api/knowledge/${id}`, { method: "DELETE" }));
      router.refresh();
    } catch (error) {
      setTableError(error instanceof Error ? error.message : "Error");
    } finally {
      setWorkingId("");
    }
  }

  const Actions = ({ doc }: { doc: DocumentRow }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold hover:bg-slate-50" onClick={() => void openEdit(doc.id)} disabled={workingId === doc.id}>
        <PenLine size={13} className="inline" /> {isAr ? "تعديل" : "Edit"}
      </button>
      <button type="button" className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100" onClick={() => void retrain(doc.id)} disabled={workingId === doc.id}>
        <RefreshCcw size={13} className={`inline ${workingId === doc.id ? "animate-spin" : ""}`} /> {isAr ? "تدريب" : "Train"}
      </button>
      <button type="button" className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100" onClick={() => void rewrite(doc.id)} disabled={workingId === doc.id}>
        <Wand2 size={13} className="inline" /> AI
      </button>
      <button type="button" className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100" onClick={() => void remove(doc.id)} disabled={workingId === doc.id}>
        <Trash2 size={13} className="inline" /> {isAr ? "حذف" : "Delete"}
      </button>
    </div>
  );

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-100 p-4 flex items-center justify-between">
        <h2 className="font-bold text-ink">{title} <span className="text-slate-400">({documents.length})</span></h2>
      </div>
      {tableError ? <p className="mx-4 mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{tableError}</p> : null}
      {documents.length ? (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {documents.map((doc) => (
              <article key={doc.id} className="mobile-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink">{doc.title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{doc.sourceType}</p>
                  </div>
                  <span className={`badge ${statusBadge(doc.status)}`}>{statusLabel[doc.status] || doc.status}</span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>{isAr ? "الأجزاء" : "Chunks"}: {doc.chunkCount}</span>
                  <span>{doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString(isAr ? "ar-EG" : "en-US") : "—"}</span>
                </div>
                {doc.expiresAt ? <p className="mt-2 text-xs text-amber-600">{isAr ? "ينتهي:" : "Expires:"} {new Date(doc.expiresAt).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</p> : null}
                {doc.statusReason ? <p className="mt-2 text-xs text-red-500">{doc.statusReason}</p> : null}
                <div className="mt-3"><Actions doc={doc} /></div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{isAr ? "المستند" : "Document"}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{isAr ? "النوع" : "Type"}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{isAr ? "الحالة" : "Status"}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{isAr ? "الأجزاء" : "Chunks"}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{isAr ? "آخر تحديث" : "Last Update"}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-ink">
                      {doc.title}
                      {doc.expiresAt ? <p className="mt-0.5 text-xs text-amber-600">{isAr ? "⏰ ينتهي: " : "⏰ Expires: "}{new Date(doc.expiresAt).toLocaleDateString(isAr ? "ar-EG" : "en-US")}</p> : null}
                      {doc.statusReason ? <p className="mt-0.5 text-xs text-red-500">{doc.statusReason}</p> : null}
                    </td>
                    <td className="p-3 text-slate-500">{doc.sourceType}</td>
                    <td className="p-3"><span className={`badge ${statusBadge(doc.status)}`}>{statusLabel[doc.status] || doc.status}</span></td>
                    <td className="p-3 text-center">{doc.chunkCount}</td>
                    <td className="p-3 text-slate-500">{doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString(isAr ? "ar-EG" : "en-US") : "—"}</td>
                    <td className="p-3"><Actions doc={doc} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="p-6 text-sm text-slate-500">{isAr ? "لا توجد مستندات بعد. أضف أول مصدر معرفة من الأعلى." : "No documents yet. Add your first knowledge source from above."}</p>
      )}

      {editDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">{isAr ? "تعديل مصدر المعرفة" : "Edit knowledge source"}</h3>
              <button type="button" className="rounded-md px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100" onClick={() => setEditDoc(null)}>×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">{isAr ? "العنوان" : "Title"}</label>
                <input className="field" value={editDoc.title} onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })} />
              </div>
              <div>
                <label className="label">{isAr ? "الرابط" : "URL"}</label>
                <input className="field" value={editDoc.sourceUrl} onChange={(e) => setEditDoc({ ...editDoc, sourceUrl: e.target.value })} />
              </div>
              <div>
                <label className="label">{isAr ? "الوسوم مفصولة بفواصل" : "Tags comma-separated"}</label>
                <input className="field" value={editDoc.tags.join(", ")} onChange={(e) => setEditDoc({ ...editDoc, tags: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
              </div>
              <div>
                <label className="label">{isAr ? "المحتوى" : "Content"}</label>
                <textarea className="field min-h-[260px] font-mono text-sm" value={editDoc.rawText} onChange={(e) => setEditDoc({ ...editDoc, rawText: e.target.value })} />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditDoc(null)}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button type="button" className="btn-primary" onClick={() => void saveEdit()} disabled={workingId === editDoc.id}>
                  {workingId === editDoc.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isAr ? "حفظ" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

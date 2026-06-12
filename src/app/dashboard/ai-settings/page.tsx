import { requireAdmin } from "@/lib/authz";
import { getAiSettings } from "@/lib/dashboard-data";
import { getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/page-header";
import { AiSettingsForm } from "@/components/dashboard/ai-settings-form";

export default async function AiSettingsPage() {
  const session = await requireAdmin();
  const data = await getAiSettings(session.user.tenantId);
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <>
      <PageHeader
        title={isAr ? "إعدادات AI" : "AI Settings"}
        description={
          isAr
            ? "اضبط تعليمات الذكاء الاصطناعي الأساسية لكل بوت."
            : "Configure basic AI instructions per bot."
        }
      />
      {data.bots.length ? (
        <AiSettingsForm
          tenantId={session.user.tenantId}
          bots={data.bots}
          aiModels={data.aiModels}
          initial={data.initial}
        />
      ) : (
        <p className="panel p-6 text-sm text-slate-500 dark:text-slate-400">
          {isAr
            ? "أنشئ بوتًا أولًا حتى تتمكن من ضبط الإعدادات."
            : "Create a bot first to configure settings."}
        </p>
      )}
    </>
  );
}

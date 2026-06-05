import { requireAdmin } from "@/lib/authz";
import { getAiSettings } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { AiSettingsForm } from "@/components/dashboard/ai-settings-form";

export default async function AiSettingsPage() {
  const session = await requireAdmin();
  const data = await getAiSettings(session.user.tenantId);

  return (
    <>
      <PageHeader title="إعدادات AI" description="اضبط OpenAI لكل بوت واحفظ المفتاح بشكل مخفي في الواجهة." />
      {data.bots.length && data.aiModels.length ? (
        <AiSettingsForm
          tenantId={session.user.tenantId}
          bots={data.bots}
          aiModels={data.aiModels}
          initial={data.initial}
        />
      ) : (
        <p className="panel p-6 text-sm text-slate-500">
          أنشئ بوتا وأضف نموذج AI من صفحة Admin AI أولا حتى تتمكن من ضبط إعدادات البوت.
        </p>
      )}
    </>
  );
}

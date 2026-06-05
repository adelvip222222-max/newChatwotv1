import { requireAdmin } from "@/lib/authz";
import { getAdminAiModels } from "@/lib/admin-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { AiModelAdmin } from "@/components/admin/ai-model-form";

export default async function AdminAiModelsPage() {
  const session = await requireAdmin();
  const models = await getAdminAiModels(session.user.tenantId);

  return (
    <>
      <PageHeader
        title="إدارة نماذج AI"
        description="هذه الصفحة للأدمن فقط. أضف مفاتيح ونماذج AI مشفرة ثم اخترها من إعدادات البوت."
      />
      <AiModelAdmin models={models} />
    </>
  );
}

import { requireAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/dashboard/page-header";
import { AiProvidersAdmin, type AiProviderRow } from "@/components/admin/ai-providers-admin";
import { connectToDatabase } from "@/lib/mongodb";
import { AiProvider } from "@/lib/models";

async function getAdminAiProviders(): Promise<AiProviderRow[]> {
  await connectToDatabase();
  const providers = await AiProvider.find().lean();
  return providers.map((p: any) => ({
    id: p._id.toString(),
    providerId: p.providerId,
    name: p.name,
    isConfigured: !!p.apiKeyEncrypted || (p.baseUrl && p.providerId === "ollama"),
    isActive: p.isActive,
    isDefault: p.isDefault,
    baseUrl: p.baseUrl || "",
    priority: p.priority || 0
  }));
}

export default async function AdminAiProvidersPage() {
  await requireAdmin();
  const providers = await getAdminAiProviders();

  return (
    <>
      <PageHeader
        title="مزودو الذكاء الاصطناعي (AI Providers)"
        description="هذه الصفحة للأدمن فقط. أضف مفاتيح الـ API للشركات، وسيقوم النظام بتوجيه محادثات المستخدمين بذكاء."
      />
      <AiProvidersAdmin providers={providers} />
    </>
  );
}

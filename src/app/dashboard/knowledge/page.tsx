import Link from "next/link";
import { Activity } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { getKnowledgeDashboardData } from "@/lib/knowledge";
import { PageHeader } from "@/components/dashboard/page-header";
import { KnowledgeManager } from "@/components/dashboard/knowledge-manager";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await requireAdmin();
  const data = await getKnowledgeDashboardData(session.user.tenantId);

  return (
    <>
      <PageHeader
        title="قاعدة المعرفة"
        description="نظم معرفة البوت إلى Categories وCollections وTags، ثم دربها لتكون مصدر الحقيقة الأول للردود."
        action={
          <Link href="/dashboard/knowledge/health" className="btn-secondary">
            <Activity size={18} />
            صحة المعرفة
          </Link>
        }
      />
      <KnowledgeManager {...data} />
    </>
  );
}

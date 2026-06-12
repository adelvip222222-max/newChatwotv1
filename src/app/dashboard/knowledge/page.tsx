import Link from "next/link";
import { Activity } from "lucide-react";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getKnowledgeDashboardData } from "@/lib/knowledge";
import { getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/page-header";
import { KnowledgeManager } from "@/components/dashboard/knowledge-manager";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await requirePermission(permissions.knowledgeManage);
  const [data, locale] = await Promise.all([getKnowledgeDashboardData(session.user.tenantId), getLocale()]);
  const isAr = locale === "ar";

  return (
    <>
      <PageHeader
        title={isAr ? "قاعدة المعرفة" : "Knowledge base"}
        description={
          isAr
            ? "نظم معرفة البوت إلى Categories وCollections وTags، ثم دربها لتكون مصدر الحقيقة الأول للردود."
            : "Organize bot knowledge into categories, collections, and tags, then train it as the primary answer source."
        }
        action={
          <Link href="/dashboard/knowledge/health" className="btn-secondary">
            <Activity size={18} />
            {isAr ? "صحة المعرفة" : "Knowledge health"}
          </Link>
        }
      />
      <KnowledgeManager {...data} />
    </>
  );
}

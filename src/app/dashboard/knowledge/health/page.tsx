import Link from "next/link";
import { ArrowRight, Database, FileText, Layers3, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getKnowledgeHealth } from "@/lib/knowledge";
import { getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/page-header";

export const dynamic = "force-dynamic";

export default async function KnowledgeHealthPage() {
  const session = await requirePermission(permissions.knowledgeManage);
  const [health, locale] = await Promise.all([getKnowledgeHealth(session.user.tenantId), getLocale()]);
  const isAr = locale === "ar";
  const stats = [
    { label: isAr ? "عدد الملفات" : "Documents", value: health.documents, icon: FileText },
    { label: isAr ? "عدد الصفحات" : "Pages", value: health.pages, icon: Database },
    { label: isAr ? "عدد Chunks" : "Chunks", value: health.chunks, icon: Layers3 },
    { label: isAr ? "عدد Embeddings" : "Embeddings", value: health.embeddings, icon: Sparkles },
    { label: isAr ? "الملفات المكررة" : "Duplicates", value: health.duplicates, icon: ShieldAlert },
    { label: isAr ? "غير معالجة" : "Unprocessed", value: health.unprocessed, icon: RefreshCcw },
    { label: isAr ? "تحتاج إعادة تدريب" : "Needs retraining", value: health.retraining, icon: RefreshCcw }
  ];

  return (
    <>
      <PageHeader
        title={isAr ? "صحة المعرفة" : "Knowledge health"}
        description={
          isAr
            ? "مؤشرات تشغيل قاعدة المعرفة والتدريب داخل هذا المستأجر."
            : "Operational health metrics for this tenant knowledge base and training."
        }
        action={
          <Link href="/dashboard/knowledge" className="btn-secondary">
            <ArrowRight size={18} className="rtl:rotate-180" />
            {isAr ? "رجوع" : "Back"}
          </Link>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="panel p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Icon size={21} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stat.value}</p>
            </article>
          );
        })}
      </section>
    </>
  );
}

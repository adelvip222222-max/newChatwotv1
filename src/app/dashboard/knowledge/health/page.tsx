import Link from "next/link";
import { ArrowRight, Database, FileText, Layers3, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { getKnowledgeHealth } from "@/lib/knowledge";
import { PageHeader } from "@/components/dashboard/page-header";

export const dynamic = "force-dynamic";

export default async function KnowledgeHealthPage() {
  const session = await requireAdmin();
  const health = await getKnowledgeHealth(session.user.tenantId);
  const stats = [
    { label: "عدد الملفات", value: health.documents, icon: FileText },
    { label: "عدد الصفحات", value: health.pages, icon: Database },
    { label: "عدد Chunks", value: health.chunks, icon: Layers3 },
    { label: "عدد Embeddings", value: health.embeddings, icon: Sparkles },
    { label: "الملفات المكررة", value: health.duplicates, icon: ShieldAlert },
    { label: "غير معالجة", value: health.unprocessed, icon: RefreshCcw },
    { label: "تحتاج إعادة تدريب", value: health.retraining, icon: RefreshCcw }
  ];

  return (
    <>
      <PageHeader
        title="صحة المعرفة"
        description="مؤشرات تشغيل قاعدة المعرفة والتدريب داخل هذا المستأجر."
        action={
          <Link href="/dashboard/knowledge" className="btn-secondary">
            <ArrowRight size={18} />
            رجوع
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
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-ink">{stat.value}</p>
            </article>
          );
        })}
      </section>
    </>
  );
}

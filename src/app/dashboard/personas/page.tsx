import Link from "next/link";
import { Bot, Plus, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getPersonas } from "@/lib/dashboard-data";
import { getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function PersonasPage() {
  const session = await requireSession();
  const personas = await getPersonas(session.user.tenantId);
  const locale = await getLocale();
  const isAr = locale === "ar";

  const labels = {
    title: isAr ? "الموظفون الآليون (AI Personas)" : "AI Personas",
    desc: isAr
      ? "إدارة شخصيات الذكاء الاصطناعي، السيناريوهات، والأدوات المخصصة لكل وظيفة."
      : "Manage AI personas, scenarios, and tools for each role.",
    newPersona: isAr ? "موظف جديد" : "New persona",
    role: isAr ? "المسمى الوظيفي" : "Role",
    model: isAr ? "نموذج الذكاء الاصطناعي" : "AI model",
    tools: isAr ? "الأدوات المسموحة" : "Allowed tools",
    status: isAr ? "الحالة" : "Status",
    active: isAr ? "نشط" : "Active",
    inactive: isAr ? "معطل" : "Inactive",
    emptyTitle: isAr ? "لا يوجد موظفون آليون بعد" : "No AI personas yet",
    emptyDesc: isAr ? "قم بإضافة أول شخصية AI لتبدأ باستقبال العملاء آليًا." : "Add your first AI persona to start receiving customers automatically."
  };

  return (
    <>
      <PageHeader
        title={labels.title}
        description={labels.desc}
        action={
          <Link href="/dashboard/personas/new" className="btn-primary">
            <Plus size={18} />
            {labels.newPersona}
          </Link>
        }
      />
      <section className="panel overflow-hidden">
        {personas.length ? (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {personas.map((persona) => (
                <article key={persona.id} className="mobile-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Bot size={16} />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-ink">{persona.roleName}</p>
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
                          <Sparkles size={11} />
                          {isAr ? "ذكاء اصطناعي" : "AI employee"}
                        </span>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{persona.aiModelName}</p>
                      </div>
                    </div>
                    {persona.isActive ? <span className="badge-success">{labels.active}</span> : <span className="badge-neutral">{labels.inactive}</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {persona.allowedTools.length === 0 ? <span className="text-slate-400">-</span> : null}
                    {persona.allowedTools.map((tool: string) => (
                      <span key={tool} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {tool}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{labels.role}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{labels.model}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{labels.tools}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{labels.status}</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-semibold text-ink">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <Bot size={16} />
                        </div>
                        <span>{persona.roleName}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
                          <Sparkles size={11} />
                          AI
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{persona.aiModelName}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {persona.allowedTools.length === 0 ? <span className="text-slate-400">-</span> : null}
                        {persona.allowedTools.map((tool: string) => (
                          <span key={tool} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {persona.isActive ? (
                        <span className="badge-success">{labels.active}</span>
                      ) : (
                        <span className="badge-neutral">{labels.inactive}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300">{labels.emptyTitle}</p>
            <p className="mb-6 mt-1 text-sm">{labels.emptyDesc}</p>
            <Link href="/dashboard/personas/new" className="btn-primary inline-flex">
              <Plus size={18} />
              {labels.newPersona}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

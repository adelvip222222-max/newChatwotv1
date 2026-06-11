import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getBots } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { getTranslations } from "@/lib/i18n";

export default async function BotsPage() {
  const session = await requireSession();
  const bots = await getBots(session.user.tenantId);
  const t = await getTranslations();

  return (
    <>
      <PageHeader
        title={t.bots.pageTitle}
        description={t.bots.pageDesc}
        action={
          <Link href="/dashboard/bots/new" className="btn-primary">
            <Plus size={18} />
            {t.bots.newBot}
          </Link>
        }
      />
      <section className="panel overflow-hidden">
        {bots.length ? (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {bots.map((bot) => (
                <article key={bot.id} className="mobile-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-ink">{bot.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{bot.description || "-"}</p>
                    </div>
                    {bot.isActive ? <span className="badge-success">{t.common.active}</span> : <span className="badge-neutral">{t.common.inactive}</span>}
                  </div>
                  <Link className="btn-secondary mt-4 w-full rounded-2xl px-3 py-2.5" href={`/dashboard/bots/${bot.id}`}>
                    <Pencil size={16} />
                    {t.common.edit}
                  </Link>
                </article>
              ))}
            </div>

            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{t.bots.botName}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{t.bots.botDesc}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{t.common.status}</th>
                  <th className="p-3 text-right rtl:text-right ltr:text-left">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-semibold text-ink">{bot.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-350">{bot.description || "-"}</td>
                    <td className="p-3">
                      {bot.isActive ? (
                        <span className="badge-success">{t.common.active}</span>
                      ) : (
                        <span className="badge-neutral">{t.common.inactive}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Link className="btn-secondary px-3 py-1.5" href={`/dashboard/bots/${bot.id}`}>
                        <Pencil size={16} />
                        {t.common.edit}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="p-6 text-sm text-slate-500">{t.bots.noBots}</p>
        )}
      </section>
    </>
  );
}

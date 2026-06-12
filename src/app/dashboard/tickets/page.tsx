import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Eye, TicketCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTickets } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";

const statusLabels: Record<string, string> = {
  open: "مفتوحة",
  pending: "قيد المتابعة",
  resolved: "تم الحل",
  closed: "مغلقة",
};

const priorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة",
};

const categoryLabels: Record<string, string> = {
  technical_support: "دعم فني",
  complaint: "شكوى",
  human_request: "طلب موظف",
  ai_failed: "فشل AI",
  general: "عام",
};

function statusClass(status: string) {
  if (status === "open") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function priorityClass(priority: string) {
  if (priority === "urgent") return "bg-red-50 text-red-700";
  if (priority === "high") return "bg-orange-50 text-orange-700";
  if (priority === "medium") return "bg-violet-50 text-violet-700";
  return "bg-slate-100 text-slate-600";
}

export default async function TicketsPage() {
  const session = await requireSession();
  const tickets = await getTickets(session.user.tenantId);

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;
  const pendingCount = tickets.filter((ticket) => ticket.status === "pending").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "resolved").length;

  return (
    <>
      <PageHeader
        title="التذاكر"
        description="لوحة متابعة طلبات الدعم والشكاوى المحولة من المحادثات."
      />

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <article className="panel p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <TicketCheck size={20} />
          </div>
          <p className="text-sm text-slate-500">تذاكر مفتوحة</p>
          <p className="mt-1 text-3xl font-bold text-ink">{openCount}</p>
        </article>
        <article className="panel p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <Clock3 size={20} />
          </div>
          <p className="text-sm text-slate-500">قيد المتابعة</p>
          <p className="mt-1 text-3xl font-bold text-ink">{pendingCount}</p>
        </article>
        <article className="panel p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm text-slate-500">تم حلها</p>
          <p className="mt-1 text-3xl font-bold text-ink">{resolvedCount}</p>
        </article>
      </section>

      <section className="panel overflow-hidden">
        {tickets.length ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right">رقم</th>
                <th className="p-3 text-right">الموضوع</th>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">الأولوية</th>
                <th className="p-3 text-right">النوع</th>
                <th className="p-3 text-right">آخر تحديث</th>
                <th className="p-3 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-semibold text-ink">#{ticket.number}</td>
                  <td className="max-w-sm p-3">
                    <Link href={`/dashboard/tickets/${ticket.id}`} className="font-semibold text-ink hover:text-accent">
                      {ticket.subject}
                    </Link>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <AlertTriangle size={12} />
                      {ticket.triggerReason || "-"}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-slate-700">{ticket.requesterExternalId}</p>
                    <p className="text-xs text-slate-500">{ticket.channel} · {ticket.botName}</p>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(ticket.status)}`}>
                      {statusLabels[ticket.status] || ticket.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClass(ticket.priority)}`}>
                      {priorityLabels[ticket.priority] || ticket.priority}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{categoryLabels[ticket.category] || ticket.category}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString("ar") : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Link className="btn-secondary px-3 py-1.5" href={`/dashboard/tickets/${ticket.id}`}>
                        <Eye size={16} />
                        عرض
                      </Link>
                      <Link className="btn-secondary px-3 py-1.5" href={`/dashboard/conversations/${ticket.conversationId}`}>
                        المحادثة
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-slate-500">لا توجد تذاكر بعد.</p>
        )}
      </section>
    </>
  );
}


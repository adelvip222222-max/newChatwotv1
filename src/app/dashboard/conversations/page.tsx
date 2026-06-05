import Link from "next/link";
import { Eye } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getConversations } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ConversationsPage() {
  const session = await requireSession();
  const conversations = await getConversations(session.user.tenantId);

  return (
    <>
      <PageHeader title="المحادثات" description="آخر محادثات العملاء عبر كل القنوات." />
      <section className="panel overflow-hidden">
        {conversations.length ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 text-right">البوت</th>
                <th className="p-3 text-right">القناة</th>
                <th className="p-3 text-right">المستخدم</th>
                <th className="p-3 text-right">آخر رسالة</th>
                <th className="p-3 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr key={conversation.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold text-ink">{conversation.botName}</td>
                  <td className="p-3">{conversation.channel}</td>
                  <td className="p-3">{conversation.externalUserId}</td>
                  <td className="max-w-md truncate p-3 text-slate-600">{conversation.lastMessage || "-"}</td>
                  <td className="p-3">
                    <Link className="btn-secondary px-3 py-1.5" href={`/dashboard/conversations/${conversation.id}`}>
                      <Eye size={16} />
                      عرض
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-slate-500">لا توجد محادثات بعد.</p>
        )}
      </section>
    </>
  );
}

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getBot } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { BotForm } from "@/components/dashboard/bot-form";

export default async function EditBotPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;
  const bot = await getBot(session.user.tenantId, id);
  if (!bot) notFound();

  return (
    <>
      <PageHeader title="تعديل البوت" description="غيّر الاسم والوصف وحالة التفعيل." />
      <BotForm bot={bot} />
    </>
  );
}

import { PageHeader } from "@/components/dashboard/page-header";
import { BotForm } from "@/components/dashboard/bot-form";
import { requireAdmin } from "@/lib/authz";

export default async function NewBotPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="بوت جديد" description="أنشئ بوتا جديدا واربطه بالقنوات لاحقا." />
      <BotForm />
    </>
  );
}

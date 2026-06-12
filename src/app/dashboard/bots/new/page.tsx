import { PageHeader } from "@/components/dashboard/page-header";
import { BotForm } from "@/components/dashboard/bot-form";
import { requireAdmin } from "@/lib/authz";
import { getLocale } from "@/lib/i18n";

export default async function NewBotPage() {
  await requireAdmin();
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <>
      <PageHeader
        title={isAr ? "بوت جديد" : "New bot"}
        description={isAr ? "أنشئ بوتًا جديدًا واربطه بالقنوات لاحقًا." : "Create a new bot and connect it to channels later."}
      />
      <BotForm />
    </>
  );
}

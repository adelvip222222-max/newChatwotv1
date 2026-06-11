import { requireSession } from "@/lib/auth";
import { Bot } from "@/lib/models";
export const dynamic = "force-dynamic";

import { connectToDatabase } from "@/lib/mongodb";
import { PageHeader } from "@/components/dashboard/page-header";
import { SimulatorClient } from "./client";
import { getLocale } from "@/lib/i18n";

export const metadata = { title: "محاكي البوت | ChatZi" };

export default async function SimulatorPage() {
  const session = await requireSession();
  await connectToDatabase();
  const locale = await getLocale();
  const isAr = locale === "ar";

  // Find the primary bot for the tenant
  const bot = await Bot.findOne({ tenantId: session.user.tenantId });

  if (!bot) {
    return (
      <div className="p-6">
        <PageHeader title={isAr ? "محاكي البوت" : "Bot Simulator"} description={isAr ? "جرب التحدث مع البوت الخاص بك" : "Try talking with your chatbot"} />
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-6 text-red-600 text-center font-medium">
          {isAr ? "لم يتم العثور على أي بوت مرتبط بحسابك." : "No chatbot associated with your account was found."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5 shrink-0 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold text-ink">{isAr ? "محاكي البوت (Simulator)" : "Bot Simulator"}</h1>
        <p className="text-sm text-accent mt-1">{isAr ? "تحدث مع البوت لتجربة ردوده بناءً على قاعدة المعرفة الخاصة بك." : "Chat with the bot to test its responses based on your knowledge base."}</p>
      </div>
      
      <div className="flex-1 overflow-hidden p-6">
        <div className="mx-auto flex h-full max-w-5xl gap-6">
          <SimulatorClient 
            botId={bot._id.toString()} 
            tenantId={session.user.tenantId} 
            botName={bot.name}
          />
        </div>
      </div>
    </div>
  );
}

import { connectToDatabase } from "@/lib/mongodb";
import { Bot } from "@/lib/models/bot";
import { LandingPage } from "@/components/landing/landing-page";

export const dynamic = "force-dynamic";

export default async function ArabicHomePage() {
  await connectToDatabase();
  const bot = await Bot.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  const botId = bot ? bot._id.toString() : "6a2293419b0cfb058bea9a3d";

  return <LandingPage locale="ar" botId={botId} />;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { Channel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";

const schema = z.object({
  botId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const channel = await Channel.findOne({
      tenantId: session.user.tenantId,
      botId: body.botId,
      type: "telegram",
      isActive: true
    });
    if (!channel) throw new Error("احفظ قناة Telegram وفعّلها أولًا.");

    const config = (channel.config || {}) as Record<string, unknown>;
    const token = decryptSecret(String(config.botTokenEncrypted || "")) || process.env.TELEGRAM_BOT_TOKEN || "";
    if (!token) throw new Error("أدخل توكن Telegram في شاشة القناة ثم احفظ.");

    const publicBaseUrl = String(config.publicBaseUrl || process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
    if (!publicBaseUrl || !publicBaseUrl.startsWith("https://")) {
      throw new Error("أدخل رابط HTTPS عام مثل رابط ngrok في حقل الرابط العام.");
    }

    const webhookUrl = `${publicBaseUrl}/api/channels/telegram/webhook`;
    const secretToken = String(config.webhookSecret || "");
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken || undefined,
        allowed_updates: ["message"]
      })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.description || "تعذر ربط Telegram Webhook.");
    }

    channel.config = {
      ...config,
      webhookUrl,
      webhookSetAt: new Date().toISOString()
    };
    await channel.save();

    return NextResponse.json({ ok: true, webhookUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر ربط Telegram Webhook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

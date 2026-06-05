import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  createChannelReply,
  findActiveChannel,
  logWebhook,
  sendTelegramMessage
} from "@/lib/channel-service";
import { decryptSecret } from "@/lib/crypto";

type TelegramUpdate = {
  message?: {
    chat?: { id: number | string };
    from?: { id?: number | string };
    text?: string;
  };
};

export async function POST(request: Request) {
  const payload = (await request.json()) as TelegramUpdate;
  let tenantId: string | undefined;
  let botId: string | undefined;

  try {
    await connectToDatabase();
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
    const channel = secretToken
      ? await findActiveChannel("telegram", { "config.webhookSecret": secretToken })
      : await findActiveChannel("telegram");
    if (!channel) throw new Error("لا توجد قناة Telegram مفعلة أو Secret Token غير مطابق.");

    tenantId = channel.tenantId.toString();
    botId = channel.botId.toString();
    const config = (channel.config || {}) as Record<string, unknown>;
    const token = decryptSecret(String(config.botTokenEncrypted || "")) || process.env.TELEGRAM_BOT_TOKEN || "";
    await logWebhook({ channel: "telegram", payload, tenantId, botId });

    const chatId = payload.message?.chat?.id;
    const text = payload.message?.text;
    const userId = payload.message?.from?.id || chatId;
    if (!chatId || !text || !userId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await createChannelReply({
      type: "telegram",
      tenantId,
      botId,
      externalUserId: String(userId),
      message: text,
      metadata: payload
    });

    await sendTelegramMessage(chatId, result.reply, token);
    await logWebhook({ channel: "telegram", payload, status: "success", tenantId, botId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram webhook error";
    await logWebhook({ channel: "telegram", payload, status: "error", error: message, tenantId, botId }).catch(
      () => null
    );
    if (tenantId && botId) {
      return NextResponse.json({ ok: true, handled: true, error: message });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

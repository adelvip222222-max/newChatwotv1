import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  createChannelReply,
  findActiveChannel,
  logWebhook,
  sendWhatsappMessage
} from "@/lib/channel-service";
import { decryptSecret } from "@/lib/crypto";

type WhatsAppPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from?: string;
          id?: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
};

export async function GET(request: Request) {
  await connectToDatabase();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!token || !challenge || mode !== "subscribe") {
    return NextResponse.json({ error: "فشل التحقق من WhatsApp." }, { status: 403 });
  }

  const channel = await findActiveChannel("whatsapp", { "config.verifyToken": token });
  if (!channel) return NextResponse.json({ error: "Verify token غير مطابق لأي مستأجر." }, { status: 403 });
  return new Response(challenge);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as WhatsAppPayload;
  let tenantId: string | undefined;
  let botId: string | undefined;

  try {
    await connectToDatabase();
    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    const channel = phoneNumberId
      ? await findActiveChannel("whatsapp", { "config.phoneNumberId": phoneNumberId })
      : await findActiveChannel("whatsapp");
    if (!channel) throw new Error("لا توجد قناة WhatsApp مفعلة لهذا المستأجر.");

    tenantId = channel.tenantId.toString();
    botId = channel.botId.toString();
    const config = (channel.config || {}) as Record<string, unknown>;
    const accessToken = decryptSecret(String(config.accessTokenEncrypted || "")) || process.env.WHATSAPP_TOKEN || "";
    const senderPhoneNumberId = String(config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "");
    await logWebhook({ channel: "whatsapp", payload, tenantId, botId });

    const message = value?.messages?.[0];
    const text = message?.text?.body;
    const from = message?.from;
    if (!from || !text) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await createChannelReply({
      type: "whatsapp",
      tenantId,
      botId,
      externalUserId: from,
      message: text,
      metadata: payload
    });

    await sendWhatsappMessage(from, result.reply, accessToken, senderPhoneNumberId);
    await logWebhook({ channel: "whatsapp", payload, status: "success", tenantId, botId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp webhook error";
    await logWebhook({ channel: "whatsapp", payload, status: "error", error: message, tenantId, botId }).catch(
      () => null
    );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  createChannelReply,
  findActiveChannel,
  logWebhook,
  sendFacebookMessage
} from "@/lib/channel-service";
import { decryptSecret } from "@/lib/crypto";

type MessengerPayload = {
  entry?: Array<{
    id?: string;
    messaging?: Array<{
      sender?: { id?: string };
      message?: { text?: string };
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
    return NextResponse.json({ error: "فشل التحقق من Messenger." }, { status: 403 });
  }

  const channel = await findActiveChannel("facebook", { "config.verifyToken": token });
  if (!channel) return NextResponse.json({ error: "Verify token غير مطابق لأي مستأجر." }, { status: 403 });
  return new Response(challenge);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as MessengerPayload;
  let tenantId: string | undefined;
  let botId: string | undefined;

  try {
    await connectToDatabase();
    const pageId = payload.entry?.[0]?.id;
    const channel = pageId
      ? await findActiveChannel("facebook", { "config.pageId": pageId })
      : await findActiveChannel("facebook");
    if (!channel) throw new Error("لا توجد قناة Messenger مفعلة لهذا المستأجر.");

    tenantId = channel.tenantId.toString();
    botId = channel.botId.toString();
    const config = (channel.config || {}) as Record<string, unknown>;
    const pageToken = decryptSecret(String(config.pageAccessTokenEncrypted || "")) || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
    await logWebhook({ channel: "facebook", payload, tenantId, botId });

    const event = payload.entry?.[0]?.messaging?.[0];
    const senderId = event?.sender?.id;
    const text = event?.message?.text;
    if (!senderId || !text) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await createChannelReply({
      type: "facebook",
      tenantId,
      botId,
      externalUserId: senderId,
      message: text,
      metadata: payload
    });

    await sendFacebookMessage(senderId, result.reply, pageToken);
    await logWebhook({ channel: "facebook", payload, status: "success", tenantId, botId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Messenger webhook error";
    await logWebhook({ channel: "facebook", payload, status: "error", error: message, tenantId, botId }).catch(
      () => null
    );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

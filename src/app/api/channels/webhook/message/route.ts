import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Channel } from "@/lib/models";
import { generateAiReply } from "@/lib/ai";
import { logWebhook } from "@/lib/channel-service";

const schema = z.object({
  tenantId: z.string().min(1),
  botId: z.string().min(1),
  userId: z.string().min(1),
  message: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = await request.json();

  try {
    const body = schema.parse(payload);
    await connectToDatabase();
    const channel = await Channel.findOne({
      tenantId: body.tenantId,
      botId: body.botId,
      type: "webhook",
      isActive: true
    });

    if (!channel) throw new Error("قناة Webhook غير مفعلة لهذا البوت.");

    await logWebhook({
      channel: "webhook",
      payload,
      tenantId: body.tenantId,
      botId: body.botId
    });

    const result = await generateAiReply({
      tenantId: body.tenantId,
      botId: body.botId,
      externalUserId: body.userId,
      channel: "webhook",
      message: body.message,
      metadata: payload
    });

    await logWebhook({
      channel: "webhook",
      payload,
      status: "success",
      tenantId: body.tenantId,
      botId: body.botId
    });

    return NextResponse.json({ reply: result.reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    await logWebhook({ channel: "webhook", payload, status: "error", error: message }).catch(() => null);
    return NextResponse.json({ error: message, reply: "" }, { status: 400 });
  }
}

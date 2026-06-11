import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/api-security";
import { Channel, Conversation } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { enqueueInboundWebhook } from "@/server/channels/webhookIngress";

const schema = z.object({
  botId: z.string().min(1),
  conversationId: z.string().min(1),
  visitorId: z.string().min(1),
  message: z.string().trim().min(1),
  attachments: z.array(z.any()).optional()
});

export async function POST(request: NextRequest) {
  try {
    checkRateLimit(`widget-message:${getClientIp(request)}`, { limit: 120, windowMs: 60_000 });
    const body = schema.parse(await request.json());
    await connectToDatabase();

    const conversation = await Conversation.findOne({
      _id: body.conversationId,
      botId: body.botId,
      channel: "website",
      externalUserId: body.visitorId,
      status: { $in: ["open", "snoozed"] }
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const channel = await Channel.findOne({
      tenantId: conversation.tenantId,
      botId: body.botId,
      type: "website",
      isActive: true
    });

    if (!channel) {
      return NextResponse.json({ error: "Website channel is not active" }, { status: 404 });
    }

    const result = await enqueueInboundWebhook({
      provider: "website",
      channelId: channel._id.toString(),
      tenantId: conversation.tenantId.toString(),
      request,
      payload: {
        id: `${body.conversationId}:${Date.now()}`,
        userId: body.visitorId,
        messageId: `web-in-${Date.now()}`,
        text: body.message,
        attachments: body.attachments || []
      }
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, queued: true, reply: "", traceId: result.traceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

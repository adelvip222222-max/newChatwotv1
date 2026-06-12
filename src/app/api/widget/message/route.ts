import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/api-security";
import { Channel, Conversation } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { enqueueInboundWebhook } from "@/server/channels/webhookIngress";

const attachmentSchema = z.object({
  type: z.string().optional(),
  url: z.string().optional(),
  dataUrl: z.string().optional(),
  name: z.string().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional()
}).passthrough();

const schema = z.object({
  botId: z.string().min(1),
  conversationId: z.string().min(1),
  visitorId: z.string().min(1),
  message: z.string().trim().optional(),
  content: z.string().trim().optional(),
  attachments: z.array(attachmentSchema).max(5).optional()
}).refine((value) => Boolean((value.message || value.content || "").trim()) || Boolean(value.attachments?.length), {
  message: "Message or attachment is required"
});

export async function POST(request: NextRequest) {
  try {
    checkRateLimit(`widget-message:${getClientIp(request)}`, { limit: 120, windowMs: 60_000 });
    const body = schema.parse(await request.json());
    const attachments = body.attachments || [];
    const messageText = (body.message || body.content || describeWidgetAttachments(attachments)).trim();
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
        text: messageText,
        attachments
      }
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, queued: true, reply: "", status: "queued", traceId: result.traceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


function describeWidgetAttachments(attachments: Array<{ type?: string; mimeType?: string; name?: string }>) {
  if (!attachments.length) return "أرسل العميل مرفقًا.";
  const parts = attachments.map((attachment) => {
    const kind = attachment.type || attachment.mimeType || "file";
    const name = attachment.name ? ` (${attachment.name})` : "";
    if (kind === "image" || kind.startsWith("image/")) return `صورة${name}`;
    if (kind === "audio" || kind.startsWith("audio/")) return `رسالة صوتية${name}`;
    if (kind === "video" || kind.startsWith("video/")) return `فيديو${name}`;
    return `مرفق${name}`;
  });
  return `أرسل العميل ${parts.join("، ")}.`;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectIdLike, assertTenantAccess } from "@/lib/api-security";
import { connectToDatabase } from "@/lib/mongodb";
import { Bot, Conversation, Message } from "@/lib/models";
import { coreRoutingQueue, defaultJobOptions, makeQueueJobId } from "@/lib/queues";
import { createTraceId } from "@/server/channels/webhookIngress";
import { publishRealtimeEvent } from "@/lib/realtime";

const schema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional().or(z.literal("")),
  botId: z.string().min(1),
  tenantId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    assertObjectIdLike(body.tenantId, "tenantId");
    assertObjectIdLike(body.botId, "botId");
    await assertTenantAccess(body.tenantId);
    await connectToDatabase();

    const bot = await Bot.findOne({ _id: body.botId, tenantId: body.tenantId, isActive: true });
    if (!bot) throw new Error("Bot not found.");

    const conversation = body.conversationId
      ? await Conversation.findOne({ _id: body.conversationId, tenantId: body.tenantId, botId: body.botId })
      : await Conversation.findOneAndUpdate(
          {
            tenantId: body.tenantId,
            botId: body.botId,
            channel: "api",
            externalUserId: "api-user",
            status: { $in: ["open", "pending", "snoozed"] }
          },
          {
            $setOnInsert: {
              tenantId: body.tenantId,
              botId: body.botId,
              channel: "api",
              provider: "api",
              externalUserId: "api-user",
              status: "open",
              mode: "ai"
            }
          },
          { new: true, upsert: true }
        );

    if (!conversation) throw new Error("Conversation not found.");

    const traceId = createTraceId("api");
    const message = await Message.create({
      tenantId: body.tenantId,
      botId: body.botId,
      conversationId: conversation._id,
      provider: "api",
      direction: "incoming",
      sender: "user",
      senderType: "customer",
      content: body.message,
      deliveryStatus: "delivered",
      metadata: { traceId }
    });

    const now = new Date();
    conversation.lastMessageAt = now;
    conversation.lastCustomerMessageAt = now;
    conversation.lastMessagePreview = body.message.slice(0, 220);
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    if (!conversation.firstResponseDueAt && !conversation.lastAgentMessageAt) {
      conversation.firstResponseDueAt = new Date(now.getTime() + 15 * 60_000);
    }
    if (!conversation.resolutionDueAt) {
      conversation.resolutionDueAt = new Date(now.getTime() + 24 * 60 * 60_000);
    }
    conversation.slaStatus = conversation.slaStatus || "on_track";
    await conversation.save();

    const createdAt = message.createdAt?.toISOString?.() || now.toISOString();
    const realtimePayload = {
      message: {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: message.content,
        direction: "incoming",
        sender: "user",
        senderType: "customer",
        provider: "api",
        deliveryStatus: "delivered",
        createdAt,
        attachments: []
      },
      conversation: {
        id: conversation._id.toString(),
        status: conversation.status,
        priority: conversation.priority,
        lastMessage: body.message.slice(0, 220),
        lastMessageAt: createdAt,
        unreadCount: conversation.unreadCount || 0,
        channel: conversation.channel,
        provider: "api"
      },
      contact: { name: conversation.externalUserId || "API User" }
    };
    publishRealtimeEvent(body.tenantId, "message.created", realtimePayload).catch(() => undefined);
    publishRealtimeEvent(body.tenantId, "notification.created", realtimePayload).catch(() => undefined);

    await coreRoutingQueue.add(
      "route-message",
      {
        tenantId: body.tenantId,
        provider: "api",
        conversationId: conversation._id.toString(),
        messageId: message._id.toString(),
        traceId
      },
      {
        ...defaultJobOptions,
        jobId: makeQueueJobId("route", message._id.toString())
      }
    );

    return NextResponse.json({ queued: true, reply: "", conversationId: conversation._id.toString(), traceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء توليد الرد.";
    return NextResponse.json({ error: message, reply: "" }, { status: 400 });
  }
}

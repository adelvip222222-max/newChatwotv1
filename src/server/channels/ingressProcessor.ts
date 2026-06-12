import { Bot, Channel, ChannelIdentity, Contact, Conversation, Message, WebhookEvent } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { coreRoutingQueue, defaultJobOptions, makeQueueJobId } from "@/lib/queues";
import { logger } from "@/lib/logger";
import { publishRealtimeEvent } from "@/lib/realtime";
import { getAdapter } from "./registry";
import { initializeAdapters } from "./providers";
import type { ChannelProvider } from "./types";

initializeAdapters();

const HANDOVER_KEYWORDS = ["human", "agent", "support", "موظف", "خدمة العملاء", "انسان"];

type IngressJobPayload = {
  tenantId: string;
  provider: ChannelProvider;
  channelId?: string;
  externalEventId: string;
  rawPayload: any;
  rawHeaders?: Record<string, string>;
  traceId?: string;
};

export async function processIngressJob(payload: IngressJobPayload) {
  await connectToDatabase();

  const channel = payload.channelId
    ? await Channel.findOne({ _id: payload.channelId, tenantId: payload.tenantId, type: payload.provider, isActive: true })
    : await resolveChannel(payload);

  if (!channel) {
    await markWebhookFailed(payload, "Channel not found or inactive");
    throw new Error("Channel not found or inactive");
  }

  await WebhookEvent.updateOne(
    { provider: payload.provider, externalEventId: payload.externalEventId },
    { $set: { status: "processing" } }
  );

  const adapter = getAdapter(payload.provider);
  const normalizedMessages = await adapter.normalizeIncoming(payload.rawPayload, channel);

  if (normalizedMessages.length === 0) {
    await WebhookEvent.updateOne(
      { provider: payload.provider, externalEventId: payload.externalEventId },
      { $set: { status: "ignored", processedAt: new Date() } }
    );
    logger.info("ingress.ignored", payload);
    return { processed: 0 };
  }

  let processed = 0;

  for (const normalized of normalizedMessages) {
    const identity = await findOrCreateIdentity(payload.tenantId, channel, normalized);
    const contact = await Contact.findOne({ _id: identity.contactId, tenantId: payload.tenantId });

    const conversation = await findOrCreateConversation(payload.tenantId, channel, identity, contact, normalized);
    await ensureConversationHasBot(payload.tenantId, conversation, channel);
    applyHandoffKeywords(conversation, normalized.text || "");
    conversation.lastMessageAt = normalized.timestamp;
    conversation.lastCustomerMessageAt = normalized.timestamp;
    conversation.lastMessagePreview = normalized.text || conversation.lastMessagePreview || "";
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    if (!conversation.firstResponseDueAt && !conversation.lastAgentMessageAt) {
      conversation.firstResponseDueAt = new Date(normalized.timestamp.getTime() + 15 * 60_000);
    }
    if (!conversation.resolutionDueAt) {
      conversation.resolutionDueAt = new Date(normalized.timestamp.getTime() + 24 * 60 * 60_000);
    }
    conversation.slaStatus = conversation.slaStatus || "on_track";
    if (conversation.status === "snoozed") conversation.status = "open";
    await conversation.save();

    let message;
    try {
      message = await Message.create({
        tenantId: payload.tenantId,
        botId: conversation.botId || channel.botId,
        conversationId: conversation._id,
        contactId: contact?._id,
        channelIdentityId: identity._id,
        provider: payload.provider,
        externalMessageId: normalized.externalMessageId,
        direction: "incoming",
        sender: "user",
        senderType: "customer",
        content: normalized.text || "",
        attachments: normalized.attachments || [],
        deliveryStatus: "delivered",
        metadata: { traceId: payload.traceId, raw: normalized.raw }
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        logger.info("ingress.message_duplicate", {
          tenantId: payload.tenantId,
          provider: payload.provider,
          externalMessageId: normalized.externalMessageId,
          traceId: payload.traceId
        });
        continue;
      }
      throw error;
    }

    const createdAt = message.createdAt?.toISOString?.() || new Date().toISOString();
    const realtimePayload = {
      message: {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: normalized.text || "",
        direction: "incoming",
        sender: "user",
        senderType: "customer",
        provider: payload.provider,
        deliveryStatus: "delivered",
        createdAt,
        attachments: normalized.attachments || []
      },
      conversation: {
        id: conversation._id.toString(),
        status: conversation.status,
        priority: conversation.priority,
        lastMessage: (normalized.text || "").slice(0, 220),
        lastMessageAt: createdAt,
        unreadCount: conversation.unreadCount || 0,
        channel: conversation.channel,
        provider: payload.provider
      },
      contact: {
        id: contact?._id?.toString?.() || "",
        name: contact?.name || contact?.email || contact?.phone || conversation.externalUserId || "Customer",
        email: contact?.email || "",
        phone: contact?.phone || "",
        avatarUrl: contact?.avatarUrl || ""
      }
    };

    publishRealtimeEvent(payload.tenantId, "message.created", realtimePayload).catch(() => undefined);
    publishRealtimeEvent(payload.tenantId, "notification.created", realtimePayload).catch(() => undefined);

    await coreRoutingQueue.add(
      "route-message",
      {
        tenantId: payload.tenantId,
        provider: payload.provider,
        channelId: channel._id.toString(),
        conversationId: conversation._id.toString(),
        messageId: message._id.toString(),
        externalMessageId: normalized.externalMessageId,
        traceId: payload.traceId
      },
      {
        ...defaultJobOptions,
        jobId: makeQueueJobId("route", message._id.toString())
      }
    );

    processed += 1;
  }

  await WebhookEvent.updateOne(
    { provider: payload.provider, externalEventId: payload.externalEventId },
    { $set: { status: "processed", processedAt: new Date() } }
  );

  logger.info("ingress.completed", { ...payload, processed });
  return { processed };
}

async function findOrCreateIdentity(tenantId: string, channel: any, normalized: any) {
  let identity = await ChannelIdentity.findOne({
    tenantId,
    channelId: channel._id,
    provider: normalized.provider,
    externalUserId: normalized.externalUserId
  });

  if (identity) {
    identity.lastSeenAt = normalized.timestamp;
    await identity.save();
    return identity;
  }

  const contact = await Contact.create({
    tenantId,
    name: normalized.customer?.name || "Unknown",
    email: normalized.customer?.email,
    phone: normalized.customer?.phone,
    lastSeenAt: normalized.timestamp
  });

  try {
    return await ChannelIdentity.create({
      tenantId,
      channelId: channel._id,
      contactId: contact._id,
      provider: normalized.provider,
      externalUserId: normalized.externalUserId,
      externalThreadId: normalized.externalThreadId,
      displayName: normalized.customer?.name,
      username: normalized.customer?.username,
      avatarUrl: normalized.customer?.avatarUrl,
      lastSeenAt: normalized.timestamp
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;

    const identity = await ChannelIdentity.findOneAndUpdate(
      {
        tenantId,
        channelId: channel._id,
        provider: normalized.provider,
        externalUserId: normalized.externalUserId
      },
      {
        $set: {
          externalThreadId: normalized.externalThreadId,
          displayName: normalized.customer?.name,
          username: normalized.customer?.username,
          avatarUrl: normalized.customer?.avatarUrl,
          lastSeenAt: normalized.timestamp
        }
      },
      { new: true }
    );

    if (!identity) throw error;

    await Contact.deleteOne({ _id: contact._id, tenantId }).catch(() => undefined);
    return identity;
  }
}

async function findOrCreateConversation(tenantId: string, channel: any, identity: any, contact: any, normalized: any) {
  const existing = await Conversation.findOne({
    tenantId,
    channelIdentityId: identity._id,
    status: { $in: ["open", "pending", "snoozed"] }
  });

  if (existing) return existing;

  return Conversation.create({
    tenantId,
    botId: channel.botId,
    channel: normalized.provider,
    contactId: contact?._id,
    channelIdentityId: identity._id,
    provider: normalized.provider,
    externalUserId: normalized.externalUserId,
    externalThreadId: normalized.externalThreadId,
    status: "open",
    mode: "ai",
    unreadCount: 0,
    lastMessagePreview: normalized.text || "",
    lastMessageAt: normalized.timestamp,
    lastCustomerMessageAt: normalized.timestamp,
    firstResponseDueAt: new Date(normalized.timestamp.getTime() + 15 * 60_000),
    resolutionDueAt: new Date(normalized.timestamp.getTime() + 24 * 60 * 60_000),
    slaStatus: "on_track"
  });
}

async function ensureConversationHasBot(tenantId: string, conversation: any, channel: any) {
  if (conversation.botId) return;
  if (channel.botId) {
    conversation.botId = channel.botId;
    return;
  }

  const fallbackBot = await Bot.findOne({ tenantId, isActive: true }).sort({ createdAt: 1 }).select("_id").lean();
  if (fallbackBot?._id) conversation.botId = fallbackBot._id;
}

function applyHandoffKeywords(conversation: any, text: string) {
  const textLower = text.toLowerCase();
  const isHandoff = HANDOVER_KEYWORDS.some((keyword) => textLower.includes(keyword));

  if (isHandoff) {
    const metadata = conversation.metadata && typeof conversation.metadata === "object" ? conversation.metadata : {};
    conversation.metadata = {
      ...metadata,
      aiPolicy: {
        ...(metadata as any).aiPolicy,
        handoffRequested: true,
        handoffRequestedAt: new Date().toISOString(),
        handoffKeywordMatched: true
      }
    };
    conversation.handoffReason = "handover_requested";
    conversation.aiStatus = "needs_review";
    conversation.mode = "ai";
    conversation.aiPaused = false;
    conversation.aiPausedReason = undefined;
    return;
  }

  if (
    conversation.aiPaused &&
    conversation.aiPausedReason === "agent_replied" &&
    conversation.mode === "human"
  ) {
    conversation.mode = "ai";
    conversation.aiPaused = false;
    conversation.aiPausedReason = undefined;
    conversation.aiStatus = "active";
  }
}

async function resolveChannel(payload: IngressJobPayload) {
  return Channel.findOne({
    tenantId: payload.tenantId,
    type: payload.provider,
    isActive: true
  });
}

async function markWebhookFailed(payload: IngressJobPayload, error: string) {
  await WebhookEvent.updateOne(
    { provider: payload.provider, externalEventId: payload.externalEventId },
    { $set: { status: "failed", error, processedAt: new Date() } }
  );
}

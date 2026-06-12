import { Channel, Contact, ChannelIdentity, Conversation, Message, WebhookEvent } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { getAdapter } from "./registry";
import { ChannelProvider } from "./types";
import { initializeAdapters } from "./providers";
import { coreRoutingQueue, defaultJobOptions, makeQueueJobId } from "@/lib/queues";
import { publishRealtimeEvent } from "@/lib/realtime";

initializeAdapters();

export interface IncomingPipelineParams {
  provider: ChannelProvider;
  channelId?: string;
  request: Request;
  payload: any;
}

const HANDOVER_KEYWORDS = ["human", "agent", "support", "موظف", "خدمة العملاء", "انسان"];

export async function handleIncomingChannelMessage({ provider, channelId, request, payload }: IncomingPipelineParams) {
  await connectToDatabase();

  const adapter = getAdapter(provider);
  
  // Find channel
  const channel = await resolveInboundChannel({ provider, channelId, request, payload });

  if (!channel) {
    return { success: false, error: "Channel not found or inactive" };
  }

  const tenantId = channel.tenantId;

  // Verify webhook
  const isValid = await adapter.verifyWebhook(request, channel);
  if (!isValid) {
    return { success: false, error: "Invalid webhook signature" };
  }

  // Normalize
  const normalizedMessages = await adapter.normalizeIncoming(payload, channel);

  if (normalizedMessages.length === 0) {
    // Save non-message event just in case
    await WebhookEvent.create({
      tenantId,
      channelId: channel._id,
      provider,
      externalEventId: Date.now().toString(),
      eventType: "unknown",
      status: "ignored",
      rawPayload: payload
    });
    return { success: true, message: "Ignored or non-message payload" };
  }

  for (const nMsg of normalizedMessages) {
    // Deduplicate
    const existingEvent = await WebhookEvent.findOne({ tenantId, provider, externalEventId: nMsg.externalEventId });
    if (existingEvent) {
      continue; // Skip duplicate
    }

    await WebhookEvent.create({
      tenantId,
      channelId: channel._id,
      provider,
      externalEventId: nMsg.externalEventId,
      eventType: "message",
      status: "processed",
      rawPayload: payload
    });

    // Resolve Contact
    let identity = await ChannelIdentity.findOne({
      tenantId,
      provider,
      externalUserId: nMsg.externalUserId
    });

    let contact;
    if (identity) {
      contact = await Contact.findById(identity.contactId);
      identity.lastSeenAt = nMsg.timestamp;
      await identity.save();
    } else {
      contact = await Contact.create({
        tenantId,
        name: nMsg.customer.name || "Unknown",
        email: nMsg.customer.email,
        phone: nMsg.customer.phone,
        lastSeenAt: nMsg.timestamp
      });
      identity = await ChannelIdentity.create({
        tenantId,
        channelId: channel._id,
        contactId: contact._id,
        provider,
        externalUserId: nMsg.externalUserId,
        displayName: nMsg.customer.name,
        username: nMsg.customer.username,
        lastSeenAt: nMsg.timestamp
      });
    }

    if (contact) {
      contact.lastSeenAt = nMsg.timestamp;
      await contact.save();
    }

    // Resolve Conversation
    let conversation = await Conversation.findOne({
      tenantId,
      channelIdentityId: identity._id,
      status: { $in: ["open", "snoozed"] } // active conversations
    });

    if (!conversation) {
      conversation = await Conversation.create({
        tenantId,
        botId: channel.botId,
        channel: provider,
        contactId: contact?._id,
        channelIdentityId: identity._id,
        provider,
        externalUserId: nMsg.externalUserId,
        externalThreadId: nMsg.externalThreadId,
        status: "open",
        mode: "ai",
        unreadCount: 1,
        lastMessagePreview: nMsg.text || "",
        lastMessageAt: nMsg.timestamp,
        lastCustomerMessageAt: nMsg.timestamp,
        firstResponseDueAt: new Date(nMsg.timestamp.getTime() + 15 * 60_000),
        resolutionDueAt: new Date(nMsg.timestamp.getTime() + 24 * 60 * 60_000),
        slaStatus: "on_track"
      });
    } else {
      conversation.lastMessageAt = nMsg.timestamp;
      conversation.lastCustomerMessageAt = nMsg.timestamp;
      conversation.lastMessagePreview = nMsg.text || conversation.lastMessagePreview || "";
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      if (!conversation.firstResponseDueAt && !conversation.lastAgentMessageAt) {
        conversation.firstResponseDueAt = new Date(nMsg.timestamp.getTime() + 15 * 60_000);
      }
      if (!conversation.resolutionDueAt) {
        conversation.resolutionDueAt = new Date(nMsg.timestamp.getTime() + 24 * 60 * 60_000);
      }
      conversation.slaStatus = conversation.slaStatus || "on_track";
      if (conversation.status === "snoozed") conversation.status = "open";
    }

    // Handover Detection
    const textLower = (nMsg.text || "").toLowerCase();
    const isHandover = HANDOVER_KEYWORDS.some(k => textLower.includes(k));
    
    if (isHandover) {
      conversation.mode = "human";
      conversation.aiPaused = true;
      conversation.aiPausedReason = "handover_requested";
      conversation.aiStatus = "escalated";
    } else if (
      conversation.aiPaused &&
      conversation.aiPausedReason === "agent_replied" &&
      conversation.mode === "human"
    ) {
      conversation.mode = "ai";
      conversation.aiPaused = false;
      conversation.aiPausedReason = undefined;
      conversation.aiStatus = "active";
    }

    await conversation.save();

    // Save Message
    const message = await Message.create({
      tenantId,
      botId: channel.botId,
      conversationId: conversation._id,
      contactId: contact?._id,
      channelIdentityId: identity._id,
      provider,
      externalMessageId: nMsg.externalMessageId,
      direction: "incoming",
      sender: "user",
      senderType: "customer",
      content: nMsg.text || "",
      attachments: nMsg.attachments || [],
      deliveryStatus: "delivered"
    });

    const createdAt = message.createdAt?.toISOString?.() || new Date().toISOString();
    const realtimePayload = {
      message: {
        id: message._id.toString(),
        conversationId: conversation._id.toString(),
        content: nMsg.text || "",
        direction: "incoming",
        sender: "user",
        senderType: "customer",
        provider,
        deliveryStatus: "delivered",
        createdAt,
        attachments: nMsg.attachments || []
      },
      conversation: {
        id: conversation._id.toString(),
        status: conversation.status,
        priority: conversation.priority,
        lastMessage: (nMsg.text || "").slice(0, 220),
        lastMessageAt: createdAt,
        unreadCount: conversation.unreadCount || 0,
        channel: conversation.channel,
        provider
      },
      contact: {
        id: contact?._id?.toString?.() || "",
        name: contact?.name || contact?.email || contact?.phone || conversation.externalUserId || "Customer",
        email: contact?.email || "",
        phone: contact?.phone || "",
        avatarUrl: contact?.avatarUrl || ""
      }
    };

    publishRealtimeEvent(tenantId.toString(), "message.created", realtimePayload).catch(() => undefined);
    publishRealtimeEvent(tenantId.toString(), "notification.created", realtimePayload).catch(() => undefined);

    await coreRoutingQueue.add(
      "route-message",
      {
        tenantId: tenantId.toString(),
        provider,
        channelId: channel._id.toString(),
        conversationId: conversation._id.toString(),
        messageId: message._id.toString(),
        externalMessageId: nMsg.externalMessageId
      },
      {
        ...defaultJobOptions,
        jobId: makeQueueJobId("route", message._id.toString())
      }
    );
  }

  return { success: true, queued: true };
}

async function resolveInboundChannel({
  provider,
  channelId,
  request,
  payload
}: IncomingPipelineParams) {
  if (channelId) {
    return Channel.findOne({ _id: channelId, type: provider, isActive: true });
  }

  const providerSpecificQuery = buildProviderChannelQuery(provider, request, payload);
  if (providerSpecificQuery) {
    const matched = await Channel.findOne({ type: provider, isActive: true, ...providerSpecificQuery });
    if (matched) return matched;
  }

  if (process.env.ALLOW_UNSAFE_CHANNEL_FALLBACK === "true" && process.env.NODE_ENV !== "production") {
    const candidates = await Channel.find({ type: provider, isActive: true }).limit(2);
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

function buildProviderChannelQuery(provider: ChannelProvider, request: Request, payload: any) {
  if (provider === "telegram") {
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    return secret ? { "config.webhookSecret": secret } : null;
  }

  if (provider === "whatsapp") {
    const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    return phoneNumberId ? { "config.phoneNumberId": phoneNumberId } : null;
  }

  if (provider === "facebook") {
    const pageId = payload?.entry?.[0]?.id;
    return pageId ? { "config.pageId": pageId } : null;
  }

  if (provider === "instagram") {
    const instagramBusinessId = payload?.entry?.[0]?.id;
    return instagramBusinessId ? { "config.instagramBusinessId": instagramBusinessId } : null;
  }

  return null;
}

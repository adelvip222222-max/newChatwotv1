import { Bot, Channel, Conversation, Message, Tenant, WebhookLog, AiSetting, AiModel, Ticket } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export async function getTenantSummary(tenantId: string) {
  await connectToDatabase();
  const [bots, conversations, messages, activeChannels, tickets, tenant] = await Promise.all([
    Bot.countDocuments({ tenantId }),
    Conversation.countDocuments({ tenantId }),
    Message.countDocuments({ tenantId }),
    Channel.countDocuments({ tenantId, isActive: true }),
    Ticket.countDocuments({ tenantId, status: { $in: ["open", "pending"] } }),
    Tenant.findById(tenantId).lean()
  ]);
  return { bots, conversations, messages, activeChannels, tickets, tenantName: tenant?.name || "ChatZi" };
}

export async function getBots(tenantId: string) {
  await connectToDatabase();
  const bots = await Bot.find({ tenantId }).sort({ createdAt: -1 }).lean();
  return bots.map((bot) => ({
    id: bot._id.toString(),
    name: bot.name,
    avatar: bot.avatar || "",
    description: bot.description || "",
    isActive: bot.isActive,
    createdAt: bot.createdAt?.toISOString() || ""
  }));
}

export async function getBot(tenantId: string, id: string) {
  await connectToDatabase();
  const bot = await Bot.findOne({ _id: id, tenantId }).lean();
  if (!bot) return null;
  return {
    id: bot._id.toString(),
    name: bot.name,
    avatar: bot.avatar || "",
    description: bot.description || "",
    isActive: bot.isActive
  };
}

export async function getConversations(tenantId: string) {
  await connectToDatabase();
  const conversations = await Conversation.find({ tenantId }).sort({ updatedAt: -1 }).limit(50).lean();
  return Promise.all(
    conversations.map(async (conversation) => {
      const bot = await Bot.findById(conversation.botId).lean();
      const lastMessage = await Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 }).lean();
      return {
        id: conversation._id.toString(),
        botName: bot?.name || "-",
        channel: conversation.channel,
        externalUserId: conversation.externalUserId,
        status: conversation.status,
        lastMessage: lastMessage?.content || "",
        updatedAt: conversation.updatedAt?.toISOString() || ""
      };
    })
  );
}

export async function getConversationDetail(tenantId: string, id: string) {
  await connectToDatabase();
  const conversation = await Conversation.findOne({ _id: id, tenantId }).lean();
  if (!conversation) return null;
  const [bot, messages, ticket] = await Promise.all([
    Bot.findById(conversation.botId).lean(),
    Message.find({ conversationId: conversation._id, tenantId }).sort({ createdAt: 1 }).lean(),
    Ticket.findOne({ conversationId: conversation._id, tenantId, status: { $in: ["open", "pending"] } })
      .sort({ createdAt: -1 })
      .lean()
  ]);
  return {
    id: conversation._id.toString(),
    botName: bot?.name || "-",
    channel: conversation.channel,
    externalUserId: conversation.externalUserId,
    status: conversation.status,
    ticket: ticket
      ? {
          id: ticket._id.toString(),
          number: ticket.number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category
        }
      : null,
    messages: messages.map((message) => ({
      id: message._id.toString(),
      sender: message.sender,
      content: message.content,
      attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        type: attachment.type,
        key: attachment.key,
        url: attachment.url || "",
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size
      })),
      createdAt: message.createdAt?.toISOString() || ""
    }))
  };
}

export async function getTickets(tenantId: string) {
  await connectToDatabase();
  const tickets = await Ticket.find({ tenantId }).sort({ updatedAt: -1 }).limit(100).lean();

  return Promise.all(
    tickets.map(async (ticket) => {
      const [bot, conversation] = await Promise.all([
        Bot.findById(ticket.botId).lean(),
        Conversation.findById(ticket.conversationId).lean()
      ]);

      return {
        id: ticket._id.toString(),
        number: ticket.number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        channel: ticket.channel,
        requesterExternalId: ticket.requesterExternalId,
        botName: bot?.name || "-",
        conversationId: ticket.conversationId.toString(),
        conversationStatus: conversation?.status || "-",
        triggerReason: ticket.triggerReason || "",
        createdAt: ticket.createdAt?.toISOString() || "",
        updatedAt: ticket.updatedAt?.toISOString() || ""
      };
    })
  );
}

export async function getTicketDetail(tenantId: string, id: string) {
  await connectToDatabase();
  const ticket = await Ticket.findOne({ _id: id, tenantId }).lean();
  if (!ticket) return null;

  const [bot, conversation, messages] = await Promise.all([
    Bot.findById(ticket.botId).lean(),
    Conversation.findOne({ _id: ticket.conversationId, tenantId }).lean(),
    Message.find({ conversationId: ticket.conversationId, tenantId }).sort({ createdAt: 1 }).lean()
  ]);

  return {
    id: ticket._id.toString(),
    number: ticket.number,
    subject: ticket.subject,
    description: ticket.description || "",
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    requesterExternalId: ticket.requesterExternalId,
    channel: ticket.channel,
    botName: bot?.name || "-",
    conversationId: ticket.conversationId.toString(),
    conversationStatus: conversation?.status || "-",
    triggerReason: ticket.triggerReason || "",
    aiSummary: ticket.aiSummary || "",
    createdAt: ticket.createdAt?.toISOString() || "",
    updatedAt: ticket.updatedAt?.toISOString() || "",
    messages: messages.map((message) => ({
      id: message._id.toString(),
      sender: message.sender,
      content: message.content,
      attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        type: attachment.type,
        key: attachment.key,
        url: attachment.url || "",
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size
      })),
      createdAt: message.createdAt?.toISOString() || ""
    }))
  };
}

export async function getAiSettings(tenantId: string) {
  await connectToDatabase();
  const bots = await getBots(tenantId);
  const firstBotId = bots[0]?.id;
  const [setting, aiModels] = await Promise.all([
    firstBotId ? AiSetting.findOne({ tenantId, botId: firstBotId }).lean() : null,
    AiModel.find({ isActive: true }).sort({ isDefault: -1, createdAt: -1 }).lean()
  ]);
  return {
    bots: bots.map((bot) => ({ id: bot.id, name: bot.name })),
    aiModels: aiModels.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      provider: item.provider,
      model: item.model,
      isDefault: item.isDefault
    })),
    initial: setting
      ? {
          botId: setting.botId.toString(),
          aiModelId: setting.aiModelId?.toString() || "",
          isEnabled: setting.isEnabled,
          temperature: setting.temperature,
          systemPrompt: setting.systemPrompt,
          language: setting.language || "auto",
          role: setting.role || "assistant",
          tone: setting.tone || "neutral",
          responseLength: setting.responseLength || "medium",
          fallbackMessage: setting.fallbackMessage || "عذراً، لم أفهم طلبك جيداً. هل يمكنك التوضيح؟",
          useEmojis: setting.useEmojis ?? true
        }
      : undefined
  };
}

export async function getChannelPageData(tenantId: string, type: string) {
  await connectToDatabase();
  const bots = await getBots(tenantId);
  const firstBotId = bots[0]?.id;
  const channel = firstBotId
    ? await Channel.findOne({ tenantId, type, botId: firstBotId }).lean()
    : await Channel.findOne({ tenantId, type }).lean();
  const logs = await WebhookLog.find({ tenantId, channel: type }).sort({ createdAt: -1 }).limit(10).lean();

  const safeConfig = channel?.config && typeof channel.config === "object"
    ? { ...((channel.config || {}) as Record<string, unknown>) }
    : {};
  if (type === "telegram") {
    safeConfig.tokenConfigured = Boolean(safeConfig.tokenConfigured || safeConfig.botTokenEncrypted);
    delete safeConfig.botTokenEncrypted;
  }
  if (type === "whatsapp") {
    safeConfig.tokenConfigured = Boolean(safeConfig.tokenConfigured || safeConfig.accessTokenEncrypted);
    delete safeConfig.accessTokenEncrypted;
  }
  if (type === "facebook") {
    safeConfig.tokenConfigured = Boolean(safeConfig.tokenConfigured || safeConfig.pageAccessTokenEncrypted);
    delete safeConfig.pageAccessTokenEncrypted;
  }

  return {
    bots: bots.map((bot) => ({ id: bot.id, name: bot.name })),
    initial: channel
      ? {
          botId: channel.botId.toString(),
          name: channel.name,
          isActive: channel.isActive,
          config: safeConfig
        }
      : undefined,
    logs: logs.map((log) => ({
      id: log._id.toString(),
      status: log.status,
      error: log.error || "",
      createdAt: log.createdAt?.toISOString() || ""
    }))
  };
}

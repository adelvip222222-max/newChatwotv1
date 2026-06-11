import { Bot, Channel, Conversation, Message, Tenant, WebhookLog, AiSetting, AiModel, AiPersona } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export async function getTenantSummary(tenantId: string) {
  await connectToDatabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [bots, conversations, messages, activeChannels, tenant, activeConversations, aiResolved, humanResolved, todayMessages] = await Promise.all([
    Bot.countDocuments({ tenantId }),
    Conversation.countDocuments({ tenantId }),
    Message.countDocuments({ tenantId }),
    Channel.countDocuments({ tenantId, isActive: true }),
    Tenant.findById(tenantId).lean(),
    Conversation.countDocuments({ tenantId, status: { $in: ["open", "pending", "snoozed"] } }),
    Conversation.countDocuments({ tenantId, status: { $in: ["resolved", "closed"] }, mode: "ai" }),
    Conversation.countDocuments({ tenantId, status: { $in: ["resolved", "closed"] }, mode: { $in: ["human", "hybrid"] } }),
    Message.countDocuments({ tenantId, createdAt: { $gte: today } }),
  ]);
  const totalResolved = aiResolved + humanResolved;
  return {
    bots,
    conversations,
    messages,
    activeChannels,
    activeConversations,
    todayMessages,
    aiResolutionRate: totalResolved ? Math.round((aiResolved / totalResolved) * 100) : 0,
    humanResolutionRate: totalResolved ? Math.round((humanResolved / totalResolved) * 100) : 0,
    tenantName: tenant?.name || "ChatZi"
  };
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
  const [bot, messages] = await Promise.all([
    Bot.findById(conversation.botId).lean(),
    Message.find({ conversationId: conversation._id, tenantId }).sort({ createdAt: 1 }).lean()
  ]);
  return {
    id: conversation._id.toString(),
    botName: bot?.name || "-",
    channel: conversation.channel,
    externalUserId: conversation.externalUserId,
    status: conversation.status,
    messages: messages.map((message) => ({
      id: message._id.toString(),
      sender: message.sender,
      content: message.content,
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
  if (type === "instagram") {
    safeConfig.tokenConfigured = Boolean(safeConfig.tokenConfigured || safeConfig.accessTokenEncrypted);
    delete safeConfig.accessTokenEncrypted;
  }
  if (type === "email") {
    safeConfig.passwordConfigured = Boolean(safeConfig.passwordConfigured || safeConfig.smtpPasswordEncrypted);
    delete safeConfig.smtpPasswordEncrypted;
  }
  if (type === "api") {
    safeConfig.tokenConfigured = Boolean(safeConfig.tokenConfigured || safeConfig.apiKeyEncrypted);
    delete safeConfig.apiKeyEncrypted;
  }

  return {
    bots: bots.map((bot) => ({ id: bot.id, name: bot.name })),
    initial: channel
      ? {
          botId: channel.botId?.toString() || "",
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

export async function getDashboardActivity(tenantId: string) {
  await connectToDatabase();
  
  // Last 7 days chart data
  const chartData = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    
    const count = await Message.countDocuments({
      tenantId,
      createdAt: { $gte: start, $lte: end }
    });
    
    chartData.push({
      date: start.toLocaleDateString('en-US', { weekday: 'short' }),
      messages: count
    });
  }

  // Recent 5 conversations
  const recentConversations = await Conversation.find({ tenantId })
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  const recentList = await Promise.all(
    recentConversations.map(async (conversation) => {
      const bot = await Bot.findById(conversation.botId).lean();
      const lastMessage = await Message.findOne({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .lean();
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

  return { chartData, recentConversations: recentList };
}

export async function getAvailableAiModels() {
  await connectToDatabase();
  const models = await AiModel.find({ isActive: true }).sort({ isDefault: -1, createdAt: -1 }).lean();
  return models.map((m) => ({
    id: m._id.toString(),
    name: m.name,
    provider: m.provider
  }));
}

export async function getPersonas(tenantId: string) {
  await connectToDatabase();
  const personas = await AiPersona.find({ tenantId }).populate("aiModelId", "name provider").sort({ createdAt: -1 }).lean();

  return personas.map((p: any) => ({
    id: p._id.toString(),
    roleName: p.roleName,
    description: p.description || "",
    aiModelName: p.aiModelId?.name || "-",
    greetingMessage: p.greetingMessage,
    maxTurns: p.maxTurns,
    isActive: p.isActive,
    allowedTools: p.allowedTools || [],
    createdAt: p.createdAt?.toISOString() || ""
  }));
}

export async function getDashboardChannels(tenantId: string) {
  await connectToDatabase();
  const channels = await Channel.find({ tenantId }).lean();
  return channels.map((c) => {
    let endpoint = "/api/webhook";
    if (c.type === "whatsapp") endpoint = "/v1/wa/webhook";
    else if (c.type === "facebook") endpoint = "/v1/fb/webhook";
    else if (c.type === "telegram") endpoint = "/v1/tg/webhook";
    else if (c.type === "website") endpoint = "/embed/widget.js";

    return {
      id: c._id.toString(),
      type: c.type,
      name: c.name,
      isActive: c.isActive,
      endpoint,
      load: Math.floor(Math.random() * 40) + 10,
      uptime: "99.9%"
    };
  });
}

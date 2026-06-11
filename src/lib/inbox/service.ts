import { Types } from "mongoose";
import {
  Contact,
  Channel,
  Conversation,
  ConversationEvent,
  ConversationInsight,
  ConversationNote,
  Message,
  SavedReply,
  Team,
  User
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { queueOutboundMessage } from "@/server/channels/outboundQueue";
import { refreshConversationIntelligence } from "@/lib/inbox/ai-copilot";
import { publishRealtimeEvent } from "@/lib/realtime";

export type InboxFilters = {
  view?: string;
  q?: string;
  channel?: string;
  agent?: string;
  team?: string;
  status?: string;
  priority?: string;
  tags?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

const defaultTeams = ["Sales", "Support", "Billing"];
const defaultSavedReplies = [
  {
    title: "تأكيد الاستلام",
    body: "وصلت رسالتك، سأراجع التفاصيل وأعود لك بالتحديث المناسب.",
    category: "support",
    tags: ["support"]
  },
  {
    title: "طلب معلومات إضافية",
    body: "حتى أساعدك بدقة، هل يمكنك إرسال رقم الطلب أو البريد المرتبط بالحساب؟",
    category: "support",
    tags: ["support", "triage"]
  },
  {
    title: "مبيعات - احتياج العميل",
    body: "يسعدني مساعدتك في اختيار الخيار الأنسب. ما احتياجك الأساسي وعدد المستخدمين المتوقع؟",
    category: "sales",
    tags: ["sales"]
  }
];

export async function ensureInboxDefaults(tenantId: string, userId?: string) {
  await connectToDatabase();

  await Promise.all(
    defaultTeams.map((name) =>
      Team.findOneAndUpdate(
        { tenantId, name },
        {
          $setOnInsert: {
            tenantId,
            name,
            color: name === "Sales" ? "emerald" : name === "Billing" ? "amber" : "blue",
            memberIds: userId && Types.ObjectId.isValid(userId) ? [userId] : []
          }
        },
        { upsert: true, new: true }
      )
    )
  );

  await Promise.all(
    defaultSavedReplies.map((reply) =>
      SavedReply.findOneAndUpdate(
        { tenantId, title: reply.title },
        {
          $setOnInsert: {
            tenantId,
            title: reply.title,
            body: reply.body,
            category: reply.category,
            tags: reply.tags,
            createdBy: userId && Types.ObjectId.isValid(userId) ? userId : undefined
          }
        },
        { upsert: true, new: true }
      )
    )
  );
}

export async function getInboxConversations(input: {
  tenantId: string;
  userId: string;
  filters: InboxFilters;
}) {
  await connectToDatabase();
  await ensureInboxDefaults(input.tenantId, input.userId);

  const limit = Math.min(Math.max(Number(input.filters.limit || 40), 10), 80);
  const query = await buildConversationQuery(input.tenantId, input.userId, input.filters);

  const conversations = await Conversation.find(query)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(limit + 1)
    .populate("contactId", "name email phone avatarUrl country tags lastSeenAt totalOrders customerValue lifecycleStage")
    .populate("assignedAgentId", "name email")
    .populate("assigneeId", "name email")
    .populate("assignedTeamId", "name color")
    .populate("teamId", "name color")
    .lean();

  const page = conversations.slice(0, limit);
  const insights = await ConversationInsight.find({
    tenantId: input.tenantId,
    conversationId: { $in: page.map((conversation) => conversation._id) }
  }).lean();
  const insightByConversation = new Map(insights.map((insight) => [insight.conversationId.toString(), insight]));

  const analytics = await getInboxAnalytics(input.tenantId);

  return {
    conversations: page.map((conversation) => mapConversationListItem(conversation, insightByConversation.get(conversation._id.toString()))),
    nextCursor: conversations.length > limit ? dateToIso(page[page.length - 1]?.lastMessageAt || page[page.length - 1]?.updatedAt) : "",
    analytics
  };
}

export async function getConversationDetail(input: {
  tenantId: string;
  conversationId: string;
  forceAi?: boolean;
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.conversationId)) throw new Error("Invalid conversation id.");

  const conversation = await Conversation.findOne({
    _id: input.conversationId,
    tenantId: input.tenantId
  })
    .populate("contactId", "name email phone avatarUrl company country tags notes lastSeenAt totalOrders customerValue lifecycleStage customAttributes")
    .populate("assignedAgentId", "name email")
    .populate("assigneeId", "name email")
    .populate("assignedTeamId", "name color")
    .populate("teamId", "name color")
    .lean();

  if (!conversation) throw new Error("Conversation not found.");

  const insight = await ensureFreshInsight(input.tenantId, input.conversationId, input.forceAi);
  const [messagesDesc, notes, events, agents, teams, savedReplies] = await Promise.all([
    Message.find({ tenantId: input.tenantId, conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(120)
      .lean(),
    ConversationNote.find({ tenantId: input.tenantId, conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .populate("authorId", "name email")
      .lean(),
    ConversationEvent.find({ tenantId: input.tenantId, conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .populate("actorId", "name email")
      .lean(),
    User.find({ tenantId: input.tenantId, isActive: true, role: { $in: ["owner", "admin", "manager", "agent"] } })
      .sort({ name: 1 })
      .select("name email role")
      .lean(),
    Team.find({ tenantId: input.tenantId, isActive: true }).sort({ name: 1 }).lean(),
    SavedReply.find({ tenantId: input.tenantId, isActive: true }).sort({ usageCount: -1, title: 1 }).limit(30).lean()
  ]);

  const messages = messagesDesc.reverse();
  const timeline = buildTimeline(messages, notes, events);

  return {
    conversation: mapConversationDetail(conversation, insight),
    timeline,
    insight: mapInsight(insight),
    agents: agents.map((agent) => ({
      id: agent._id.toString(),
      name: agent.name,
      email: agent.email,
      role: agent.role
    })),
    teams: teams.map((team) => ({
      id: team._id.toString(),
      name: team.name,
      color: team.color || "slate"
    })),
    savedReplies: savedReplies.map((reply) => ({
      id: reply._id.toString(),
      title: reply.title,
      body: reply.body,
      category: reply.category,
      tags: reply.tags || []
    }))
  };
}

export async function sendInboxReply(input: {
  tenantId: string;
  userId: string;
  conversationId: string;
  content: string;
  attachments?: unknown[];
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.conversationId)) throw new Error("Invalid conversation id.");
  const content = input.content.trim();
  if (!content) throw new Error("Message content is required.");

  const conversation = await Conversation.findOne({
    _id: input.conversationId,
    tenantId: input.tenantId
  });
  if (!conversation) throw new Error("Conversation not found.");

  const now = new Date();
  const message = await Message.create({
    tenantId: input.tenantId,
    botId: conversation.botId,
    conversationId: conversation._id,
    contactId: conversation.contactId,
    channelIdentityId: conversation.channelIdentityId,
    provider: conversation.provider,
    direction: "outgoing",
    sender: "agent",
    senderType: "agent",
    content,
    attachments: input.attachments || [],
    deliveryStatus: "queued",
    metadata: { agentId: input.userId }
  });

  const firstResponseMs = !conversation.lastAgentMessageAt && conversation.lastCustomerMessageAt
    ? now.getTime() - new Date(conversation.lastCustomerMessageAt).getTime()
    : conversation.firstResponseMs;

  conversation.mode = "human";
  conversation.aiPaused = true;
  conversation.aiPausedReason = "agent_replied";
  conversation.aiPausedAt = now;
  conversation.aiStatus = "paused";
  conversation.assignedAgentId = (conversation.assignedAgentId || input.userId) as any;
  conversation.assigneeId = (conversation.assigneeId || input.userId) as any;
  conversation.lastAgentMessageAt = now;
  conversation.lastMessageAt = now;
  conversation.lastMessagePreview = content.slice(0, 220);
  conversation.unreadCount = 0;
  if (firstResponseMs) conversation.firstResponseMs = firstResponseMs;
  conversation.slaStatus = computeSlaStatus(conversation);
  await conversation.save();

  await ConversationEvent.create({
    tenantId: input.tenantId,
    conversationId: conversation._id,
    actorId: input.userId,
    actorType: "agent",
    type: "status",
    title: "Agent replied",
    content: content.slice(0, 180)
  }).catch(() => undefined);

  const channelProvider = conversation.provider || conversation.channel;
  if (["website", "webhook", "api"].includes(channelProvider)) {
    await Message.updateOne({ _id: message._id, tenantId: input.tenantId }, { $set: { deliveryStatus: "sent" } });
  } else {
    const channel = await Channel.findOne({
      tenantId: input.tenantId,
      botId: conversation.botId,
      type: channelProvider,
      isActive: true
    }).select("_id");

    if (!channel) throw new Error("Outbound channel not found.");

    await queueOutboundMessage({
      tenantId: input.tenantId,
      messageId: message._id,
      conversationId: conversation._id,
      channelId: channel._id,
      provider: channelProvider,
      text: content,
      attachments: input.attachments || [],
      externalUserId: conversation.externalUserId,
      externalThreadId: conversation.externalThreadId
    });
  }

  const createdAt = message.createdAt?.toISOString() || now.toISOString();
  publishRealtimeEvent(input.tenantId, "message.created", {
    message: {
      id: message._id.toString(),
      conversationId: input.conversationId,
      content: message.content,
      direction: message.direction,
      sender: message.sender,
      senderType: message.senderType,
      provider: conversation.provider || conversation.channel || "website",
      deliveryStatus: ["website", "webhook", "api"].includes(channelProvider) ? "sent" : message.deliveryStatus,
      createdAt,
      attachments: message.attachments || []
    },
    conversation: {
      id: input.conversationId,
      status: conversation.status,
      priority: conversation.priority,
      lastMessage: content.slice(0, 220),
      lastMessageAt: createdAt,
      unreadCount: conversation.unreadCount || 0,
      channel: conversation.channel,
      provider: conversation.provider || conversation.channel
    }
  }).catch(() => undefined);

  return {
    id: message._id.toString(),
    content: message.content,
    direction: message.direction,
    sender: message.sender,
    createdAt: message.createdAt?.toISOString() || now.toISOString()
  };
}

export async function createInboxNote(input: {
  tenantId: string;
  userId: string;
  conversationId: string;
  content: string;
  visibility?: "internal" | "team";
  mentions?: string[];
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.conversationId)) throw new Error("Invalid conversation id.");
  const content = input.content.trim();
  if (!content) throw new Error("Note content is required.");

  const conversation = await Conversation.findOne({ _id: input.conversationId, tenantId: input.tenantId }).select("_id");
  if (!conversation) throw new Error("Conversation not found.");

  const mentions = (input.mentions || []).filter((id) => Types.ObjectId.isValid(id));
  const note = await ConversationNote.create({
    tenantId: input.tenantId,
    conversationId: conversation._id,
    authorId: input.userId,
    visibility: input.visibility || "internal",
    content,
    mentions
  });

  await ConversationEvent.create({
    tenantId: input.tenantId,
    conversationId: conversation._id,
    actorId: input.userId,
    actorType: "agent",
    type: "status",
    title: input.visibility === "team" ? "Team note added" : "Internal note added",
    content: content.slice(0, 180),
    metadata: { noteId: note._id.toString(), mentions }
  }).catch(() => undefined);

  return {
    id: note._id.toString(),
    content: note.content,
    visibility: note.visibility,
    authorId: input.userId,
    createdAt: note.createdAt?.toISOString() || new Date().toISOString()
  };
}

export async function updateInboxAssignment(input: {
  tenantId: string;
  userId: string;
  conversationId: string;
  agentId?: string;
  teamId?: string;
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.conversationId)) throw new Error("Invalid conversation id.");

  const update: Record<string, unknown> = {
    assignedAt: new Date(),
    assignedBy: input.userId
  };

  if (input.agentId === "") {
    update.assignedAgentId = null;
    update.assigneeId = null;
  } else if (input.agentId && Types.ObjectId.isValid(input.agentId)) {
    const agent = await User.findOne({ _id: input.agentId, tenantId: input.tenantId, isActive: true }).select("_id");
    if (!agent) throw new Error("Agent not found.");
    update.assignedAgentId = agent._id;
    update.assigneeId = agent._id;
  }

  if (input.teamId === "") {
    update.assignedTeamId = null;
    update.teamId = null;
  } else if (input.teamId && Types.ObjectId.isValid(input.teamId)) {
    const team = await Team.findOne({ _id: input.teamId, tenantId: input.tenantId, isActive: true }).select("_id");
    if (!team) throw new Error("Team not found.");
    update.assignedTeamId = team._id;
    update.teamId = team._id;
  }

  const conversation = await Conversation.findOneAndUpdate(
    { _id: input.conversationId, tenantId: input.tenantId },
    { $set: update },
    { new: true }
  );
  if (!conversation) throw new Error("Conversation not found.");

  await ConversationEvent.create({
    tenantId: input.tenantId,
    conversationId: conversation._id,
    actorId: input.userId,
    actorType: "agent",
    type: "assignment",
    title: "Assignment updated",
    metadata: {
      agentId: input.agentId || "",
      teamId: input.teamId || ""
    }
  }).catch(() => undefined);

  publishRealtimeEvent(input.tenantId, "assignment", {
    conversationId: input.conversationId,
    agentId: input.agentId,
    teamId: input.teamId
  }).catch(() => undefined);

  return { success: true };
}

export async function updateInboxStatus(input: {
  tenantId: string;
  userId: string;
  conversationId: string;
  status: "open" | "pending" | "resolved" | "closed" | "snoozed" | "archived";
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.conversationId)) throw new Error("Invalid conversation id.");

  const now = new Date();
  const update: Record<string, unknown> = { status: input.status };
  if (input.status === "resolved" || input.status === "closed") update.resolvedAt = now;
  if (input.status === "archived") update.archivedAt = now;
  if (input.status === "open") {
    update.archivedAt = null;
    update.resolvedAt = null;
  }

  const conversation = await Conversation.findOneAndUpdate(
    { _id: input.conversationId, tenantId: input.tenantId },
    { $set: update },
    { new: true }
  );
  if (!conversation) throw new Error("Conversation not found.");

  if ((input.status === "resolved" || input.status === "closed") && conversation.createdAt) {
    conversation.resolutionMs = now.getTime() - new Date(conversation.createdAt).getTime();
    conversation.slaStatus = computeSlaStatus(conversation);
    await conversation.save();
  }

  await ConversationEvent.create({
    tenantId: input.tenantId,
    conversationId: conversation._id,
    actorId: input.userId,
    actorType: "agent",
    type: "status",
    title: `Status changed to ${input.status}`
  }).catch(() => undefined);

  publishRealtimeEvent(input.tenantId, "conversation", {
    conversationId: input.conversationId,
    status: input.status
  }).catch(() => undefined);

  return { success: true, status: conversation.status };
}

export async function markConversationRead(input: {
  tenantId: string;
  userId: string;
  conversationId: string;
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.conversationId)) throw new Error("Invalid conversation id.");

  const conversation = await Conversation.findOneAndUpdate(
    { _id: input.conversationId, tenantId: input.tenantId, unreadCount: { $gt: 0 } },
    { $set: { unreadCount: 0 } },
    { new: false }
  ).select("_id unreadCount");

  if (!conversation) {
    const exists = await Conversation.exists({ _id: input.conversationId, tenantId: input.tenantId });
    if (!exists) throw new Error("Conversation not found.");
    return { changed: false };
  }

  await ConversationEvent.create({
    tenantId: input.tenantId,
    conversationId: conversation._id,
    actorId: input.userId,
    actorType: "agent",
    type: "read",
    title: "Conversation marked as read",
    metadata: { previousUnreadCount: conversation.unreadCount || 0 }
  }).catch(() => undefined);

  return { changed: true };
}

export async function getInboxRealtimeSnapshot(tenantId: string, since?: Date) {
  await connectToDatabase();
  const match: Record<string, unknown> = { tenantId };
  if (since) match.updatedAt = { $gt: since };

  const [latestConversation, unreadCount, aiEscalations] = await Promise.all([
    Conversation.findOne({ tenantId }).sort({ updatedAt: -1 }).select("_id updatedAt").lean(),
    Conversation.countDocuments({ tenantId, unreadCount: { $gt: 0 }, status: { $nin: ["resolved", "closed", "archived"] } }),
    Conversation.countDocuments({ tenantId, aiStatus: "escalated", status: { $nin: ["resolved", "closed", "archived"] } })
  ]);

  return {
    updatedAt: dateToIso(latestConversation?.updatedAt) || new Date().toISOString(),
    unreadCount,
    aiEscalations
  };
}

async function ensureFreshInsight(tenantId: string, conversationId: string, force = false) {
  const insight = await ConversationInsight.findOne({ tenantId, conversationId }).lean();
  const stale = !insight?.updatedAt || new Date(insight.updatedAt).getTime() < Date.now() - 30 * 60_000;
  if (force || !insight || stale) {
    return refreshConversationIntelligence({ tenantId, conversationId, force: true }).catch(() => insight);
  }
  return insight;
}

async function buildConversationQuery(tenantId: string, userId: string, filters: InboxFilters) {
  const and: Record<string, unknown>[] = [{ tenantId }];

  if (filters.cursor) {
    const cursorDate = new Date(filters.cursor);
    if (!Number.isNaN(cursorDate.getTime())) and.push({ lastMessageAt: { $lt: cursorDate } });
  }

  applyView(and, userId, filters.view);
  applyCsvFilter(and, "provider", filters.channel);
  applyCsvFilter(and, "status", filters.status);
  applyCsvFilter(and, "priority", filters.priority);
  applyAgentFilter(and, filters.agent);
  applyTeamFilter(and, filters.team);
  applyTagsFilter(and, filters.tags);
  applyDateFilter(and, filters.from, filters.to);

  const search = (filters.q || "").trim();
  if (search) {
    and.push(await buildSearchCondition(tenantId, search));
  }

  return and.length === 1 ? and[0] : { $and: and };
}

function applyView(and: Record<string, unknown>[], userId: string, view?: string) {
  if (!view || view === "inbox") {
    and.push({ status: { $nin: ["archived"] } });
    return;
  }
  if (view === "assigned_to_me") and.push({ $or: [{ assignedAgentId: userId }, { assigneeId: userId }] });
  if (view === "unassigned") and.push({ assignedAgentId: { $exists: false } });
  if (view === "ai_inbox") and.push({ $or: [{ aiStatus: "escalated" }, { aiStatus: "needs_review" }, { mode: "human", aiPausedReason: /ai/i }] });
  if (view === "mentioned") and.push({ labels: "Mentioned" });
  if (view === "snoozed") and.push({ status: "snoozed" });
  if (view === "resolved") and.push({ status: { $in: ["resolved", "closed"] } });
  if (view === "archived") and.push({ status: "archived" });
}

function applyCsvFilter(and: Record<string, unknown>[], field: string, value?: string) {
  const values = parseCsv(value);
  if (values.length) and.push({ [field]: { $in: values } });
}

function applyAgentFilter(and: Record<string, unknown>[], value?: string) {
  if (!value) return;
  if (value === "unassigned") {
    and.push({ $or: [{ assignedAgentId: { $exists: false } }, { assignedAgentId: null }] });
  } else if (Types.ObjectId.isValid(value)) {
    and.push({ $or: [{ assignedAgentId: value }, { assigneeId: value }] });
  }
}

function applyTeamFilter(and: Record<string, unknown>[], value?: string) {
  if (value && Types.ObjectId.isValid(value)) {
    and.push({ $or: [{ assignedTeamId: value }, { teamId: value }] });
  }
}

function applyTagsFilter(and: Record<string, unknown>[], value?: string) {
  const tags = parseCsv(value);
  if (tags.length) and.push({ $or: [{ labels: { $in: tags } }, { tags: { $in: tags } }] });
}

function applyDateFilter(and: Record<string, unknown>[], from?: string, to?: string) {
  const range: Record<string, Date> = {};
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) range.$gte = fromDate;
  if (toDate && !Number.isNaN(toDate.getTime())) range.$lte = toDate;
  if (Object.keys(range).length) and.push({ lastMessageAt: range });
}

async function buildSearchCondition(tenantId: string, search: string) {
  const regex = new RegExp(escapeRegex(search), "i");
  const [contacts, messageMatches, noteMatches] = await Promise.all([
    searchContacts(tenantId, search, regex),
    searchMessages(tenantId, search, regex),
    searchNotes(tenantId, search, regex)
  ]);

  const conversationIds = [
    ...messageMatches.map((item) => item.conversationId),
    ...noteMatches.map((item) => item.conversationId)
  ];

  return {
    $or: [
      { _id: { $in: conversationIds } },
      { contactId: { $in: contacts.map((item) => item._id) } },
      { externalUserId: regex },
      { externalThreadId: regex },
      { labels: regex },
      { tags: regex },
      { lastMessagePreview: regex }
    ]
  };
}

async function searchContacts(tenantId: string, search: string, regex: RegExp) {
  const text = await Contact.find({ tenantId, $text: { $search: search } })
    .select("_id")
    .limit(300)
    .lean()
    .catch(() => []);
  if (text.length) return text;
  return Contact.find({
    tenantId,
    $or: [{ name: regex }, { email: regex }, { phone: regex }, { company: regex }, { tags: regex }]
  })
    .select("_id")
    .limit(300)
    .lean();
}

async function searchMessages(tenantId: string, search: string, regex: RegExp) {
  const text = await Message.find({ tenantId, $text: { $search: search } })
    .select("conversationId")
    .limit(500)
    .lean()
    .catch(() => []);
  if (text.length) return text;
  return Message.find({ tenantId, content: regex }).select("conversationId").limit(500).lean();
}

async function searchNotes(tenantId: string, search: string, regex: RegExp) {
  const text = await ConversationNote.find({ tenantId, $text: { $search: search } })
    .select("conversationId")
    .limit(200)
    .lean()
    .catch(() => []);
  if (text.length) return text;
  return ConversationNote.find({ tenantId, content: regex }).select("conversationId").limit(200).lean();
}

async function getInboxAnalytics(tenantId: string) {
  const tenantObjectId = Types.ObjectId.isValid(tenantId) ? new Types.ObjectId(tenantId) : tenantId;
  const [openCount, resolvedCount, aiEscalations, responseAgg, aiResolved] = await Promise.all([
    Conversation.countDocuments({ tenantId, status: { $in: ["open", "pending", "snoozed"] } }),
    Conversation.countDocuments({ tenantId, status: { $in: ["resolved", "closed"] } }),
    Conversation.countDocuments({ tenantId, aiStatus: "escalated", status: { $nin: ["resolved", "closed", "archived"] } }),
    Conversation.aggregate<{ avgMs: number }>([
      { $match: { tenantId: tenantObjectId, firstResponseMs: { $gt: 0 } } },
      { $group: { _id: null, avgMs: { $avg: "$firstResponseMs" } } }
    ]).catch(() => []),
    Conversation.countDocuments({ tenantId, status: { $in: ["resolved", "closed"] }, mode: "ai" })
  ]);

  const totalResolved = Math.max(resolvedCount, 1);
  return {
    openCount,
    responseTimeMinutes: Math.round(((responseAgg[0]?.avgMs || 0) / 60_000) * 10) / 10,
    aiResolutionRate: Math.round((aiResolved / totalResolved) * 100),
    humanResolutionRate: Math.round(((resolvedCount - aiResolved) / totalResolved) * 100),
    escalationRate: Math.round((aiEscalations / Math.max(openCount + resolvedCount, 1)) * 100)
  };
}

function mapConversationListItem(conversation: any, insight: any) {
  const contact = conversation.contactId || {};
  const assignedAgent = conversation.assignedAgentId || conversation.assigneeId || {};
  const team = conversation.assignedTeamId || conversation.teamId || {};
  const labels = [...new Set([...(conversation.labels || []), ...(conversation.tags || []), ...(insight?.detectedTags || [])])];

  return {
    id: conversation._id.toString(),
    contactName: contact.name || contact.email || contact.phone || conversation.externalUserId || "Unknown customer",
    avatarUrl: contact.avatarUrl || "",
    contactInitials: initials(contact.name || contact.email || conversation.externalUserId || "C"),
    channel: conversation.provider || conversation.channel || "website",
    lastMessage: conversation.lastMessagePreview || "No preview available",
    lastMessageAt: dateToIso(conversation.lastMessageAt || conversation.updatedAt),
    unreadCount: conversation.unreadCount || 0,
    status: conversation.status || "open",
    priority: conversation.priority || "medium",
    aiStatus: insight?.needsHuman ? "escalated" : conversation.aiStatus || "active",
    agentStatus: assignedAgent.name ? "assigned" : "unassigned",
    assigneeName: assignedAgent.name || "",
    teamName: team.name || "",
    sentiment: insight?.sentiment || conversation.aiSentiment || "neutral",
    intent: insight?.intent || conversation.aiIntent || "general",
    aiConfidence: insight?.confidence ?? conversation.aiConfidence ?? null,
    slaStatus: conversation.slaStatus || computeSlaStatus(conversation),
    labels,
    badges: buildBadges(conversation, insight, labels),
    customerValue: contact.customerValue || 0,
    needsHuman: Boolean(insight?.needsHuman || conversation.aiStatus === "escalated")
  };
}

function mapConversationDetail(conversation: any, insight: any) {
  const contact = conversation.contactId || {};
  const assignedAgent = conversation.assignedAgentId || conversation.assigneeId || {};
  const team = conversation.assignedTeamId || conversation.teamId || {};

  return {
    id: conversation._id.toString(),
    contact: {
      id: contact._id?.toString() || "",
      name: contact.name || contact.email || contact.phone || conversation.externalUserId || "Unknown customer",
      email: contact.email || "",
      phone: contact.phone || "",
      avatarUrl: contact.avatarUrl || "",
      country: contact.country || "",
      company: contact.company || "",
      lastSeenAt: dateToIso(contact.lastSeenAt),
      totalOrders: contact.totalOrders || 0,
      customerValue: contact.customerValue || 0,
      lifecycleStage: contact.lifecycleStage || "lead",
      tags: contact.tags || [],
      notes: contact.notes || ""
    },
    channel: conversation.provider || conversation.channel || "website",
    status: conversation.status || "open",
    priority: conversation.priority || "medium",
    mode: conversation.mode || "ai",
    aiPaused: Boolean(conversation.aiPaused),
    assigneeId: assignedAgent._id?.toString() || "",
    assigneeName: assignedAgent.name || "",
    teamId: team._id?.toString() || "",
    teamName: team.name || "",
    firstResponseDueAt: dateToIso(conversation.firstResponseDueAt),
    resolutionDueAt: dateToIso(conversation.resolutionDueAt),
    firstResponseMs: conversation.firstResponseMs || 0,
    resolutionMs: conversation.resolutionMs || 0,
    slaStatus: conversation.slaStatus || computeSlaStatus(conversation),
    labels: [...new Set([...(conversation.labels || []), ...(conversation.tags || []), ...(insight?.detectedTags || [])])],
    lastMessageAt: dateToIso(conversation.lastMessageAt || conversation.updatedAt)
  };
}

function buildTimeline(messages: any[], notes: any[], events: any[]) {
  const mappedMessages = messages.map((message) => ({
    id: message._id.toString(),
    type: "message",
    direction: message.direction,
    sender: message.sender,
    senderType: message.senderType,
    content: message.content,
    deliveryStatus: message.deliveryStatus,
    createdAt: dateToIso(message.createdAt),
    attachments: message.attachments || [],
    metadata: message.metadata || {}
  }));

  const mappedNotes = notes.map((note) => ({
    id: note._id.toString(),
    type: "note",
    visibility: note.visibility,
    sender: note.authorId?.name || "Agent",
    content: note.content,
    createdAt: dateToIso(note.createdAt),
    mentions: note.mentions?.map((mention: any) => mention.toString()) || []
  }));

  const mappedEvents = events
    // AI analysis notes should feed the side panel/insight only, not pollute the customer chat timeline.
    .filter((event) => event.type !== "read" && event.type !== "ai_event")
    .map((event) => ({
    id: event._id.toString(),
    type: event.type,
    sender: event.actorId?.name || event.actorType || "system",
    title: event.title,
    content: event.content || "",
    createdAt: dateToIso(event.createdAt),
    metadata: event.metadata || {}
  }));

  return [...mappedMessages, ...mappedNotes, ...mappedEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function mapInsight(insight: any) {
  return {
    summary: insight?.summary || "لا يوجد ملخص AI بعد.",
    sentiment: insight?.sentiment || "neutral",
    sentimentScore: insight?.sentimentScore || 0,
    intent: insight?.intent || "general",
    confidence: insight?.confidence ?? null,
    needsHuman: Boolean(insight?.needsHuman),
    escalationReason: insight?.escalationReason || "",
    suggestedReplies: (insight?.suggestedReplies || []).map((suggestion: any) => ({
      id: suggestion.id,
      label: suggestion.label,
      text: suggestion.text,
      tone: suggestion.tone,
      confidence: suggestion.confidence,
      source: suggestion.source
    })),
    bestReply: insight?.bestReply || "",
    customerFacts: insight?.customerFacts || [],
    recommendedActions: insight?.recommendedActions || [],
    knowledgeSources: insight?.knowledgeSources || []
  };
}

function buildBadges(conversation: any, insight: any, labels: string[]) {
  const badges = new Set<string>();
  badges.add(conversation.mode === "human" || conversation.aiPaused ? "Human" : "AI");
  if ((conversation.priority || "") === "urgent") badges.add("Urgent");
  if (labels.some((label) => /vip/i.test(label))) badges.add("VIP");
  if (labels.some((label) => /new lead|مبيعات/i.test(label))) badges.add("New Lead");
  if (insight?.needsHuman || conversation.aiStatus === "escalated") badges.add("Escalated");
  return [...badges];
}

function computeSlaStatus(conversation: any) {
  if (conversation.slaStatus === "met" || conversation.status === "resolved" || conversation.status === "closed") return "met";
  if (conversation.status === "snoozed") return "paused";
  const now = Date.now();
  const firstDue = conversation.firstResponseDueAt ? new Date(conversation.firstResponseDueAt).getTime() : 0;
  const resolutionDue = conversation.resolutionDueAt ? new Date(conversation.resolutionDueAt).getTime() : 0;
  const due = [firstDue, resolutionDue].filter(Boolean).sort()[0];
  if (!due) return conversation.slaStatus || "on_track";
  if (due < now) return "breached";
  if (due - now < 30 * 60_000) return "at_risk";
  return "on_track";
}

function parseCsv(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const selected = parts.length > 1 ? [parts[0], parts[1]] : [value.slice(0, 2)];
  return selected.map((part) => part[0]?.toUpperCase()).join("") || "C";
}

function dateToIso(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

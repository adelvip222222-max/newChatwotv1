import { FilterQuery, Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Contact, Conversation, Message } from "@/lib/models";

type ConversationFilters = {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
  mode?: string;
  unreadOnly?: boolean;
  priority?: string;
};

type MessageFilters = {
  limit?: number;
  since?: string;
};

function createSearchRegex(q?: string) {
  return q ? new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
}

export async function listConversationsForTenant(tenantId: string, filters: ConversationFilters = {}) {
  await connectToDatabase();

  const limit = Math.min(Math.max(filters.limit || 20, 1), 50);
  const offset = Math.max(filters.offset || 0, 0);
  const query: FilterQuery<any> = { tenantId };

  if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  }

  if (filters.mode && filters.mode !== "all") {
    if (filters.mode === "human") {
      query.mode = { $in: ["human", "hybrid"] };
    } else {
      query.mode = filters.mode;
    }
  }

  if (filters.priority && filters.priority !== "all") {
    query.priority = filters.priority;
  }

  if (filters.unreadOnly) {
    query.unreadCount = { $gt: 0 };
  }

  const searchRegex = createSearchRegex(filters.q);
  if (searchRegex) {
    const matchingContacts = await Contact.find({
      tenantId,
      $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }, { company: searchRegex }],
    })
      .select("_id")
      .lean();

    const contactIds = matchingContacts.map((contact) => contact._id);
    query.$or = [
      { externalUserId: searchRegex },
      { externalThreadId: searchRegex },
      { labels: searchRegex },
      ...(contactIds.length ? [{ contactId: { $in: contactIds } }] : []),
    ];
  }

  const total = await Conversation.countDocuments(query);
  const conversations = await Conversation.find(query)
    .sort({ unreadCount: -1, lastMessageAt: -1, updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate("contactId", "name email phone avatarUrl company")
    .lean();

  const conversationsMissingPreview = conversations.filter(
    (conversation: any) => !String(conversation.lastMessagePreview || "").trim()
  );
  const latestMessages = conversationsMissingPreview.length
    ? await Message.aggregate([
        {
          $match: {
            tenantId: Types.ObjectId.isValid(tenantId) ? new Types.ObjectId(tenantId) : tenantId,
            conversationId: { $in: conversationsMissingPreview.map((conversation) => conversation._id) },
          },
        },
        { $sort: { conversationId: 1, createdAt: -1 } },
        { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
        {
          $project: {
            _id: 0,
            conversationId: "$message.conversationId",
            content: "$message.content",
            createdAt: "$message.createdAt",
            direction: "$message.direction",
            attachments: "$message.attachments",
          },
        },
      ])
    : [];

  const latestMessageByConversation = new Map<string, any>();
  for (const message of latestMessages) {
    const key = message.conversationId?.toString();
    if (key) {
      latestMessageByConversation.set(key, message);
    }
  }

  return {
    items: conversations.map((conversation: any) => {
      const id = conversation._id.toString();
      const lastMessage = latestMessageByConversation.get(id);
      const contactName =
        conversation.contactId?.name ||
        conversation.contactId?.email ||
        conversation.contactId?.phone ||
        conversation.externalUserId ||
        "Customer";

      return {
        id,
        channel: conversation.channel || conversation.provider || "website",
        provider: conversation.provider || conversation.channel || "website",
        status: conversation.status,
        mode: conversation.mode,
        priority: conversation.priority || "medium",
        unreadCount: conversation.unreadCount || 0,
        externalUserId: conversation.externalUserId || "",
        externalThreadId: conversation.externalThreadId || "",
        lastMessageAt: conversation.lastMessageAt?.toISOString?.() || conversation.updatedAt?.toISOString?.() || new Date().toISOString(),
        lastMessage: conversation.lastMessagePreview || lastMessage?.content || "",
        lastMessageDirection: lastMessage?.direction || "incoming",
        contact: {
          id: conversation.contactId?._id?.toString?.() || "",
          name: contactName,
          email: conversation.contactId?.email || "",
          phone: conversation.contactId?.phone || "",
          company: conversation.contactId?.company || "",
          avatarUrl: conversation.contactId?.avatarUrl || "",
        },
      };
    }),
    total,
    hasMore: offset + conversations.length < total,
    nextOffset: offset + conversations.length,
  };
}

export async function getConversationDetailForTenant(tenantId: string, conversationId: string) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(conversationId)) return null;

  const conversation = await Conversation.findOne({ _id: conversationId, tenantId })
    .populate("contactId", "name email phone avatarUrl company")
    .lean();

  if (!conversation) return null;

  const item = conversation as any;
  const latestMessage = await Message.findOne({ tenantId, conversationId })
    .sort({ createdAt: -1 })
    .select("content direction")
    .lean();

  return {
    id: item._id.toString(),
    channel: item.channel || item.provider || "website",
    provider: item.provider || item.channel || "website",
    status: item.status,
    mode: item.mode,
    priority: item.priority || "medium",
    unreadCount: item.unreadCount || 0,
    externalUserId: item.externalUserId || "",
    externalThreadId: item.externalThreadId || "",
    lastMessageAt: item.lastMessageAt?.toISOString?.() || item.updatedAt?.toISOString?.() || new Date().toISOString(),
    lastMessage: latestMessage?.content || "",
    lastMessageDirection: latestMessage?.direction || "incoming",
    contact: {
      id: item.contactId?._id?.toString?.() || "",
      name:
        item.contactId?.name ||
        item.contactId?.email ||
        item.contactId?.phone ||
        item.externalUserId ||
        "Customer",
      email: item.contactId?.email || "",
      phone: item.contactId?.phone || "",
      company: item.contactId?.company || "",
      avatarUrl: item.contactId?.avatarUrl || "",
    },
  };
}

export async function listMessagesForConversation(tenantId: string, conversationId: string, filters: MessageFilters = {}) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(conversationId)) return [];

  const limit = Math.min(Math.max(filters.limit || 120, 1), 250);
  const query: FilterQuery<any> = { tenantId, conversationId };
  const sinceDate = filters.since ? new Date(filters.since) : null;
  const isIncremental = Boolean(sinceDate && !Number.isNaN(sinceDate.getTime()));

  if (isIncremental && sinceDate) {
    query.createdAt = { $gt: sinceDate };
  }

  const messages = await Message.find(query)
    .sort(isIncremental ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  const orderedMessages = isIncremental ? messages : messages.reverse();

  return orderedMessages.map((message: any) => ({
    id: message._id.toString(),
    content: message.content,
    direction: message.direction,
    sender: message.sender,
    deliveryStatus: message.deliveryStatus || "sent",
    provider: message.provider || "website",
    createdAt: message.createdAt?.toISOString?.() || new Date().toISOString(),
    attachments: (message.attachments || []).map((attachment: any, index: number) => ({
      id: `${message._id.toString()}-${index}`,
      type: attachment.type || "file",
      url: attachment.url || "",
      name: attachment.name || "Attachment",
      size: attachment.size || 0,
      mimeType: attachment.mimeType || "",
    })),
  }));
}

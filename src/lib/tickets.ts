import { Types } from "mongoose";
import { Bot, Conversation, Message, Ticket } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export type TicketCategory =
  | "technical_support"
  | "complaint"
  | "human_request"
  | "ai_failed"
  | "general";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type EnsureTicketInput = {
  tenantId: string;
  botId: string;
  conversationId: string;
  triggerReason: string;
  category: TicketCategory;
  priority?: TicketPriority;
  subject?: string;
  description?: string;
  aiSummary?: string;
  source?: "ai" | "agent" | "system";
  metadata?: Record<string, unknown>;
};

export type TicketIntentClassification = {
  shouldCreate: boolean;
  category: TicketCategory;
  priority: TicketPriority;
  reason: string;
};

function buildSubject(input: {
  category: TicketCategory;
  triggerReason: string;
  externalUserId: string;
}) {
  if (input.category === "technical_support") {
    return `دعم فني - ${input.externalUserId}`;
  }
  if (input.category === "complaint") {
    return `شكوى عميل - ${input.externalUserId}`;
  }
  if (input.category === "human_request") {
    return `طلب موظف بشري - ${input.externalUserId}`;
  }
  if (input.category === "ai_failed") {
    return `متابعة فشل AI - ${input.externalUserId}`;
  }
  return `تذكرة دعم - ${input.externalUserId}`;
}

export function classifyTicketIntent(message: string): TicketIntentClassification {
  const normalized = message.toLowerCase();

  if (/(موظف|بشري|انسان|إنسان|خدمة\s*العملاء|الدعم\s*البشري|\bhuman\b|\bagent\b|representative)/i.test(message)) {
    return {
      shouldCreate: true,
      category: "human_request",
      priority: "medium",
      reason: "explicit_human_request",
    };
  }

  if (/(شكوى|اشتكي|زعلان|غاضب|سيء|سىء|مشكلة كبيرة|complaint|angry|bad service)/i.test(message)) {
    return {
      shouldCreate: true,
      category: "complaint",
      priority: "high",
      reason: "customer_complaint",
    };
  }

  if (/(دعم فني|مشكلة تقنية|لا يعمل|مش شغال|عطل|خطأ|bug|error|technical support|not working)/i.test(normalized)) {
    return {
      shouldCreate: true,
      category: "technical_support",
      priority: "high",
      reason: "technical_support_request",
    };
  }

  return {
    shouldCreate: false,
    category: "general",
    priority: "medium",
    reason: "no_ticket_trigger",
  };
}

export async function ensureTicketForConversation(input: EnsureTicketInput) {
  await connectToDatabase();

  if (
    !Types.ObjectId.isValid(input.tenantId) ||
    !Types.ObjectId.isValid(input.botId) ||
    !Types.ObjectId.isValid(input.conversationId)
  ) {
    throw new Error("معرفات التذكرة غير صالحة.");
  }

  const conversation = await Conversation.findOne({
    _id: input.conversationId,
    tenantId: input.tenantId,
    botId: input.botId,
  }).lean();
  if (!conversation) throw new Error("المحادثة غير موجودة.");

  const existing = await Ticket.findOne({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    status: { $in: ["open", "pending"] },
  });

  if (existing) {
    const update: Record<string, unknown> = {
      triggerReason: input.triggerReason,
      category: input.category,
      priority: input.priority || existing.priority,
      metadata: {
        ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        ...(input.metadata || {}),
        lastTriggerReason: input.triggerReason,
      },
    };
    if (input.aiSummary) update.aiSummary = input.aiSummary;
    if (input.description) update.description = input.description;

    await existing.updateOne({ $set: update });
    return Ticket.findById(existing._id);
  }

  const [counter, bot, lastMessages] = await Promise.all([
    Ticket.countDocuments({ tenantId: input.tenantId }),
    Bot.findById(input.botId).lean(),
    Message.find({
      tenantId: input.tenantId,
      botId: input.botId,
      conversationId: input.conversationId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const transcriptSummary = lastMessages
    .reverse()
    .map((message) => `${message.sender}: ${message.content}`)
    .join("\n");
  const subject =
    input.subject ||
    buildSubject({
      category: input.category,
      triggerReason: input.triggerReason,
      externalUserId: conversation.externalUserId,
    });

  return Ticket.create({
    tenantId: input.tenantId,
    botId: input.botId,
    conversationId: input.conversationId,
    number: counter + 1,
    subject,
    title: subject,
    description: input.description || transcriptSummary,
    status: "open",
    priority: input.priority || "medium",
    category: input.category,
    requesterExternalId: conversation.externalUserId,
    channel: conversation.channel,
    source: input.source || "ai",
    triggerReason: input.triggerReason,
    aiSummary:
      input.aiSummary ||
      `Bot: ${bot?.name || "-"}\nReason: ${input.triggerReason}\nCustomer: ${
        conversation.externalUserId
      }`,
    metadata: input.metadata || {},
  });
}


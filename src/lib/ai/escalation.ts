import { Conversation, Message, Tenant, User } from "@/lib/models";
import { logger } from "@/lib/logger";
import { publishRealtimeEvent } from "@/lib/realtime";

type EscalationReason =
  | "handoff_requested"
  | "low_knowledge_confidence"
  | "repeated_question_loop"
  | "max_ai_turns_reached"
  | "provider_error"
  | "manual_policy";

type NotifyEscalationInput = {
  tenantId: string;
  conversation: any;
  reason: EscalationReason | string;
  userMessage?: string;
  confidence?: number | null;
  summary?: string;
};

type Recipient = { email: string; name?: string };

const DEFAULT_ESCALATION_MESSAGE =
  "سأحوّل المحادثة الآن إلى أحد أعضاء الفريق حتى يراجع طلبك بدقة. شكرًا لانتظارك.";

export async function escalateConversationToHuman(input: NotifyEscalationInput & { customerMessage?: string; publicMessage?: string }) {
  const now = new Date();
  const metadata = normalizeMetadata(input.conversation.metadata);
  const aiPolicy = normalizeAiPolicy(metadata.aiPolicy);

  input.conversation.mode = "human";
  input.conversation.aiPaused = true;
  input.conversation.aiPausedReason = input.reason;
  input.conversation.aiPausedAt = now;
  input.conversation.aiStatus = "escalated";
  input.conversation.aiEscalationReason = input.reason;
  input.conversation.handoffReason = input.reason;
  input.conversation.status = input.conversation.status === "closed" ? "closed" : "pending";
  input.conversation.priority = input.conversation.priority === "urgent" ? "urgent" : "high";
  input.conversation.metadata = {
    ...metadata,
    aiPolicy: {
      ...aiPolicy,
      escalatedAt: now.toISOString(),
      escalationReason: input.reason,
      escalationConfidence: input.confidence ?? null,
      lastUserMessage: input.userMessage || input.customerMessage || aiPolicy.lastUserMessage || ""
    }
  };

  await input.conversation.save();

  const publicMessage = input.publicMessage || DEFAULT_ESCALATION_MESSAGE;
  const message = await Message.create({
    tenantId: input.tenantId,
    botId: input.conversation.botId,
    conversationId: input.conversation._id,
    contactId: input.conversation.contactId,
    channelIdentityId: input.conversation.channelIdentityId,
    provider: input.conversation.provider || input.conversation.channel,
    direction: "outgoing",
    sender: "assistant",
    senderType: "assistant",
    content: publicMessage,
    deliveryStatus: "sent",
    metadata: {
      escalation: true,
      reason: input.reason,
      confidence: input.confidence ?? null
    }
  });

  input.conversation.lastMessageAt = now;
  input.conversation.lastAiMessageAt = now;
  input.conversation.lastMessagePreview = publicMessage.slice(0, 220);
  await input.conversation.save();

  await publishRealtimeEvent(input.tenantId, "message.created", {
    message: {
      id: message._id.toString(),
      conversationId: input.conversation._id.toString(),
      content: publicMessage,
      direction: "outgoing",
      sender: "assistant",
      senderType: "assistant",
      provider: input.conversation.provider || input.conversation.channel,
      deliveryStatus: message.deliveryStatus || "sent",
      createdAt: message.createdAt?.toISOString?.() || now.toISOString(),
      attachments: []
    },
    conversation: {
      id: input.conversation._id.toString(),
      status: input.conversation.status,
      priority: input.conversation.priority,
      aiStatus: input.conversation.aiStatus,
      mode: input.conversation.mode,
      lastMessage: publicMessage.slice(0, 220),
      lastMessageAt: input.conversation.lastMessageAt?.toISOString?.() || now.toISOString(),
      unreadCount: input.conversation.unreadCount || 0,
      channel: input.conversation.channel,
      provider: input.conversation.provider || input.conversation.channel
    }
  }).catch(() => undefined);

  await publishRealtimeEvent(input.tenantId, "conversation.updated", {
    conversation: {
      id: input.conversation._id.toString(),
      status: input.conversation.status,
      priority: input.conversation.priority,
      aiStatus: input.conversation.aiStatus,
      mode: input.conversation.mode,
      handoffReason: input.reason,
      lastMessage: publicMessage.slice(0, 220),
      lastMessageAt: input.conversation.lastMessageAt?.toISOString?.() || now.toISOString()
    }
  }).catch(() => undefined);

  await notifyEscalationByEmail({
    tenantId: input.tenantId,
    conversation: input.conversation,
    reason: input.reason,
    userMessage: input.userMessage || input.customerMessage,
    confidence: input.confidence ?? null,
    summary: input.summary
  }).catch((error) => {
    logger.warn("ai.escalation_email_failed", {
      tenantId: input.tenantId,
      conversationId: input.conversation._id.toString(),
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return message;
}

export async function notifyEscalationByEmail(input: NotifyEscalationInput) {
  const metadata = normalizeMetadata(input.conversation.metadata);
  const aiPolicy = normalizeAiPolicy(metadata.aiPolicy);
  const lastEmailAt = aiPolicy.escalationEmailSentAt ? new Date(aiPolicy.escalationEmailSentAt).getTime() : 0;
  const cooldownMs = Number(process.env.AI_ESCALATION_EMAIL_COOLDOWN_MS || 15 * 60_000);

  if (lastEmailAt && Date.now() - lastEmailAt < cooldownMs) {
    return { sent: false, reason: "cooldown" };
  }

  const recipients = await resolveEscalationRecipients(input.tenantId);
  if (!recipients.length) {
    logger.warn("ai.escalation_email_no_recipients", {
      tenantId: input.tenantId,
      conversationId: input.conversation._id.toString()
    });
    return { sent: false, reason: "no_recipients" };
  }

  const subject = `ChatZi: AI handoff required for conversation ${input.conversation._id.toString().slice(-6)}`;
  const body = buildEscalationEmailBody(input);
  const sent = await sendOperationalEmail({
    to: recipients.map((recipient) => recipient.email),
    subject,
    text: body
  });

  input.conversation.metadata = {
    ...metadata,
    aiPolicy: {
      ...aiPolicy,
      escalationEmailSentAt: new Date().toISOString(),
      escalationEmailRecipients: recipients.map((recipient) => recipient.email),
      escalationEmailStatus: sent.sent ? "sent" : sent.reason || "skipped"
    }
  };
  await input.conversation.save();

  return sent;
}

async function resolveEscalationRecipients(tenantId: string): Promise<Recipient[]> {
  const override = (process.env.AI_ESCALATION_EMAIL_TO || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (override.length) return [...new Set(override)].map((email) => ({ email }));

  const tenant = await Tenant.findById(tenantId).select("ownerId").lean();
  const recipients: Recipient[] = [];

  if (tenant?.ownerId) {
    const owner = await User.findOne({ _id: tenant.ownerId, tenantId, isActive: true })
      .select("name email")
      .lean();
    if (owner?.email) recipients.push({ email: owner.email, name: owner.name });
  }

  if (!recipients.length) {
    const users = await User.find({ tenantId, isActive: true, role: { $in: ["owner", "admin", "manager"] } })
      .select("name email")
      .limit(5)
      .lean();
    for (const user of users) {
      if (user.email) recipients.push({ email: user.email, name: user.name });
    }
  }

  const unique = new Map<string, Recipient>();
  for (const recipient of recipients) unique.set(recipient.email.toLowerCase(), recipient);
  return [...unique.values()];
}

function buildEscalationEmailBody(input: NotifyEscalationInput) {
  const conversationId = input.conversation._id.toString();
  const channel = input.conversation.provider || input.conversation.channel || "unknown";
  const customer = input.conversation.externalUserId || "unknown customer";

  return [
    "ChatZi AI transferred a conversation to a human agent.",
    "",
    `Conversation ID: ${conversationId}`,
    `Channel: ${channel}`,
    `Customer: ${customer}`,
    `Reason: ${input.reason}`,
    `Knowledge confidence: ${input.confidence ?? "n/a"}`,
    input.summary ? `Summary: ${input.summary}` : "",
    input.userMessage ? `Last customer message: ${input.userMessage}` : "",
    "",
    "Open the ChatZi inbox and review this pending conversation."
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendOperationalEmail(input: { to: string[]; subject: string; text: string }) {
  const webhookUrl = process.env.AI_ESCALATION_WEBHOOK_URL || "";
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "ai_escalation", ...input })
    });
    if (!response.ok) throw new Error(`Escalation webhook failed: ${response.status}`);
    return { sent: true, provider: "webhook" };
  }

  const resendApiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "ChatZi <notifications@chatzi.io>";
  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text
      })
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Resend email failed: ${response.status} ${errorText}`.trim());
    }
    return { sent: true, provider: "resend" };
  }

  logger.warn("ai.escalation_email_skipped_no_provider", {
    to: input.to,
    subject: input.subject,
    hint: "Set RESEND_API_KEY + EMAIL_FROM or AI_ESCALATION_WEBHOOK_URL to enable delivery."
  });
  return { sent: false, reason: "no_email_provider" };
}

function normalizeMetadata(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeAiPolicy(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

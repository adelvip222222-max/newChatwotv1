import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { Types } from "mongoose";
import {
  aiReplyInputSchema,
  aiReplyOutputSchema,
} from "@/mastra/schemas/ai-reply.schema";
import { AiSetting, Bot, Conversation, Message } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";
import { assertCanSendAiMessage, recordAiMessageUsage } from "@/lib/billing";
import { buildKnowledgePrompt, searchKnowledge } from "@/lib/knowledge";
import { checkContentModeration } from "@/lib/moderation";
import { getMastraMaxToolCalls } from "@/lib/ai/orchestrator-flags";
import { validateCustomerReply } from "@/lib/ai/reply-validators";
import {
  describeAttachmentsForAi,
  type MessageAttachment,
} from "@/lib/attachments";
import {
  classifyTicketIntent,
  ensureTicketForConversation,
  type TicketCategory,
  type TicketPriority,
} from "@/lib/tickets";

const settingSchema = z
  .object({
    systemPrompt: z.string().optional(),
    fallbackMessage: z.string().optional(),
    temperature: z.number().optional(),
    language: z.string().optional(),
    role: z.string().optional(),
    tone: z.string().optional(),
    responseLength: z.string().optional(),
    useEmojis: z.boolean().optional(),
    isEnabled: z.boolean().optional(),
  })
  .nullable()
  .optional();

const botRuntimeSchema = z.object({
  name: z.string().optional(),
  knowledgeEnabled: z.boolean(),
  showKnowledgeSources: z.boolean(),
  confidenceDirectThreshold: z.number(),
  confidenceReviewThreshold: z.number(),
});

const knowledgeSchema = z
  .object({
    confidence: z.number(),
    intent: z.string(),
    keywords: z.array(z.string()),
    results: z.array(
      z.object({
        text: z.string(),
        score: z.number(),
        semanticScore: z.number().optional(),
        keywordScore: z.number().optional(),
        sourceTitle: z.string(),
        sourceUrl: z.string(),
        tags: z.array(z.string()).optional(),
        documentId: z.string(),
      })
    ),
  })
  .nullable()
  .optional();

const aiReplyRunContextSchema = aiReplyInputSchema.extend({
  conversationId: z.string().optional(),
  userMessageId: z.string().optional(),
  messageId: z.string().optional(),
  action: z.enum(["reply", "handoff", "skip", "fallback"]).optional(),
  generated: z.boolean().optional(),
  reply: z.string().optional(),
  confidence: z.number().nullable().optional(),
  reason: z.string().optional(),
  responseId: z.string().optional(),
  providerUsed: z.string().optional(),
  modelUsed: z.string().optional(),
  bot: botRuntimeSchema.optional(),
  setting: settingSchema,
  moderation: z
    .object({
      isSafe: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
  knowledge: knowledgeSchema,
  knowledgePrompt: z.string().optional(),
  validation: z
    .object({
      valid: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
  ticket: z
    .object({
      shouldCreate: z.boolean(),
      category: z.enum([
        "technical_support",
        "complaint",
        "human_request",
        "ai_failed",
        "general",
      ]),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      reason: z.string(),
    })
    .optional(),
  ticketId: z.string().optional(),
  modelCalled: z.boolean().optional(),
});

type AiReplyRunContext = z.infer<typeof aiReplyRunContextSchema>;
type AiReplyTicketContext = NonNullable<AiReplyRunContext["ticket"]>;

function getInputAttachments(metadata: Record<string, unknown> | undefined) {
  const attachments = metadata?.attachments;
  if (!Array.isArray(attachments)) return [];

  return attachments.filter((attachment): attachment is MessageAttachment => {
    if (!attachment || typeof attachment !== "object") return false;
    const item = attachment as Partial<MessageAttachment>;
    return Boolean(
      item.id &&
        item.key &&
        item.name &&
        item.mimeType &&
        typeof item.size === "number" &&
        (item.type === "image" || item.type === "audio" || item.type === "file")
    );
  });
}

function getTimeoutMs() {
  const value = Number(process.env.MASTRA_TIMEOUT_MS || 30000);
  return Number.isFinite(value) && value > 0 ? value : 30000;
}

function withTimeoutSignal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function buildPersonaDirectives(setting: AiReplyRunContext["setting"]) {
  const directives: string[] = [];

  if (setting?.role && setting.role !== "assistant") {
    directives.push(`Your role is: ${setting.role}. Always stay in character.`);
  }
  if (setting?.language && setting.language !== "auto") {
    directives.push(`You must reply exclusively in this language: ${setting.language}.`);
  }
  if (setting?.tone && setting.tone !== "neutral") {
    directives.push(`Maintain a ${setting.tone} tone throughout the conversation.`);
  }
  if (setting?.responseLength && setting.responseLength !== "medium") {
    directives.push(`Keep your answers ${setting.responseLength}.`);
  }
  if (setting?.useEmojis === false) {
    directives.push("Do NOT use any emojis in your responses.");
  } else if (setting?.useEmojis === true) {
    directives.push("Feel free to use relevant emojis in your responses.");
  }

  return directives;
}

function hasExplicitHumanRequest(message: string) {
  return /(\bhuman\b|\bagent\b|representative|support\s*team|موظف|بشري|انسان|إنسان|خدمة\s*العملاء|الدعم\s*البشري)/i.test(
    message
  );
}

function handoffReplyFor(message: string) {
  return /[اأإء-ي]/.test(message)
    ? "تمام، سأحوّل طلبك لأحد أعضاء فريق الدعم، وسيتم التواصل معك في أقرب وقت."
    : "I’ll pass this to a support team member so they can help you as soon as possible.";
}

const loadConversationStep = createStep({
  id: "load-conversation",
  inputSchema: aiReplyInputSchema,
  outputSchema: aiReplyRunContextSchema,
  execute: async ({ inputData }) => {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(inputData.tenantId) || !Types.ObjectId.isValid(inputData.botId)) {
      throw new Error("معرف المستأجر أو البوت غير صالح.");
    }

    const bot = await Bot.findOne({
      _id: inputData.botId,
      tenantId: inputData.tenantId,
      isActive: true,
    }).lean();
    if (!bot) throw new Error("البوت غير موجود أو غير مفعل.");

    const setting = await AiSetting.findOne({
      tenantId: inputData.tenantId,
      botId: inputData.botId,
    }).lean();

    const conversation =
      inputData.conversationId && Types.ObjectId.isValid(inputData.conversationId)
        ? await Conversation.findOne({
            _id: inputData.conversationId,
            tenantId: inputData.tenantId,
            botId: inputData.botId,
          }).lean()
        : await Conversation.findOneAndUpdate(
            {
              tenantId: inputData.tenantId,
              botId: inputData.botId,
              channel: inputData.channel,
              externalUserId: inputData.externalUserId,
            },
            {
              $setOnInsert: {
                tenantId: inputData.tenantId,
                botId: inputData.botId,
                channel: inputData.channel,
                externalUserId: inputData.externalUserId,
                status: "open",
              },
            },
            { new: true, upsert: true }
          ).lean();

    if (!conversation) throw new Error("تعذر العثور على المحادثة.");

    const attachments = getInputAttachments(inputData.metadata);
    const attachmentDescription = describeAttachmentsForAi(attachments);
    const contentForStorage = attachmentDescription
      ? `${inputData.message}\n\nمرفقات العميل: ${attachmentDescription}`
      : inputData.message;

    const userMessage = await Message.create({
      tenantId: inputData.tenantId,
      botId: inputData.botId,
      conversationId: conversation._id,
      sender: "user",
      content: contentForStorage,
      attachments,
      metadata: inputData.metadata || {},
    });

    return {
      ...inputData,
      conversationId: conversation._id.toString(),
      userMessageId: userMessage._id.toString(),
      action:
        conversation.status === "closed" || conversation.status === "human"
          ? ("skip" as const)
          : undefined,
      reason:
        conversation.status === "closed" || conversation.status === "human"
          ? `conversation_${conversation.status}`
          : undefined,
      bot: {
        name: bot.name,
        knowledgeEnabled: bot.knowledgeEnabled ?? true,
        showKnowledgeSources: bot.showKnowledgeSources ?? false,
        confidenceDirectThreshold: bot.confidenceDirectThreshold ?? 70,
        confidenceReviewThreshold: bot.confidenceReviewThreshold ?? 40,
      },
      setting: setting
        ? {
            systemPrompt: setting.systemPrompt || undefined,
            fallbackMessage: setting.fallbackMessage || undefined,
            temperature: setting.temperature ?? undefined,
            language: setting.language || undefined,
            role: setting.role || undefined,
            tone: setting.tone || undefined,
            responseLength: setting.responseLength || undefined,
            useEmojis: setting.useEmojis ?? undefined,
            isEnabled: setting.isEnabled ?? undefined,
          }
        : null,
      generated: false,
    };
  },
});

const moderationStep = createStep({
  id: "moderation-check",
  inputSchema: aiReplyRunContextSchema,
  outputSchema: aiReplyRunContextSchema,
  execute: async ({ inputData }) => {
    if (inputData.action === "skip") return inputData;

    const moderation = await checkContentModeration(inputData.message);
    if (!moderation.isSafe) {
      return {
        ...inputData,
        moderation,
        action: "fallback" as const,
        reply:
          inputData.setting?.fallbackMessage ||
          "عذراً، لا يمكنني معالجة هذا الطلب. يرجى التوضيح أو التواصل مع الدعم.",
        confidence: 100,
        reason: moderation.reason || "moderation_blocked",
      };
    }

    return { ...inputData, moderation };
  },
});

const routeHandoffStep = createStep({
  id: "route-handoff",
  inputSchema: aiReplyRunContextSchema,
  outputSchema: aiReplyRunContextSchema,
  execute: async ({ inputData }) => {
    if (inputData.action) return inputData;

    if (hasExplicitHumanRequest(inputData.message)) {
      const ticket: AiReplyTicketContext = {
        shouldCreate: true,
        category: "human_request",
        priority: "medium",
        reason: "explicit_human_request",
      };

      return {
        ...inputData,
        action: "handoff" as const,
        reply: handoffReplyFor(inputData.message),
        confidence: null,
        reason: "explicit_human_request",
        ticket,
      };
    }

    const ticketIntent = classifyTicketIntent(inputData.message);
    if (ticketIntent.shouldCreate) {
      const ticket: AiReplyTicketContext = {
        shouldCreate: ticketIntent.shouldCreate,
        category: ticketIntent.category as AiReplyTicketContext["category"],
        priority: ticketIntent.priority as AiReplyTicketContext["priority"],
        reason: ticketIntent.reason,
      };

      return {
        ...inputData,
        action: "handoff" as const,
        reply:
          ticketIntent.category === "complaint"
            ? "تم تسجيل شكواك وتحويلها لفريق الدعم لمتابعتها في أقرب وقت."
            : handoffReplyFor(inputData.message),
        confidence: null,
        reason: ticketIntent.reason,
        ticket,
      };
    }

    return inputData;
  },
});

const quotaStep = createStep({
  id: "quota-check",
  inputSchema: aiReplyRunContextSchema,
  outputSchema: aiReplyRunContextSchema,
  execute: async ({ inputData }) => {
    if (inputData.action) return inputData;

    if (inputData.setting && inputData.setting.isEnabled === false) {
      throw new Error("الذكاء الاصطناعي غير مفعل لهذا البوت.");
    }

    await assertCanSendAiMessage(inputData.tenantId);
    return inputData;
  },
});

const knowledgeStep = createStep({
  id: "search-knowledge",
  inputSchema: aiReplyRunContextSchema,
  outputSchema: aiReplyRunContextSchema,
  execute: async ({ inputData }) => {
    if (inputData.action) return inputData;

    const knowledgeEnabled = inputData.bot?.knowledgeEnabled ?? true;
    const knowledge = knowledgeEnabled
      ? await searchKnowledge({
          tenantId: inputData.tenantId,
          botId: inputData.botId,
          question: inputData.message,
          limit: 10,
        })
      : null;

    const knowledgePrompt = knowledge
      ? buildKnowledgePrompt({
          question: inputData.message,
          intent: knowledge.intent,
          keywords: knowledge.keywords,
          confidence: knowledge.confidence,
          results: knowledge.results,
          showSources: false,
        })
      : "";

    if (
      knowledge &&
      knowledge.confidence < (inputData.bot?.confidenceReviewThreshold ?? 40)
    ) {
      const ticket: AiReplyTicketContext = {
        shouldCreate: true,
        category: "ai_failed",
        priority: "medium",
        reason: "low_knowledge_confidence",
      };

      return {
        ...inputData,
        knowledge,
        knowledgePrompt,
        confidence: knowledge.confidence,
        action: "handoff" as const,
        reply: handoffReplyFor(inputData.message),
        reason: "low_knowledge_confidence",
        ticket,
      };
    }

    return {
      ...inputData,
      knowledge,
      knowledgePrompt,
      confidence: knowledge?.confidence ?? null,
    };
  },
});

const generateReplyStep = createStep({
  id: "generate-reply",
  inputSchema: aiReplyRunContextSchema,
  outputSchema: aiReplyRunContextSchema,
  execute: async ({ inputData, mastra }) => {
    if (inputData.action) return inputData;
    if (!inputData.conversationId) throw new Error("تعذر تحديد المحادثة.");

    const instructions = [
      ...buildPersonaDirectives(inputData.setting),
      inputData.setting?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      inputData.knowledgePrompt
        ? [
            "قاعدة المعرفة هي مصدر الحقيقة الأول. استخدمها قبل أي معرفة عامة.",
            "إذا كانت الثقة منخفضة، اسأل سؤالاً توضيحياً واحداً أو اطلب تحويل الطلب لفريق الدعم.",
            "لا تذكر أسماء المصادر أو tool أو workflow أو documentId أو tenantId أو botId للعميل.",
            inputData.knowledgePrompt,
          ].join("\n")
        : "إذا لم تتوفر معرفة كافية، لا تخترع معلومات؛ اطلب توضيحاً قصيراً أو اقترح التحويل للدعم.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const timeout = withTimeoutSignal();
    const modelName = process.env.MASTRA_DEFAULT_MODEL || "openai/gpt-4o-mini";
    const attachmentDescription = describeAttachmentsForAi(
      getInputAttachments(inputData.metadata)
    );
    const userPrompt = attachmentDescription
      ? `${inputData.message}\n\nمرفقات العميل: ${attachmentDescription}\nإذا كان حل الطلب يتطلب قراءة محتوى الملف نفسه ولا يوجد نص كاف، اطلب توضيحاً أو حوّل الطلب لفريق الدعم.`
      : inputData.message;

    try {
      const agent = mastra.getAgentById("customer-support-agent");
      const result = await agent.generate(userPrompt, {
        instructions,
        maxSteps: getMastraMaxToolCalls(),
        abortSignal: timeout.signal,
        modelSettings: {
          temperature: inputData.setting?.temperature ?? 0.4,
        },
        memory: {
          resource: `${inputData.tenantId}:${inputData.externalUserId}`,
          thread: {
            id: inputData.conversationId,
            title: inputData.bot?.name
              ? `${inputData.bot.name} support conversation`
              : "Support conversation",
            metadata: {
              tenantId: inputData.tenantId,
              botId: inputData.botId,
              channel: inputData.channel,
            },
          },
        },
      });

      return {
        ...inputData,
        action: "reply" as const,
        reply: result.text?.trim() || "",
        responseId: (result as { runId?: string }).runId || "",
        providerUsed: "mastra",
        modelUsed: modelName,
        modelCalled: true,
      };
    } finally {
      timeout.clear();
    }
  },
});

const persistResultStep = createStep({
  id: "persist-result",
  inputSchema: aiReplyRunContextSchema,
  outputSchema: aiReplyOutputSchema,
  execute: async ({ inputData }) => {
    if (!inputData.conversationId) {
      throw new Error("تعذر تحديد المحادثة.");
    }

    if (inputData.action === "skip") {
      return {
        generated: false,
        action: "skip" as const,
        conversationId: inputData.conversationId,
        confidence: null,
        reason: inputData.reason,
      };
    }

    let action: NonNullable<AiReplyRunContext["action"]> =
      inputData.action || "fallback";
    let reply =
      inputData.reply ||
      inputData.setting?.fallbackMessage ||
      "أحتاج إلى معلومة إضافية حتى أجيب بدقة. ما المنتج أو الخدمة التي تقصدها؟";

    const validation = validateCustomerReply(reply);
    if (!validation.valid) {
      action = "fallback";
      reply =
        inputData.setting?.fallbackMessage ||
        "أحتاج إلى معلومة إضافية حتى أجيب بدقة. ما المنتج أو الخدمة التي تقصدها؟";
    }

    let ticketId: string | undefined;
    const shouldCreateTicket =
      inputData.ticket?.shouldCreate ||
      action === "handoff" ||
      (!validation.valid && inputData.modelCalled);

    if (shouldCreateTicket) {
      const ticket = await ensureTicketForConversation({
        tenantId: inputData.tenantId,
        botId: inputData.botId,
        conversationId: inputData.conversationId,
        triggerReason:
          inputData.ticket?.reason ||
          inputData.reason ||
          validation.reason ||
          "ai_followup_required",
        category: (inputData.ticket?.category ||
          (!validation.valid ? "ai_failed" : "human_request")) as TicketCategory,
        priority: (inputData.ticket?.priority || "medium") as TicketPriority,
        aiSummary: [
          `Reason: ${inputData.ticket?.reason || inputData.reason || validation.reason || "-"}`,
          `Channel: ${inputData.channel}`,
          `Knowledge confidence: ${inputData.confidence ?? "-"}`,
          `Last customer message: ${inputData.message}`,
        ].join("\n"),
        metadata: {
          workflow: "ai-reply-workflow",
          action,
          validation,
          knowledgeConfidence: inputData.confidence,
        },
      });
      ticketId = ticket?._id?.toString();
    }

    if (action === "handoff") {
      await Conversation.updateOne(
        { _id: inputData.conversationId, tenantId: inputData.tenantId, botId: inputData.botId },
        { $set: { status: "human" } }
      );
    }

    const assistantMessage = await Message.create({
      tenantId: inputData.tenantId,
      botId: inputData.botId,
      conversationId: inputData.conversationId,
      sender: "assistant",
      content: reply,
      metadata: {
        responseId: inputData.responseId,
        provider: inputData.providerUsed || "mastra",
        model: inputData.modelUsed,
        orchestrator: "mastra",
        action,
        reason: inputData.reason,
        ticketId,
        validation: validation.valid ? { valid: true } : validation,
        knowledge: inputData.knowledge
          ? {
              enabled: inputData.bot?.knowledgeEnabled ?? true,
              confidence: inputData.knowledge.confidence,
              intent: inputData.knowledge.intent,
              keywords: inputData.knowledge.keywords,
              sourceCount: inputData.knowledge.results.length,
              sources: (inputData.bot?.showKnowledgeSources
                ? inputData.knowledge.results.slice(0, 6)
                : []
              ).map((result) => ({
                title: result.sourceTitle,
                url: result.sourceUrl,
                score: result.score,
                documentId: result.documentId,
              })),
            }
          : { enabled: false },
      },
    });

    if (inputData.modelCalled) {
      await recordAiMessageUsage(inputData.tenantId);
    }

    return {
      generated: action === "reply" || action === "fallback" || action === "handoff",
      action,
      reply,
      messageId: assistantMessage._id.toString(),
      conversationId: inputData.conversationId,
      confidence: inputData.confidence ?? null,
      reason: validation.valid ? inputData.reason : validation.reason,
      providerUsed: inputData.providerUsed || "mastra",
      modelUsed: inputData.modelUsed,
    };
  },
});

export const aiReplyWorkflow = createWorkflow({
  id: "ai-reply-workflow",
  inputSchema: aiReplyInputSchema,
  outputSchema: aiReplyOutputSchema,
})
  .then(loadConversationStep)
  .then(moderationStep)
  .then(routeHandoffStep)
  .then(quotaStep)
  .then(knowledgeStep)
  .then(generateReplyStep)
  .then(persistResultStep)
  .commit();


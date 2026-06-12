import { Types } from "mongoose";
import { mastra } from "@/mastra";
import { AiSetting, Bot, Conversation, Message } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";
import { assertCanSendAiMessage, recordAiMessageUsage } from "@/lib/billing";
import { buildKnowledgePrompt, searchKnowledge } from "@/lib/knowledge";
import { checkContentModeration } from "@/lib/moderation";
import { getMastraMaxToolCalls } from "@/lib/ai/orchestrator-flags";
import { validateCustomerReply } from "@/lib/ai/reply-validators";
import type { GenerateReplyInput } from "@/lib/ai";

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

type AiSettingLike = {
  role?: string | null;
  language?: string | null;
  tone?: string | null;
  responseLength?: string | null;
  useEmojis?: boolean | null;
};

function buildPersonaDirectives(setting: AiSettingLike | null | undefined) {
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

export async function generateAiReplyWithMastra(input: GenerateReplyInput) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(input.tenantId) || !Types.ObjectId.isValid(input.botId)) {
    throw new Error("معرف المستأجر أو البوت غير صالح.");
  }

  const bot = await Bot.findOne({
    _id: input.botId,
    tenantId: input.tenantId,
    isActive: true,
  });
  if (!bot) throw new Error("البوت غير موجود أو غير مفعل.");

  const setting = await AiSetting.findOne({
    tenantId: input.tenantId,
    botId: input.botId,
  });

  const conversation =
    input.conversationId && Types.ObjectId.isValid(input.conversationId)
      ? await Conversation.findOne({
          _id: input.conversationId,
          tenantId: input.tenantId,
          botId: input.botId,
        })
      : await Conversation.findOneAndUpdate(
          {
            tenantId: input.tenantId,
            botId: input.botId,
            channel: input.channel,
            externalUserId: input.externalUserId,
          },
          {
            $setOnInsert: {
              tenantId: input.tenantId,
              botId: input.botId,
              channel: input.channel,
              externalUserId: input.externalUserId,
              status: "open",
            },
          },
          { new: true, upsert: true }
        );

  if (!conversation) throw new Error("تعذر العثور على المحادثة.");

  await Message.create({
    tenantId: input.tenantId,
    botId: input.botId,
    conversationId: conversation._id,
    sender: "user",
    content: input.message,
    metadata: input.metadata || {},
  });

  if (conversation.status === "closed" || conversation.status === "human") {
    return {
      reply: "",
      conversationId: conversation._id.toString(),
      confidence: null,
    };
  }

  const moderation = await checkContentModeration(input.message);
  if (!moderation.isSafe) {
    const fallback =
      setting?.fallbackMessage ||
      "عذراً، لا يمكنني معالجة هذا الطلب. يرجى التوضيح أو التواصل مع الدعم.";
    await Message.create({
      tenantId: input.tenantId,
      botId: input.botId,
      conversationId: conversation._id,
      sender: "assistant",
      content: fallback,
      metadata: {
        flagged: true,
        reason: moderation.reason,
        orchestrator: "mastra",
      },
    });
    return {
      reply: fallback,
      conversationId: conversation._id.toString(),
      confidence: 100,
    };
  }

  await assertCanSendAiMessage(input.tenantId);

  if (setting && !setting.isEnabled) {
    throw new Error("الذكاء الاصطناعي غير مفعل لهذا البوت.");
  }

  const previousMessages = await Message.find({
    tenantId: input.tenantId,
    botId: input.botId,
    conversationId: conversation._id,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const transcript = previousMessages
    .reverse()
    .map((item) =>
      `${item.sender === "assistant" ? "المساعد" : "المستخدم"}: ${item.content}`
    )
    .join("\n");

  const knowledgeEnabled = bot.knowledgeEnabled ?? true;
  const knowledge = knowledgeEnabled
    ? await searchKnowledge({
        tenantId: input.tenantId,
        botId: input.botId,
        question: input.message,
        limit: 10,
      })
    : null;

  const knowledgePrompt = knowledge
    ? buildKnowledgePrompt({
        question: input.message,
        intent: knowledge.intent,
        keywords: knowledge.keywords,
        confidence: knowledge.confidence,
        results: knowledge.results,
        showSources: false,
      })
    : "";

  const instructions = [
    ...buildPersonaDirectives(setting),
    setting?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    knowledgePrompt
      ? "قاعدة المعرفة هي مصدر الحقيقة الأول. لا تخالفها، ولا تحوّل المحادثة لبشر إلا عند وجود طلب صريح أو صلاحية بشرية لازمة."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = [
    instructions,
    knowledgePrompt ? `سياق قاعدة المعرفة:\n${knowledgePrompt}` : "",
    `سياق المحادثة الأخير:\n${transcript}`,
    `رسالة العميل الحالية:\n${input.message}`,
    "اكتب الرد النهائي فقط كما سيظهر للعميل.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const timeout = withTimeoutSignal();
  let reply = "";
  let responseId = "";
  const modelName = process.env.MASTRA_DEFAULT_MODEL || "openai/gpt-4o-mini";

  try {
    const agent = mastra.getAgent("customerSupportAgent");
    const result = await agent.generate(prompt, {
      maxSteps: getMastraMaxToolCalls(),
      abortSignal: timeout.signal,
      modelSettings: {
        temperature: setting?.temperature ?? 0.4,
      },
      memory: {
        resource: `${input.tenantId}:${input.externalUserId}`,
        thread: conversation._id.toString(),
      },
    });

    reply = result.text?.trim() || "";
    responseId = result.runId || "";
  } finally {
    timeout.clear();
  }

  const validation = validateCustomerReply(reply);
  if (!validation.valid) {
    reply =
      setting?.fallbackMessage ||
      "أحتاج إلى معلومة إضافية حتى أجيب بدقة. ما المنتج أو الخدمة التي تقصدها؟";
  }

  const assistantMessage = await Message.create({
    tenantId: input.tenantId,
    botId: input.botId,
    conversationId: conversation._id,
    sender: "assistant",
    content: reply,
    metadata: {
      responseId,
      provider: "mastra",
      model: modelName,
      orchestrator: "mastra",
      validation: validation.valid ? { valid: true } : validation,
      knowledge: knowledge
        ? {
            enabled: knowledgeEnabled,
            confidence: knowledge.confidence,
            intent: knowledge.intent,
            keywords: knowledge.keywords,
            sourceCount: knowledge.results.length,
            sources: (bot.showKnowledgeSources ? knowledge.results.slice(0, 6) : []).map(
              (result) => ({
                title: result.sourceTitle,
                url: result.sourceUrl,
                score: result.score,
                documentId: result.documentId,
              })
            ),
          }
        : { enabled: false },
    },
  });

  await recordAiMessageUsage(input.tenantId);

  return {
    reply,
    conversationId: conversation._id.toString(),
    confidence: knowledge?.confidence ?? null,
    messageId: assistantMessage._id.toString(),
  };
}


import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Types } from "mongoose";
import { AiModel, AiSetting, Bot, Conversation, Message } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";
import { assertCanSendAiMessage, recordAiMessageUsage } from "@/lib/billing";
import { buildKnowledgePrompt, searchKnowledge } from "@/lib/knowledge";
import { decryptSecret } from "@/lib/crypto";
import { checkContentModeration } from "@/lib/moderation";
import { generateAiReplyWithMastra } from "@/lib/ai/mastra-orchestrator";
import { isMastraAllowed, shouldFallbackToLegacy } from "@/lib/ai/orchestrator-flags";

export type GenerateReplyInput = {
  tenantId: string;
  botId: string;
  message: string;
  conversationId?: string;
  channel: string;
  externalUserId: string;
  metadata?: Record<string, unknown>;
};

// ─── Provider helpers ──────────────────────────────────────────────────────────

function resolveApiKey(
  provider: string,
  encryptedKey?: string | null
): string {
  // 1. Per-model encrypted key takes priority (allows per-tenant keys in future)
  if (encryptedKey) {
    const decrypted = decryptSecret(encryptedKey);
    if (decrypted) return decrypted;
  }
  // 2. Fall back to environment variables
  if (provider === "google-gemini") {
    return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || "";
  }
  if (provider === "openai-compatible") {
    return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "";
  }
  return process.env.OPENAI_API_KEY || "";
}

async function callGemini(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  temperature: number;
}): Promise<{ reply: string; responseId: string }> {
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: options.systemPrompt,
    generationConfig: { temperature: options.temperature },
  });
  const result = await geminiModel.generateContent(options.userInput);
  const reply = result.response.text()?.trim() || "";
  const responseId = `gemini-${Date.now()}`;
  return { reply, responseId };
}

async function callOpenAiCompatible(options: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  userInput: string;
  temperature: number;
  useResponsesApi: boolean;
}): Promise<{ reply: string; responseId: string }> {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl || undefined,
  });

  if (options.useResponsesApi) {
    const response = await client.responses.create({
      model: options.model,
      instructions: options.systemPrompt,
      input: options.userInput,
      temperature: options.temperature,
    });
    return {
      reply: response.output_text?.trim() || "",
      responseId: response.id,
    };
  }

  const response = await client.chat.completions.create({
    model: options.model,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user",   content: options.userInput },
    ],
    temperature: options.temperature,
  });
  return {
    reply: response.choices[0]?.message?.content?.trim() || "",
    responseId: response.id,
  };
}

// ─── Orchestrator switch ───────────────────────────────────────────────────────

export async function generateAiReply(input: GenerateReplyInput) {
  if (isMastraAllowed(input.tenantId)) {
    try {
      return await generateAiReplyWithMastra(input);
    } catch (error) {
      console.error("mastra.orchestrator_failed", {
        error,
        tenantId: input.tenantId,
        botId: input.botId,
      });

      if (!shouldFallbackToLegacy()) {
        throw error;
      }
    }
  }

  return generateAiReplyLegacy(input);
}

// ─── Legacy implementation ────────────────────────────────────────────────────

export async function generateAiReplyLegacy(input: GenerateReplyInput) {
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
    const fallback = setting?.fallbackMessage || "عذراً، لا يمكنني معالجة هذا الطلب. يرجى التوضيح أو التواصل مع الدعم.";
    await Message.create({
      tenantId: input.tenantId,
      botId: input.botId,
      conversationId: conversation._id,
      sender: "assistant",
      content: fallback,
      metadata: { flagged: true, reason: moderation.reason },
    });
    return {
      reply: fallback,
      conversationId: conversation._id.toString(),
      confidence: 100,
    };
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

  await assertCanSendAiMessage(input.tenantId);

  if (setting && !setting.isEnabled) {
    throw new Error("الذكاء الاصطناعي غير مفعل لهذا البوت.");
  }

  // ── Resolve AI model ─────────────────────────────────────────────────────
  let aiModel = setting?.aiModelId
    ? await AiModel.findOne({
        _id: setting.aiModelId,
        isActive: true,
      })
    : await AiModel.findOne({
        tenantId: input.tenantId,
        isActive: true,
        isDefault: true,
      });

  if (!aiModel) {
    // Fall back to system-wide default model configured by the Admin
    aiModel = await AiModel.findOne({
      isActive: true,
      isDefault: true,
    });
  }

  if (!aiModel) {
    // Fall back to any active model in the database configured by the Admin
    aiModel = await AiModel.findOne({
      isActive: true,
    });
  }

  const provider = aiModel?.provider || "openai";
  const modelName =
    aiModel?.model || setting?.model || process.env.DEFAULT_AI_MODEL || "gpt-4o-mini";
  const apiKey = resolveApiKey(provider, aiModel?.apiKeyEncrypted);

  if (!apiKey) {
    throw new Error(
      provider === "google-gemini"
        ? "مفتاح Gemini غير مضبوط. أضف GOOGLE_AI_API_KEY في ملف البيئة أو في إعدادات النموذج."
        : "لم يتم ضبط مفتاح AI في ملف البيئة أو إعدادات النموذج."
    );
  }

  // ── Knowledge RAG ─────────────────────────────────────────────────────────
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
        showSources: bot.showKnowledgeSources ?? false,
      })
    : "";

  const personaDirectives: string[] = [];
  if (setting?.role && setting.role !== "assistant") {
    personaDirectives.push(`Your role is: ${setting.role}. Always stay in character.`);
  }
  if (setting?.language && setting.language !== "auto") {
    personaDirectives.push(`You must reply exclusively in this language: ${setting.language}.`);
  }
  if (setting?.tone && setting.tone !== "neutral") {
    personaDirectives.push(`Maintain a ${setting.tone} tone throughout the conversation.`);
  }
  if (setting?.responseLength && setting.responseLength !== "medium") {
    personaDirectives.push(`Keep your answers ${setting.responseLength}.`);
  }
  if (setting?.useEmojis === false) {
    personaDirectives.push(`Do NOT use any emojis in your responses.`);
  } else if (setting?.useEmojis === true) {
    personaDirectives.push(`Feel free to use relevant emojis in your responses.`);
  }

  const systemPrompt = [
    ...personaDirectives,
    setting?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    knowledgePrompt
      ? "قاعدة المعرفة هي مصدر الحقيقة الأول. لا تخالفها، ولا تحوّل المحادثة لبشر إلا عند وجود طلب صريح أو صلاحية بشرية لازمة."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelInput = knowledgePrompt
    ? `${knowledgePrompt}\n\nسياق المحادثة الأخير:\n${transcript}`
    : transcript;

  const temperature = setting?.temperature ?? 0.4;

  // ── Call provider ─────────────────────────────────────────────────────────
  let reply = "";
  let responseId = "";

  if (provider === "google-gemini") {
    ({ reply, responseId } = await callGemini({
      apiKey,
      model: modelName,
      systemPrompt,
      userInput: modelInput,
      temperature,
    }));
  } else if (provider === "openai-compatible") {
    ({ reply, responseId } = await callOpenAiCompatible({
      apiKey,
      model: modelName,
      baseUrl: aiModel?.baseUrl || undefined,
      systemPrompt,
      userInput: modelInput,
      temperature,
      useResponsesApi: false, // OpenAI-compatible APIs use chat.completions
    }));
  } else {
    // Native OpenAI — try Responses API first, fall back to chat.completions
    ({ reply, responseId } = await callOpenAiCompatible({
      apiKey,
      model: modelName,
      systemPrompt,
      userInput: modelInput,
      temperature,
      useResponsesApi: true,
    }));
  }

  reply ||= setting?.fallbackMessage || "أحتاج إلى معلومة إضافية حتى أجيب بدقة. ما المنتج أو الخدمة التي تقصدها؟";

  await Message.create({
    tenantId: input.tenantId,
    botId: input.botId,
    conversationId: conversation._id,
    sender: "assistant",
    content: reply,
    metadata: {
      responseId,
      provider,
      aiModelId: aiModel?._id?.toString(),
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
  };
}

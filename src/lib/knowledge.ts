import crypto from "crypto";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import OpenAI from "openai";
import { Types } from "mongoose";
import {
  Bot,
  AiSetting,
  KnowledgeCategory,
  KnowledgeChunk,
  KnowledgeCollection,
  KnowledgeDocument,
  AiModel
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";
import { knowledgeTrainingQueue, defaultJobOptions, makeQueueJobId } from "@/lib/queues";
import { logger } from "@/lib/logger";
import { routeAiRequest } from "@/lib/ai-router";

export const knowledgeSourceTypes = [
  "pdf",
  "docx",
  "txt",
  "csv",
  "excel",
  "faq",
  "website",
  "html",
  "product_catalog",
  "services_catalog",
  "policies",
  "terms",
  "pricing",
  "manual",
  "support_article",
  "custom_text"
] as const;

export type KnowledgeSourceType = (typeof knowledgeSourceTypes)[number];

type CreateKnowledgeInput = {
  tenantId: string;
  botId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  categoryName: string;
  collectionName: string;
  tags: string[];
  isTemporary?: boolean;
  expiresAt?: Date;
  text?: string;
  sourceUrl?: string;
  file?: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  };
};

type KnowledgeSearchResult = {
  text: string;
  score: number;
  semanticScore: number;
  keywordScore: number;
  sourceTitle: string;
  sourceUrl: string;
  tags: string[];
  documentId: string;
};

const LOCAL_HASH_DIMENSIONS = 128;
const defaultCategories = [
  "المنتجات",
  "الخدمات",
  "الأسعار",
  "الشحن",
  "الاسترجاع",
  "الضمان",
  "الدعم الفني",
  "الأسئلة الشائعة"
];

export async function ensureDefaultKnowledgeTaxonomy(tenantId: string) {
  await connectToDatabase();
  for (const [index, name] of defaultCategories.entries()) {
    const category = await KnowledgeCategory.findOneAndUpdate(
      { tenantId, name },
      {
        $setOnInsert: {
          tenantId,
          name,
          sortOrder: index + 1,
          isActive: true
        }
      },
      { new: true, upsert: true }
    );

    await KnowledgeCollection.findOneAndUpdate(
      { tenantId, categoryId: category._id, name: "عام" },
      {
        $setOnInsert: {
          tenantId,
          categoryId: category._id,
          name: "عام",
          sortOrder: 1,
          isActive: true
        }
      },
      { new: true, upsert: true }
    );
  }
}

export async function getKnowledgeDashboardData(tenantId: string) {
  await ensureDefaultKnowledgeTaxonomy(tenantId);
  const [bots, categories, collections, documents, aiSettings] = await Promise.all([
    Bot.find({ tenantId }).sort({ createdAt: -1 }).lean(),
    KnowledgeCategory.find({ tenantId, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    KnowledgeCollection.find({ tenantId, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    KnowledgeDocument.find({ tenantId }).sort({ updatedAt: -1 }).limit(80).lean(),
    AiSetting.find({ tenantId }).lean()
  ]);
  const settingsByBot = new Map(aiSettings.map((setting) => [String(setting.botId), setting]));

  return {
    bots: bots.map((bot) => ({
      id: String(bot._id),
      name: bot.name,
      knowledgeEnabled: bot.knowledgeEnabled ?? true,
      showKnowledgeSources: bot.showKnowledgeSources ?? false,
      confidenceDirectThreshold: bot.confidenceDirectThreshold ?? 70,
      confidenceReviewThreshold: bot.confidenceReviewThreshold ?? 40,
      systemPrompt: settingsByBot.get(String(bot._id))?.systemPrompt || "",
      autoFollowupEnabled: bot.autoFollowupEnabled ?? false,
      followupDelayMinutes: bot.followupDelayMinutes ?? 60,
      followupMaxAttempts: bot.followupMaxAttempts ?? 1,
      autoCloseEnabled: bot.autoCloseEnabled ?? false,
      autoCloseAfterMinutes: bot.autoCloseAfterMinutes ?? 1440,
      autoCloseMessage: bot.autoCloseMessage || ""
    })),
    categories: categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      description: category.description || ""
    })),
    collections: collections.map((collection) => ({
      id: String(collection._id),
      categoryId: String(collection.categoryId),
      name: collection.name
    })),
    documents: documents.map((document) => ({
      id: String(document._id),
      title: document.title,
      sourceType: document.sourceType,
      status: document.status,
      statusReason: document.statusReason || "",
      tags: document.tags || [],
      isTemporary: document.isTemporary || false,
      expiresAt: document.expiresAt ? new Date(document.expiresAt).toISOString() : "",
      chunkCount: document.chunkCount || 0,
      embeddingCount: document.embeddingCount || 0,
      needsRetraining: document.needsRetraining || false,
      updatedAt: document.updatedAt ? new Date(document.updatedAt).toISOString() : ""
    }))
  };
}

export async function getKnowledgeHealth(tenantId: string) {
  await connectToDatabase();
  const [documents, chunks, embeddings, duplicates, unprocessed, retraining, pages] = await Promise.all([
    KnowledgeDocument.countDocuments({ tenantId }),
    KnowledgeChunk.countDocuments({ tenantId }),
    KnowledgeChunk.countDocuments({ tenantId, "embedding.0": { $exists: true } }),
    KnowledgeDocument.countDocuments({ tenantId, status: "duplicate" }),
    KnowledgeDocument.countDocuments({ tenantId, status: { $in: ["pending", "processing", "error"] } }),
    KnowledgeDocument.countDocuments({ tenantId, needsRetraining: true }),
    KnowledgeDocument.aggregate<{ total: number }>([
      { $match: { tenantId: new Types.ObjectId(tenantId) } },
      { $group: { _id: null, total: { $sum: "$pageCount" } } }
    ])
  ]);

  return {
    documents,
    pages: pages[0]?.total || 0,
    chunks,
    embeddings,
    duplicates,
    unprocessed,
    retraining
  };
}

export async function createKnowledgeDocument(input: CreateKnowledgeInput) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.tenantId) || !Types.ObjectId.isValid(input.botId)) {
    throw new Error("معرف المستأجر أو البوت غير صالح.");
  }

  const [bot, category] = await Promise.all([
    Bot.findOne({ _id: input.botId, tenantId: input.tenantId }),
    upsertCategory(input.tenantId, input.categoryName)
  ]);
  if (!bot) throw new Error("البوت غير موجود داخل هذا الحساب.");

  const collection = await upsertCollection(input.tenantId, category._id, input.collectionName);
  const extracted = await extractKnowledgeText(input);
  const cleaned = cleanText(extracted.text);
  if (cleaned.length < 10) throw new Error("المحتوى قصير جدًا أو لا يحتوي على نص قابل للقراءة.");

  const textHash = hash(cleaned);
  const duplicate = await KnowledgeDocument.findOne({
    tenantId: input.tenantId,
    botId: input.botId,
    textHash,
    status: { $ne: "error" }
  });

  const document = await KnowledgeDocument.create({
    tenantId: input.tenantId,
    botId: input.botId,
    categoryId: category._id,
    collectionId: collection._id,
    title: input.title.trim(),
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl?.trim() || "",
    fileName: input.file?.name || "",
    mimeType: input.file?.type || "",
    sizeBytes: input.file?.size || Buffer.byteLength(cleaned),
    tags: normalizeTags(input.tags),
    isTemporary: input.isTemporary ?? false,
    expiresAt: input.expiresAt,
    status: duplicate ? "duplicate" : "pending",
    statusReason: duplicate ? "هذا المحتوى مكرر بالفعل." : "",
    duplicateOf: duplicate?._id,
    rawText: cleaned,
    textHash,
    pageCount: extracted.pageCount,
    metadata: {
      sourceUrl: input.sourceUrl || "",
      originalLength: extracted.text.length,
      cleanedLength: cleaned.length
    },
    needsRetraining: false
  });

  if (!duplicate) {
    const jobId = makeQueueJobId("knowledge-train", document._id.toString());
    await knowledgeTrainingQueue.add(
      "train-document",
      { documentId: document._id.toString(), tenantId: input.tenantId },
      { ...defaultJobOptions, jobId }
    );
    logger.info("knowledge.training_enqueued", {
      documentId: document._id.toString(),
      tenantId: input.tenantId
    });
  }

  return document._id.toString();
}

export async function trainKnowledgeDocument(documentId: string, tenantId: string) {
  await connectToDatabase();
  const document = await KnowledgeDocument.findOne({ _id: documentId, tenantId });
  if (!document) throw new Error("مصدر المعرفة غير موجود.");

  document.status = "processing";
  document.statusReason = "";
  await document.save();

  try {
    await KnowledgeChunk.deleteMany({ tenantId, documentId: document._id });
    const chunks = splitIntoChunks(document.rawText || "");
    const records = [];

    let aiModel = await AiModel.findOne({ tenantId, provider: "openai", isActive: true });
    if (!aiModel) {
      aiModel = await AiModel.findOne({ provider: "openai", isActive: true });
    }

    const apiKey = aiModel ? decryptSecret(aiModel.apiKeyEncrypted) : "";

    for (let index = 0; index < chunks.length; index += 1) {
      const text = chunks[index];
      const normalizedText = normalizeForSearch(text);
      const { embedding, provider } = await createEmbedding(text, apiKey);
      records.push({
        tenantId,
        botId: document.botId,
        documentId: document._id,
        categoryId: document.categoryId,
        collectionId: document.collectionId,
        chunkIndex: index,
        text,
        normalizedText,
        keywords: extractKeywords(text),
        embedding,
        embeddingProvider: provider,
        isTemporary: document.isTemporary || false,
        expiresAt: document.expiresAt,
        tokenEstimate: estimateTokens(text),
        sourceTitle: document.title,
        sourceUrl: document.sourceUrl || "",
        contentHash: hash(text),
        metadata: {
          sourceType: document.sourceType,
          tags: Array.isArray(document.tags) ? [...document.tags] : []
        }
      });
    }

    if (records.length) await KnowledgeChunk.insertMany(records);

    document.status = "ready";
    document.statusReason = "";
    document.chunkCount = records.length;
    document.embeddingCount = records.filter((item) => item.embedding.length > 0).length;
    document.lastTrainedAt = new Date();
    document.needsRetraining = false;
    await document.save();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "فشل تدريب مصدر المعرفة.";
    document.status = "error";
    document.statusReason = reason;
    document.needsRetraining = true;
    await document.save();
    logger.error("knowledge.training_failed", { documentId, tenantId, error: reason });
    throw error;
  }
}

export async function retrainAllKnowledge(tenantId: string, botId?: string) {
  await connectToDatabase();
  const filter: Record<string, unknown> = { tenantId, status: { $ne: "duplicate" } };
  if (botId) filter.botId = botId;
  const documents = await KnowledgeDocument.find(filter).select("_id").lean();

  const jobs = documents.map((doc) => ({
    name: "train-document",
    data: { documentId: doc._id.toString(), tenantId },
    opts: {
      ...defaultJobOptions,
      jobId: makeQueueJobId("knowledge-retrain", doc._id.toString()),
    },
  }));

  if (jobs.length) {
    await knowledgeTrainingQueue.addBulk(jobs);
    logger.info("knowledge.retrain_enqueued", { tenantId, botId, count: jobs.length });
  }

  return documents.length;
}

export async function getKnowledgeDocumentStatus(documentId: string, tenantId: string) {
  await connectToDatabase();
  const document = await KnowledgeDocument.findOne({ _id: documentId, tenantId })
    .select("status statusReason chunkCount embeddingCount needsRetraining")
    .lean();
  if (!document) return null;
  return {
    status: document.status,
    statusReason: document.statusReason || null,
    chunkCount: document.chunkCount || 0,
    embeddingCount: document.embeddingCount || 0,
    needsRetraining: document.needsRetraining || false,
  };
}

export async function getKnowledgeDocumentForEdit(documentId: string, tenantId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(documentId)) throw new Error("معرف مصدر المعرفة غير صالح.");
  const document = await KnowledgeDocument.findOne({ _id: documentId, tenantId }).lean();
  if (!document) throw new Error("مصدر المعرفة غير موجود.");
  return {
    id: document._id.toString(),
    title: document.title,
    sourceType: document.sourceType,
    sourceUrl: document.sourceUrl || "",
    tags: document.tags || [],
    rawText: document.rawText || "",
    status: document.status,
    statusReason: document.statusReason || "",
    needsRetraining: document.needsRetraining || false,
    updatedAt: document.updatedAt ? new Date(document.updatedAt).toISOString() : ""
  };
}

export async function updateKnowledgeDocument(input: {
  documentId: string;
  tenantId: string;
  title?: string;
  rawText?: string;
  tags?: string[];
  sourceUrl?: string;
}) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.documentId)) throw new Error("معرف مصدر المعرفة غير صالح.");
  const document = await KnowledgeDocument.findOne({ _id: input.documentId, tenantId: input.tenantId });
  if (!document) throw new Error("مصدر المعرفة غير موجود.");

  if (typeof input.title === "string" && input.title.trim()) document.title = input.title.trim();
  if (typeof input.sourceUrl === "string") document.sourceUrl = input.sourceUrl.trim();
  if (Array.isArray(input.tags)) document.tags = normalizeTags(input.tags);
  if (typeof input.rawText === "string") {
    const cleaned = cleanText(input.rawText);
    if (cleaned.length < 10) throw new Error("المحتوى قصير جدًا أو لا يحتوي على نص قابل للقراءة.");
    document.rawText = cleaned;
    document.textHash = hash(cleaned);
    document.sizeBytes = Buffer.byteLength(cleaned);
    document.status = "pending";
    document.statusReason = "تم تعديل المحتوى ويحتاج إعادة تدريب.";
    document.needsRetraining = true;
  }
  await document.save();
  return { success: true, id: document._id.toString(), needsRetraining: document.needsRetraining };
}

export async function deleteKnowledgeDocument(documentId: string, tenantId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(documentId)) throw new Error("معرف مصدر المعرفة غير صالح.");
  const document = await KnowledgeDocument.findOne({ _id: documentId, tenantId }).select("_id");
  if (!document) throw new Error("مصدر المعرفة غير موجود.");
  await Promise.all([
    KnowledgeChunk.deleteMany({ tenantId, documentId: document._id }),
    KnowledgeDocument.deleteOne({ _id: document._id, tenantId })
  ]);
  return { success: true, deleted: true };
}

export async function rewriteKnowledgeDocumentWithAi(documentId: string, tenantId: string) {
  await connectToDatabase();
  const document = await KnowledgeDocument.findOne({ _id: documentId, tenantId });
  if (!document) throw new Error("مصدر المعرفة غير موجود.");
  const currentText = String(document.rawText || "").trim();
  if (currentText.length < 10) throw new Error("لا يوجد نص كافٍ لإعادة الصياغة.");

  const result = await routeAiRequest({
    temperature: 0.2,
    systemPrompt: [
      "You are a knowledge-base editor for an Arabic/English omnichannel CRM.",
      "Rewrite the supplied content to be clearer, structured, searchable, and factual.",
      "Do not add facts that are not present. Preserve product names, prices, policies, phone numbers, URLs, and dates exactly.",
      "Return only the rewritten knowledge text, no markdown fence."
    ].join("\n"),
    userInput: currentText.slice(0, 24_000)
  });

  const rewritten = cleanText(result.reply || "");
  if (rewritten.length < 10) throw new Error("لم يتمكن الذكاء الاصطناعي من إعادة صياغة النص.");
  document.rawText = rewritten;
  document.textHash = hash(rewritten);
  document.sizeBytes = Buffer.byteLength(rewritten);
  document.status = "pending";
  document.statusReason = "تمت إعادة الصياغة بالذكاء الاصطناعي ويحتاج المصدر لإعادة التدريب.";
  document.needsRetraining = true;
  document.metadata = {
    ...(document.metadata || {}),
    rewrittenByAiAt: new Date().toISOString(),
    rewrittenProvider: result.providerUsed,
    rewrittenModel: result.modelUsed
  };
  await document.save();
  return { success: true, id: document._id.toString(), rawText: rewritten };
}

export async function searchKnowledge(input: {
  tenantId: string;
  botId: string;
  question: string;
  limit?: number;
}) {
  await connectToDatabase();
  const question = cleanText(input.question);

  const aiModel = await AiModel.findOne({ tenantId: input.tenantId, provider: "openai", isActive: true });
  const apiKey = aiModel ? decryptSecret(aiModel.apiKeyEncrypted) : "";
  const { embedding: queryEmbedding, provider: queryProvider } = await createEmbedding(question, apiKey);
  const queryKeywords = extractKeywords(question);

  const notExpired = { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }] };

  const semanticCandidates = await KnowledgeChunk.find({
    tenantId: input.tenantId,
    botId: input.botId,
    ...notExpired
  })
    .sort({ updatedAt: -1 })
    .limit(Number(process.env.KNOWLEDGE_CANDIDATE_LIMIT || 600))
    .lean();

  const keywordCandidates = queryKeywords.length
    ? await KnowledgeChunk.find(
        {
          tenantId: input.tenantId,
          botId: input.botId,
          ...notExpired,
          $text: { $search: queryKeywords.join(" ") }
        },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(80)
        .lean()
        .catch(() => [])
    : [];

  const candidates = new Map<string, (typeof semanticCandidates)[number]>();
  for (const item of [...semanticCandidates, ...keywordCandidates]) candidates.set(item._id.toString(), item);

  const scored = [...candidates.values()]
    .map((item) => {
      const itemEmbedding = Array.isArray(item.embedding) ? item.embedding : [];
      const comparableQueryEmbedding = itemEmbedding.length === queryEmbedding.length
        ? queryEmbedding
        : localHashEmbedding(question);
      const comparableItemEmbedding = itemEmbedding.length === comparableQueryEmbedding.length
        ? itemEmbedding
        : localHashEmbedding(item.text || "");
      const semanticScore = cosineSimilarity(comparableQueryEmbedding, comparableItemEmbedding);
      const keywordScore = keywordOverlap(queryKeywords, item.keywords || [], item.normalizedText || "");
      const score = Math.round((semanticScore * 0.45 + keywordScore * 0.55) * 100);
      return {
        text: item.text,
        score,
        semanticScore: Math.round(semanticScore * 100),
        keywordScore: Math.round(keywordScore * 100),
        sourceTitle: item.sourceTitle || "Knowledge Base",
        sourceUrl: item.sourceUrl || "",
        tags: Array.isArray(item.metadata?.tags) ? item.metadata.tags : [],
        documentId: item.documentId.toString()
      };
    })
    .sort((a, b) => b.score - a.score);

  const top10 = scored.slice(0, input.limit || 10);
  const confidence = calculateConfidence(top10, queryKeywords);

  const needsRetrainingCount = await KnowledgeChunk.countDocuments({
    tenantId: input.tenantId,
    botId: input.botId,
    embeddingProvider: { $ne: queryProvider }
  });

  return {
    intent: inferIntent(question),
    keywords: queryKeywords,
    confidence,
    results: top10,
    embeddingProvider: queryProvider,
    ...(needsRetrainingCount > 0 ? { needsRetraining: needsRetrainingCount } : {})
  };
}

export function buildKnowledgePrompt(input: {
  question: string;
  intent: string;
  keywords: string[];
  confidence: number;
  results: KnowledgeSearchResult[];
  showSources: boolean;
}) {
  if (!input.results.length) {
    return [
      "لم يتم العثور على مصادر كافية في قاعدة المعرفة.",
      "اطرح سؤالًا توضيحيًا محددًا بدل قول لا أعرف.",
      `السؤال: ${input.question}`
    ].join("\n");
  }

  const sources = input.results.slice(0, 6).map((result, index) => {
    const source = input.showSources
      ? `\nالمصدر: ${result.sourceTitle}${result.sourceUrl ? ` - ${result.sourceUrl}` : ""}`
      : "";
    return `#${index + 1} score=${result.score}${source}\n${result.text}`;
  });

  return [
    "قاعدة المعرفة هي مصدر الحقيقة الأول. اجعل 90% من الرد مبنيًا على هذه المقاطع عند توفرها.",
    "لا تقل لا أعرف ولا تحول للدعم إذا كان هناك أي مقطع مفيد؛ استخرج أفضل إجابة مباشرة من المقاطع المتاحة.",
    "إذا كانت الثقة أعلى من 50 أجب مباشرة. بين 15 و50 أجب بإجابة قصيرة مبنية على الموجود ثم اسأل سؤالًا توضيحيًا واحدًا. أقل من 15 اسأل سؤالًا توضيحيًا محددًا.",
    "لا تحول المحادثة إلى موظف إلا إذا طلب المستخدم ذلك صراحة أو كانت عملية مالية/إدارية تحتاج صلاحية بشرية أو انتهت محاولات التوضيح.",
    `Intent: ${input.intent}`,
    `Keywords: ${input.keywords.join(", ") || "-"}`,
    `Confidence: ${input.confidence}/100`,
    "المصادر المسترجعة:",
    sources.join("\n\n"),
    `سؤال المستخدم: ${input.question}`
  ].join("\n");
}

async function upsertCategory(tenantId: string, name: string) {
  const safeName = name.trim() || "الأسئلة الشائعة";
  return KnowledgeCategory.findOneAndUpdate(
    { tenantId, name: safeName },
    { $setOnInsert: { tenantId, name: safeName, isActive: true } },
    { new: true, upsert: true }
  );
}

async function upsertCollection(tenantId: string, categoryId: Types.ObjectId, name: string) {
  const safeName = name.trim() || "عام";
  return KnowledgeCollection.findOneAndUpdate(
    { tenantId, categoryId, name: safeName },
    { $setOnInsert: { tenantId, categoryId, name: safeName, isActive: true } },
    { new: true, upsert: true }
  );
}

async function extractKnowledgeText(input: CreateKnowledgeInput) {
  if (input.sourceUrl && (input.sourceType === "website" || input.sourceType === "html")) {
    const response = await fetch(input.sourceUrl, { redirect: "follow" });
    if (!response.ok) throw new Error("تعذر تحميل رابط المعرفة.");
    const html = await response.text();
    return { text: stripHtml(html), pageCount: 1 };
  }

  if (!input.file) {
    return { text: stripHtml(input.text || ""), pageCount: 1 };
  }

  if (input.sourceType === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: input.file.buffer });
    try {
      const result = await parser.getText();
      return { text: result.text || "", pageCount: result.pages?.length || 1 };
    } finally {
      await parser.destroy();
    }
  }

  if (input.sourceType === "docx") {
    const result = await mammoth.extractRawText({ buffer: input.file.buffer });
    return { text: result.value || "", pageCount: 1 };
  }

  if (input.sourceType === "excel") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(input.file.buffer as unknown as ArrayBuffer);
    const rows: string[] = [];
    workbook.eachSheet((sheet) => {
      rows.push(`Sheet: ${sheet.name}`);
      sheet.eachRow((row) => {
        const values = row.values as unknown[];
        rows.push(values.filter(Boolean).join(" | "));
      });
    });
    return { text: rows.join("\n"), pageCount: workbook.worksheets.length || 1 };
  }

  return { text: input.file.buffer.toString("utf8"), pageCount: 1 };
}

function cleanText(value: string) {
  const lines = value
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(lines)].join("\n").trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function splitIntoChunks(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  const chunkSize = 420;
  const overlap = 70;
  for (let start = 0; start < words.length; start += chunkSize - overlap) {
    const chunk = words.slice(start, start + chunkSize).join(" ").trim();
    if (chunk.length > 80) chunks.push(chunk);
  }
  return chunks.length ? chunks : [text];
}

async function createEmbedding(text: string, apiKey?: string): Promise<{ embedding: number[]; provider: string }> {
  const finalApiKey = apiKey || process.env.OPENAI_API_KEY;
  if (finalApiKey) {
    try {
      const client = new OpenAI({ apiKey: finalApiKey });
      const response = await client.embeddings.create({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: text.slice(0, 8000)
      });
      return { embedding: response.data[0]?.embedding || [], provider: "openai" };
    } catch (error) {
      logger.warn("knowledge.openai_embedding_failed_fallback", {
        error: error instanceof Error ? error.message : "unknown"
      });
    }
  }
  return { embedding: localHashEmbedding(text), provider: "local-hash" };
}

function localHashEmbedding(text: string) {
  const vector = Array.from({ length: LOCAL_HASH_DIMENSIONS }, () => 0);
  for (const token of extractKeywords(text, 200)) {
    const digest = crypto.createHash("sha256").update(token).digest();
    const index = digest[0] % LOCAL_HASH_DIMENSIONS;
    vector[index] += 1;
  }
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / length).toFixed(6)));
}

/**
 * Computes cosine similarity between two vectors.
 * Returns 0 immediately if dimensions don't match — comparing vectors of different
 * dimensions (e.g. OpenAI 1536 vs local-hash 128) would produce misleading scores.
 */
function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length) return 0;
  if (a.length !== b.length) {
    logger.warn("knowledge.cosine_dimension_mismatch", { aLen: a.length, bLen: b.length });
    return 0;
  }
  let dot = 0;
  let aLen = 0;
  let bLen = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aLen += a[i] * a[i];
    bLen += b[i] * b[i];
  }
  return dot / ((Math.sqrt(aLen) || 1) * (Math.sqrt(bLen) || 1));
}

function keywordOverlap(queryKeywords: string[], chunkKeywords: string[], normalizedText: string) {
  if (!queryKeywords.length) return 0;
  const chunkSet = new Set(chunkKeywords);
  const matches = queryKeywords.filter((keyword) => chunkSet.has(keyword) || normalizedText.includes(keyword));
  return Math.min(1, matches.length / Math.max(2, queryKeywords.length));
}

function calculateConfidence(results: KnowledgeSearchResult[], keywords: string[]) {
  if (!results.length) return 0;
  const best = results[0].score;
  const second = results[1]?.score || 0;
  const coverage = Math.min(20, keywords.length * 3);
  const spread = Math.max(0, best - second);
  return Math.max(0, Math.min(100, Math.round(best * 0.78 + coverage + spread * 0.12)));
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(value: string, limit = 32) {
  const stopWords = new Set([
    "من", "في", "على", "عن", "الى", "إلى", "ما", "هل", "هو", "هي",
    "the", "and", "for", "with", "you", "are", "what", "how", "is"
  ]);
  const tokens = normalizeForSearch(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
  return [...new Set(tokens)].slice(0, limit);
}

function inferIntent(question: string) {
  const normalized = normalizeForSearch(question);
  if (/سعر|اسعار|pricing|price|plan|خطة/.test(normalized)) return "pricing";
  if (/شحن|توصيل|shipping|delivery/.test(normalized)) return "shipping";
  if (/استرجاع|استبدال|refund|return/.test(normalized)) return "returns";
  if (/ضمان|warranty/.test(normalized)) return "warranty";
  if (/منتج|product/.test(normalized)) return "product";
  if (/خدمة|service/.test(normalized)) return "service";
  if (/دعم|support|مشكلة/.test(normalized)) return "support";
  return "general_question";
}

function estimateTokens(text: string) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35);
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

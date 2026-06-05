import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const sourceTypes = [
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

const knowledgeDocumentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "KnowledgeCategory", required: true, index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "KnowledgeCollection", required: true, index: true },
    title: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: sourceTypes, required: true, index: true },
    sourceUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
    tags: [{ type: String, trim: true, index: true }],
    isTemporary: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: false, index: true },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "error", "needs_retraining", "duplicate"],
      default: "pending",
      index: true
    },
    statusReason: { type: String, default: "" },
    rawText: { type: String, default: "" },
    textHash: { type: String, default: "", index: true },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "KnowledgeDocument", required: false },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    embeddingCount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    lastTrainedAt: { type: Date },
    needsRetraining: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

knowledgeDocumentSchema.index({ tenantId: 1, botId: 1, title: 1 });
knowledgeDocumentSchema.index({ tenantId: 1, botId: 1, textHash: 1 });

export type KnowledgeDocumentDocument = InferSchemaType<typeof knowledgeDocumentSchema>;
export const KnowledgeDocument =
  (models.KnowledgeDocument as Model<KnowledgeDocumentDocument>) ||
  model("KnowledgeDocument", knowledgeDocumentSchema);

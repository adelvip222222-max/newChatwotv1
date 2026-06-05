import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const knowledgeChunkSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "KnowledgeDocument", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "KnowledgeCategory", required: true, index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "KnowledgeCollection", required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    normalizedText: { type: String, required: true },
    keywords: [{ type: String, trim: true, index: true }],
    embedding: [{ type: Number }],
    embeddingProvider: { type: String, default: "local-hash" },
    isTemporary: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: false, index: true },
    tokenEstimate: { type: Number, default: 0 },
    sourceTitle: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },
    pageNumber: { type: Number, default: 0 },
    contentHash: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ tenantId: 1, botId: 1, normalizedText: "text", keywords: "text" });
knowledgeChunkSchema.index({ tenantId: 1, botId: 1, documentId: 1, chunkIndex: 1 }, { unique: true });

export type KnowledgeChunkDocument = InferSchemaType<typeof knowledgeChunkSchema>;
export const KnowledgeChunk =
  (models.KnowledgeChunk as Model<KnowledgeChunkDocument>) || model("KnowledgeChunk", knowledgeChunkSchema);

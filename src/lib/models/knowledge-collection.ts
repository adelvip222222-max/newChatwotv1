import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const knowledgeCollectionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "KnowledgeCategory", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

knowledgeCollectionSchema.index({ tenantId: 1, categoryId: 1, name: 1 }, { unique: true });

export type KnowledgeCollectionDocument = InferSchemaType<typeof knowledgeCollectionSchema>;
export const KnowledgeCollection =
  (models.KnowledgeCollection as Model<KnowledgeCollectionDocument>) ||
  model("KnowledgeCollection", knowledgeCollectionSchema);

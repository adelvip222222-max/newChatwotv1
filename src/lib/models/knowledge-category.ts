import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const knowledgeCategorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

knowledgeCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type KnowledgeCategoryDocument = InferSchemaType<typeof knowledgeCategorySchema>;
export const KnowledgeCategory =
  (models.KnowledgeCategory as Model<KnowledgeCategoryDocument>) ||
  model("KnowledgeCategory", knowledgeCategorySchema);

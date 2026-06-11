import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const savedReplySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true },
    category: { type: String, default: "general", index: true },
    tags: [{ type: String, trim: true, index: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

savedReplySchema.index({ tenantId: 1, title: 1 }, { unique: true });
savedReplySchema.index({ tenantId: 1, category: 1, isActive: 1 });
savedReplySchema.index({ tenantId: 1, title: "text", body: "text", tags: "text" });

export type SavedReplyDocument = InferSchemaType<typeof savedReplySchema>;
export const SavedReply =
  (models.SavedReply as Model<SavedReplyDocument>) || model("SavedReply", savedReplySchema);

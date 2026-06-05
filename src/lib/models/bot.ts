import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const botSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    description: { type: String, default: "" },
    knowledgeEnabled: { type: Boolean, default: true },
    showKnowledgeSources: { type: Boolean, default: false },
    confidenceDirectThreshold: { type: Number, default: 70, min: 0, max: 100 },
    confidenceReviewThreshold: { type: Number, default: 40, min: 0, max: 100 },
    autoFollowupEnabled: { type: Boolean, default: false },
    followupDelayMinutes: { type: Number, default: 60, min: 1 },
    followupMaxAttempts: { type: Number, default: 1, min: 0, max: 5 },
    autoCloseEnabled: { type: Boolean, default: false },
    autoCloseAfterMinutes: { type: Number, default: 1440, min: 1 },
    autoCloseMessage: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export type BotDocument = InferSchemaType<typeof botSchema>;
export const Bot = (models.Bot as Model<BotDocument>) || model("Bot", botSchema);

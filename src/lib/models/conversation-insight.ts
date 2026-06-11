import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const aiSuggestionSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    text: { type: String, required: true },
    tone: { type: String, default: "professional" },
    confidence: { type: Number, default: 70, min: 0, max: 100 },
    source: { type: String, enum: ["knowledge", "llm", "fallback"], default: "fallback" }
  },
  { _id: false }
);

const conversationInsightSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", index: true },
    summary: { type: String, default: "" },
    sentiment: { type: String, enum: ["positive", "neutral", "negative"], default: "neutral", index: true },
    sentimentScore: { type: Number, default: 0 },
    intent: {
      type: String,
      enum: ["complaint", "sales", "support", "billing", "cancellation", "upgrade", "general"],
      default: "general",
      index: true
    },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    needsHuman: { type: Boolean, default: false, index: true },
    escalationReason: { type: String, default: "" },
    suggestedReplies: [aiSuggestionSchema],
    bestReply: { type: String, default: "" },
    customerFacts: [{ type: String }],
    recommendedActions: [{ type: String }],
    knowledgeSources: [{
      title: { type: String },
      url: { type: String },
      score: { type: Number },
      documentId: { type: String }
    }],
    detectedTags: [{ type: String, trim: true }],
    modelProvider: { type: String, default: "" },
    modelName: { type: String, default: "" },
    analyzedMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    expiresAt: { type: Date, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

conversationInsightSchema.index({ tenantId: 1, conversationId: 1 }, { unique: true });
conversationInsightSchema.index({ tenantId: 1, needsHuman: 1, updatedAt: -1 });
conversationInsightSchema.index({ tenantId: 1, intent: 1, sentiment: 1, updatedAt: -1 });

export type ConversationInsightDocument = InferSchemaType<typeof conversationInsightSchema>;
export const ConversationInsight =
  (models.ConversationInsight as Model<ConversationInsightDocument>) ||
  model("ConversationInsight", conversationInsightSchema);

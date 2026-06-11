import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const conversationSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: false, index: true },
    channel: { type: String, required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", index: true },
    channelIdentityId: { type: Schema.Types.ObjectId, ref: "ChannelIdentity", index: true },
    provider: { type: String },
    externalUserId: { type: String, required: true, index: true },
    externalThreadId: { type: String },
    mode: { type: String, enum: ["ai", "human", "hybrid"], default: "ai" },
    aiPaused: { type: Boolean, default: false },
    aiPausedReason: { type: String },
    aiPausedAt: { type: Date },
    aiTurnCount: { type: Number, default: 0 },
    aiStatus: {
      type: String,
      enum: ["active", "suggesting", "needs_review", "escalated", "paused"],
      default: "active",
      index: true
    },
    aiConfidence: { type: Number, min: 0, max: 100 },
    aiSummary: { type: String, default: "" },
    aiSentiment: { type: String, enum: ["positive", "neutral", "negative"], default: "neutral", index: true },
    aiIntent: {
      type: String,
      enum: ["complaint", "sales", "support", "billing", "cancellation", "upgrade", "general"],
      default: "general",
      index: true
    },
    aiEscalationReason: { type: String, default: "" },
    aiLastAnalyzedAt: { type: Date },
    activePersonaId: { type: Schema.Types.ObjectId, ref: "AiPersona" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "User" },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    assignedTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
    assignedAt: { type: Date },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    handoffReason: { type: String },
    status: { type: String, enum: ["open", "pending", "resolved", "closed", "snoozed", "archived"], default: "open", index: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    labels: [{ type: String }],
    tags: [{ type: String, trim: true }],
    unreadCount: { type: Number, default: 0 },
    lastMessagePreview: { type: String, default: "" },
    lastMessageAt: { type: Date },
    lastCustomerMessageAt: { type: Date },
    lastAgentMessageAt: { type: Date },
    lastAiMessageAt: { type: Date },
    firstResponseDueAt: { type: Date },
    resolutionDueAt: { type: Date },
    firstResponseMs: { type: Number },
    resolutionMs: { type: Number },
    slaStatus: { type: String, enum: ["on_track", "at_risk", "breached", "met", "paused"], default: "on_track", index: true },
    snoozedUntil: { type: Date },
    resolvedAt: { type: Date },
    archivedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

conversationSchema.index({ tenantId: 1, provider: 1, externalThreadId: 1 });
conversationSchema.index({ tenantId: 1, contactId: 1 });
conversationSchema.index({ tenantId: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, unreadCount: -1, lastMessageAt: -1, updatedAt: -1 });
conversationSchema.index({ tenantId: 1, assignedAgentId: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, assignedTeamId: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, aiStatus: 1, priority: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, provider: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, labels: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, tags: 1, lastMessageAt: -1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema>;
export const Conversation =
  (models.Conversation as Model<ConversationDocument>) || model("Conversation", conversationSchema);

import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const conversationEventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorType: {
      type: String,
      enum: ["agent", "ai", "system", "customer"],
      default: "system",
      index: true
    },
    type: {
      type: String,
      enum: ["ai_event", "assignment", "status", "sla", "tag", "read", "typing"],
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

conversationEventSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
conversationEventSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

export type ConversationEventDocument = InferSchemaType<typeof conversationEventSchema>;
export const ConversationEvent =
  (models.ConversationEvent as Model<ConversationEventDocument>) ||
  model("ConversationEvent", conversationEventSchema);

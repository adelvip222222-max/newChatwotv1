import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const conversationSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    channel: { type: String, required: true, index: true },
    externalUserId: { type: String, required: true, index: true },
    status: { type: String, enum: ["open", "human", "closed"], default: "open" }
  },
  { timestamps: true }
);

conversationSchema.index({ botId: 1, channel: 1, externalUserId: 1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema>;
export const Conversation =
  (models.Conversation as Model<ConversationDocument>) || model("Conversation", conversationSchema);

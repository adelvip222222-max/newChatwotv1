import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const messageSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: String, enum: ["user", "assistant", "agent", "system"], required: true },
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export type MessageDocument = InferSchemaType<typeof messageSchema>;
export const Message = (models.Message as Model<MessageDocument>) || model("Message", messageSchema);

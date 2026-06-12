import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const messageSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: String, enum: ["user", "assistant", "agent", "system"], required: true },
    content: { type: String, required: true },
    attachments: {
      type: [
        {
          id: { type: String, required: true },
          type: { type: String, enum: ["image", "audio", "file"], required: true },
          key: { type: String, required: true },
          url: { type: String, default: "" },
          name: { type: String, required: true },
          mimeType: { type: String, required: true },
          size: { type: Number, required: true },
        },
      ],
      default: [],
    },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export type MessageDocument = InferSchemaType<typeof messageSchema>;
export const Message = (models.Message as Model<MessageDocument>) || model("Message", messageSchema);

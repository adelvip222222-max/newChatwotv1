import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const messageSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: false, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    channelIdentityId: { type: Schema.Types.ObjectId, ref: "ChannelIdentity" },
    provider: { type: String },
    externalMessageId: { type: String, index: true },
    direction: { type: String, enum: ["incoming", "outgoing"], required: true },
    sender: { type: String, enum: ["user", "assistant", "agent", "system"], required: true },
    senderType: { type: String, enum: ["customer", "agent", "assistant", "system"] },
    content: { type: String, required: true },
    deliveryStatus: { type: String, enum: ["queued", "sending", "sent", "delivered", "read", "failed"], default: "sent" },
    attachments: [{
      type: { type: String },
      url: { type: String },
      name: { type: String },
      size: { type: Number },
      mimeType: { type: String }
    }],
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

messageSchema.index(
  { tenantId: 1, provider: 1, externalMessageId: 1 },
  { unique: true, partialFilterExpression: { externalMessageId: { $exists: true, $type: "string" } } }
);
messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: -1 });
messageSchema.index({ tenantId: 1, createdAt: -1 });
messageSchema.index({ tenantId: 1, content: "text" });

export type MessageDocument = InferSchemaType<typeof messageSchema>;
export const Message = (models.Message as Model<MessageDocument>) || model("Message", messageSchema);

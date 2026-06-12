import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const messageDeliverySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    provider: { type: String, required: true },
    externalMessageId: { type: String },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "delivered", "read", "failed", "canceled"],
      default: "queued"
    },
    direction: { type: String, enum: ["incoming", "outgoing"], required: true },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    nextRetryAt: { type: Date },
    errorCode: { type: String },
    errorMessage: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

messageDeliverySchema.index({ tenantId: 1, messageId: 1 });
messageDeliverySchema.index({ tenantId: 1, status: 1, nextRetryAt: 1 });
// unique index for external message id per provider
messageDeliverySchema.index(
  { tenantId: 1, provider: 1, externalMessageId: 1 },
  { unique: true, partialFilterExpression: { externalMessageId: { $exists: true, $type: "string" } } }
);

export type MessageDeliveryDocument = InferSchemaType<typeof messageDeliverySchema>;
export const MessageDelivery = (models.MessageDelivery as Model<MessageDeliveryDocument>) || model("MessageDelivery", messageDeliverySchema);

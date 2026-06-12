import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const webhookEventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel" },
    provider: { type: String, required: true },
    externalEventId: { type: String, required: true },
    eventType: { type: String },
    payloadHash: { type: String },
    status: { type: String, enum: ["received", "processing", "processed", "failed", "ignored"], default: "received" },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    error: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    rawPayload: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, externalEventId: 1 }, { unique: true });
webhookEventSchema.index({ tenantId: 1, channelId: 1, receivedAt: -1 });
webhookEventSchema.index({ provider: 1, payloadHash: 1 });

export type WebhookEventDocument = InferSchemaType<typeof webhookEventSchema>;
export const WebhookEvent = (models.WebhookEvent as Model<WebhookEventDocument>) || model("WebhookEvent", webhookEventSchema);

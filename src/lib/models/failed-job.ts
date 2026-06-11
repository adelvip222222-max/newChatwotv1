import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const failedJobSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    queueName: { type: String, required: true, index: true },
    jobName: { type: String, required: true },
    jobId: { type: String, index: true },
    provider: { type: String, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", required: false, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: false, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: false, index: true },
    externalMessageId: { type: String, index: true },
    traceId: { type: String, index: true },
    attemptsMade: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    stack: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed, default: {} },
    failedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

failedJobSchema.index({ queueName: 1, failedAt: -1 });
failedJobSchema.index({ tenantId: 1, failedAt: -1 });

export type FailedJobDocument = InferSchemaType<typeof failedJobSchema>;
export const FailedJob = (models.FailedJob as Model<FailedJobDocument>) || model("FailedJob", failedJobSchema);

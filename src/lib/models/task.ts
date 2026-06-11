import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const taskSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: false, index: true },
    type: { type: String, required: true }, // e.g., "order", "support_ticket", "booking"
    title: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["open", "in_progress", "closed"], default: "open" }
  },
  { timestamps: true }
);

taskSchema.index({ tenantId: 1, status: 1 });

export type TaskDocument = InferSchemaType<typeof taskSchema>;
export const Task = (models.Task as Model<TaskDocument>) || model("Task", taskSchema);

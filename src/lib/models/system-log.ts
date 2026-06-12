import { Schema, models, model, type InferSchemaType, type Model, Types } from "mongoose";

const systemLogSchema = new Schema(
  {
    eventType: { 
      type: String, 
      required: true, 
      index: true,
      enum: ["login_success", "login_failed", "suspicious_activity", "system_error", "rate_limit_exceeded", "logout", "admin_action"]
    },
    ipAddress: { type: String, default: "unknown", index: true },
    email: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    details: { type: Schema.Types.Mixed },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "info" }
  },
  { 
    timestamps: true,
    expires: 30 * 24 * 60 * 60 // Automatically delete logs older than 30 days
  }
);

systemLogSchema.index({ createdAt: -1 });

export type SystemLogDocument = InferSchemaType<typeof systemLogSchema> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export const SystemLog = (models.SystemLog as Model<SystemLogDocument>) || model("SystemLog", systemLogSchema);

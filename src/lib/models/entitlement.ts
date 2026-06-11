import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

export type EntitlementKey =
  | "max_channels"
  | "max_agents"
  | "max_bots"
  | "max_team_members"
  | "monthly_message_limit"
  | "knowledge_enabled"
  | "advanced_ai_enabled"
  | "instagram_enabled"
  | "whatsapp_enabled"
  | "facebook_enabled"
  | "telegram_enabled"
  | "qdrant_enabled"
  | "api_access_enabled"
  | "white_label_enabled";

const entitlementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "BillingPlan", required: false },
    key: { type: String, required: true, trim: true },
    limitValue: { type: Number, required: false },
    boolValue: { type: Boolean, required: false },
    isOverride: { type: Boolean, default: false },
    expiresAt: { type: Date, required: false, index: true }
  },
  { timestamps: true }
);

entitlementSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export type EntitlementDocument = InferSchemaType<typeof entitlementSchema>;
export const Entitlement = (models.Entitlement as Model<EntitlementDocument>) || model("Entitlement", entitlementSchema);

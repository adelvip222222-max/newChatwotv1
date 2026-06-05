import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const tenantSubscriptionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "BillingPlan", required: false },
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },
    status: { type: String, default: "inactive", index: true },
    currentPeriodEnd: { type: Date, required: false },
    monthlyMessageLimit: { type: Number, default: 0 },
    usedMessages: { type: Number, default: 0 },
    extraMessageCredits: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export type TenantSubscriptionDocument = InferSchemaType<typeof tenantSubscriptionSchema>;
export const TenantSubscription =
  (models.TenantSubscription as Model<TenantSubscriptionDocument>) ||
  model("TenantSubscription", tenantSubscriptionSchema);

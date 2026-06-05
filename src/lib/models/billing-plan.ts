import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const billingPlanSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    interval: { type: String, enum: ["month", "year"], required: true, index: true },
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: () => process.env.STRIPE_CURRENCY || "usd" },
    aiMessageLimit: { type: Number, required: true, min: 0 },
    stripePriceId: { type: String, default: "" },
    createdByAdmin: { type: Boolean, default: false, index: true },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

billingPlanSchema.index({ tenantId: 1, name: 1, interval: 1 }, { unique: true });

export type BillingPlanDocument = InferSchemaType<typeof billingPlanSchema>;
export const BillingPlan =
  (models.BillingPlan as Model<BillingPlanDocument>) || model("BillingPlan", billingPlanSchema);

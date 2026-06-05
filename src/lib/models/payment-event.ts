import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const paymentEventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    type: { type: String, required: true, index: true },
    stripeEventId: { type: String, required: true, unique: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["received", "processed", "error"], default: "received" },
    error: { type: String, default: "" }
  },
  { timestamps: true }
);

export type PaymentEventDocument = InferSchemaType<typeof paymentEventSchema>;
export const PaymentEvent =
  (models.PaymentEvent as Model<PaymentEventDocument>) || model("PaymentEvent", paymentEventSchema);

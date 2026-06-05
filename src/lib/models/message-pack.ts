import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const messagePackSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    name: { type: String, required: true, trim: true },
    messageCredits: { type: Number, required: true, min: 1 },
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: () => process.env.STRIPE_CURRENCY || "usd" },
    stripePriceId: { type: String, default: "" },
    createdByAdmin: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

messagePackSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type MessagePackDocument = InferSchemaType<typeof messagePackSchema>;
export const MessagePack =
  (models.MessagePack as Model<MessagePackDocument>) || model("MessagePack", messagePackSchema);

import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const contactSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    company: { type: String },
    country: { type: String, default: "" },
    lifecycleStage: { type: String, default: "lead", index: true },
    totalOrders: { type: Number, default: 0 },
    customerValue: { type: Number, default: 0 },
    customAttributes: { type: Schema.Types.Mixed, default: {} },
    tags: [{ type: String }],
    notes: { type: String },
    lastSeenAt: { type: Date, index: true },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

contactSchema.index({ tenantId: 1, email: 1 });
contactSchema.index({ tenantId: 1, phone: 1 });
contactSchema.index({ tenantId: 1, lastSeenAt: -1 });
contactSchema.index({ tenantId: 1, name: "text", email: "text", phone: "text", company: "text", tags: "text" });

export type ContactDocument = InferSchemaType<typeof contactSchema>;
export const Contact = (models.Contact as Model<ContactDocument>) || model("Contact", contactSchema);

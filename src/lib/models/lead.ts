import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const leadSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: false, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: false, index: true },
    stage: {
      type: String,
      enum: ["new", "qualified", "proposal", "negotiation", "won", "lost"],
      default: "new",
      index: true
    },
    value: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    sourceChannel: { type: String, default: "" },
    tags: [{ type: String, trim: true }],
    customFields: { type: Schema.Types.Mixed, default: {} },
    dueAt: { type: Date, required: false },
    closedAt: { type: Date, required: false },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    company: { type: String, default: "" },
    interest: { type: String, default: "" },
    notes: { type: String, default: "" },
    score: { type: Number, default: 0 }
  },
  { timestamps: true }
);

leadSchema.index({ tenantId: 1, stage: 1 });
leadSchema.index({ tenantId: 1, contactId: 1 }, { sparse: true });
leadSchema.index({ tenantId: 1, assignedTo: 1 }, { sparse: true });

export type LeadDocument = InferSchemaType<typeof leadSchema>;
export const Lead = (models.Lead as Model<LeadDocument>) || model("Lead", leadSchema);

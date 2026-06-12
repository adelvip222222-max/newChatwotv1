import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const ticketSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: false, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: false, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: false, index: true },
    number: { type: Number, required: false, index: true },
    subject: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["open", "in_progress", "pending", "resolved", "closed"],
      default: "open",
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true
    },
    category: { type: String, default: "", index: true },
    requesterExternalId: { type: String, default: "", index: true },
    channel: { type: String, default: "", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: false, index: true },
    dueAt: { type: Date, required: false },
    resolvedAt: { type: Date, required: false },
    slaBreached: { type: Boolean, default: false, index: true },
    source: { type: String, enum: ["ai", "agent", "system"], default: "ai" },
    triggerReason: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    tags: [{ type: String, trim: true }],
    customFields: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

ticketSchema.index({ tenantId: 1, status: 1 });
ticketSchema.index({ tenantId: 1, priority: 1 });
ticketSchema.index({ tenantId: 1, conversationId: 1 }, { sparse: true });
ticketSchema.index({ tenantId: 1, number: 1 }, { unique: true, sparse: true });
ticketSchema.index({ tenantId: 1, assignedTo: 1 }, { sparse: true });
ticketSchema.index({ tenantId: 1, slaBreached: 1 });

export type TicketDocument = InferSchemaType<typeof ticketSchema>;
export const Ticket = (models.Ticket as Model<TicketDocument>) || model("Ticket", ticketSchema);

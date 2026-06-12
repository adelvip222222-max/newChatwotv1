import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

export const ticketStatuses = ["open", "pending", "resolved", "closed"] as const;
export const ticketPriorities = ["low", "medium", "high", "urgent"] as const;
export const ticketCategories = [
  "technical_support",
  "complaint",
  "human_request",
  "ai_failed",
  "general",
] as const;

const ticketSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    number: { type: Number, required: true, index: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ticketStatuses, default: "open", index: true },
    priority: { type: String, enum: ticketPriorities, default: "medium", index: true },
    category: { type: String, enum: ticketCategories, default: "general", index: true },
    requesterExternalId: { type: String, required: true, index: true },
    channel: { type: String, required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: false },
    source: { type: String, enum: ["ai", "agent", "system"], default: "ai" },
    triggerReason: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ticketSchema.index({ tenantId: 1, number: 1 }, { unique: true });
ticketSchema.index({ tenantId: 1, conversationId: 1, status: 1 });

export type TicketDocument = InferSchemaType<typeof ticketSchema>;
export const Ticket =
  (models.Ticket as Model<TicketDocument>) || model("Ticket", ticketSchema);


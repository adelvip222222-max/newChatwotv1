import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const conversationNoteSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    visibility: {
      type: String,
      enum: ["internal", "team"],
      default: "internal",
      index: true
    },
    content: { type: String, required: true, trim: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

conversationNoteSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
conversationNoteSchema.index({ tenantId: 1, mentions: 1, createdAt: -1 });
conversationNoteSchema.index({ tenantId: 1, content: "text" });

export type ConversationNoteDocument = InferSchemaType<typeof conversationNoteSchema>;
export const ConversationNote =
  (models.ConversationNote as Model<ConversationNoteDocument>) ||
  model("ConversationNote", conversationNoteSchema);

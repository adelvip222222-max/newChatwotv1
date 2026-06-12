import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const aiPersonaSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    personaType: { type: String, default: "general", index: true },
    roleName: { type: String, required: true, trim: true }, // e.g., "Sales", "Support", "Receptionist"
    description: { type: String, default: "" },
    aiModelId: { type: Schema.Types.ObjectId, ref: "AiModel", required: false },
    systemPrompt: { type: String, required: true },
    greetingMessage: { type: String, required: true },
    maxTurns: { type: Number, default: 5 },
    tone: { type: String, default: "professional" },
    responseStyle: { type: String, default: "balanced" },
    knowledgeMode: { type: String, default: "grounded" },
    handoffPolicy: { type: String, default: "when_needed" },
    channelScope: [{ type: String }],
    allowedTools: [{ type: String }], // Array of tool names from the registry
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

aiPersonaSchema.index({ tenantId: 1, isActive: 1 });

export type AiPersonaDocument = InferSchemaType<typeof aiPersonaSchema>;
export const AiPersona = (models.AiPersona as Model<AiPersonaDocument>) || model("AiPersona", aiPersonaSchema);

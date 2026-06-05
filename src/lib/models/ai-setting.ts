import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/strings";

const aiSettingSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    aiModelId: { type: Schema.Types.ObjectId, ref: "AiModel", required: false },
    provider: { type: String, default: "openai" },
    apiKey: { type: String, default: "" },
    model: { type: String, default: () => process.env.DEFAULT_AI_MODEL || "gpt-4o-mini" },
    systemPrompt: { type: String, default: DEFAULT_SYSTEM_PROMPT },
    temperature: { type: Number, default: 0.4, min: 0, max: 2 },
    language: { type: String, default: "auto" },
    role: { type: String, default: "assistant" },
    tone: { type: String, default: "neutral" },
    responseLength: { type: String, default: "medium" },
    fallbackMessage: { type: String, default: "عذراً، لم أفهم طلبك جيداً. هل يمكنك التوضيح؟" },
    useEmojis: { type: Boolean, default: true },
    isEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

aiSettingSchema.index({ tenantId: 1, botId: 1 }, { unique: true });

export type AiSettingDocument = InferSchemaType<typeof aiSettingSchema>;
export const AiSetting =
  (models.AiSetting as Model<AiSettingDocument>) || model("AiSetting", aiSettingSchema);

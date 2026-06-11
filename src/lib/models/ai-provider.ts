import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const aiProviderSchema = new Schema(
  {
    providerId: {
      type: String,
      enum: ["openai", "anthropic", "gemini", "openrouter", "deepseek", "xai", "groq", "ollama"],
      required: true,
      unique: true,
      index: true
    },
    name: { type: String, required: true },
    apiKeyEncrypted: { type: String, default: "" },
    baseUrl: { type: String, default: "" }, // Used for Ollama or custom endpoints
    priority: { type: Number, default: 0 }, // Lower number = higher priority
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export type AiProviderDocument = InferSchemaType<typeof aiProviderSchema>;
export const AiProvider = (models.AiProvider as Model<AiProviderDocument>) || model("AiProvider", aiProviderSchema);

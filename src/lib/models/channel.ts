import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const channelSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: true, index: true },
    type: {
      type: String,
      enum: ["website", "telegram", "whatsapp", "facebook", "webhook"],
      required: true,
      index: true
    },
    name: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

channelSchema.index({ tenantId: 1, botId: 1, type: 1 }, { unique: true });

export type ChannelDocument = InferSchemaType<typeof channelSchema>;
export const Channel = (models.Channel as Model<ChannelDocument>) || model("Channel", channelSchema);

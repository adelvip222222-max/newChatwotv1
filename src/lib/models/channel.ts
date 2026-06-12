import { Schema, models, model, type InferSchemaType, type Model, Types } from "mongoose";

const channelSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    botId: { type: Schema.Types.ObjectId, ref: "Bot", required: false, index: true },
    type: {
      type: String,
      enum: ["website", "telegram", "whatsapp", "facebook", "instagram", "email", "api", "webhook"],
      required: true,
      index: true
    },
    name: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

channelSchema.index({ tenantId: 1, botId: 1, type: 1 });

// Provider-specific unique constraints — allows N channels of same type per bot
// but prevents duplicate external accounts from being registered twice.
channelSchema.index(
  { tenantId: 1, "config.pageId": 1 },
  { unique: true, sparse: true, name: "unique_facebook_page" }
);
channelSchema.index(
  { tenantId: 1, "config.instagramBusinessId": 1 },
  { unique: true, sparse: true, name: "unique_instagram_account" }
);
channelSchema.index(
  { tenantId: 1, "config.phoneNumberId": 1 },
  { unique: true, sparse: true, name: "unique_whatsapp_number" }
);
channelSchema.index(
  { tenantId: 1, "config.externalChannelId": 1 },
  { unique: true, sparse: true, name: "unique_widget_channel" }
);
channelSchema.index(
  { tenantId: 1, "config.botToken": 1 },
  { unique: true, sparse: true, name: "unique_telegram_bot" }
);

export type ChannelDocument = InferSchemaType<typeof channelSchema> & { _id: Types.ObjectId };
export const Channel = (models.Channel as Model<ChannelDocument>) || model("Channel", channelSchema);

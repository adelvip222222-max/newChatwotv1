import { Schema, models, model, type InferSchemaType, type Model, Types } from "mongoose";

const channelIdentitySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: "Channel", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", required: true, index: true },
    provider: { type: String, required: true },
    externalUserId: { type: String, required: true },
    externalThreadId: { type: String },
    displayName: { type: String },
    username: { type: String },
    profileUrl: { type: String },
    avatarUrl: { type: String },
    locale: { type: String },
    timezone: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    lastSeenAt: { type: Date },
    isBlocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

channelIdentitySchema.index({ tenantId: 1, channelId: 1, provider: 1, externalUserId: 1 }, { unique: true });
channelIdentitySchema.index({ tenantId: 1, provider: 1 });
channelIdentitySchema.index({ tenantId: 1, lastSeenAt: -1 });

export type ChannelIdentityDocument = InferSchemaType<typeof channelIdentitySchema> & { _id: Types.ObjectId };
export const ChannelIdentity = (models.ChannelIdentity as Model<ChannelIdentityDocument>) || model("ChannelIdentity", channelIdentitySchema);

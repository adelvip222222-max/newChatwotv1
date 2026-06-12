import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const teamSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "" },
    color: { type: String, default: "slate" },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    routingKeywords: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

teamSchema.index({ tenantId: 1, name: 1 }, { unique: true });
teamSchema.index({ tenantId: 1, isActive: 1, name: 1 });

export type TeamDocument = InferSchemaType<typeof teamSchema>;
export const Team = (models.Team as Model<TeamDocument>) || model("Team", teamSchema);

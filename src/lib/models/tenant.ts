import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, default: "free" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export type TenantDocument = InferSchemaType<typeof tenantSchema>;
export const Tenant = (models.Tenant as Model<TenantDocument>) || model("Tenant", tenantSchema);

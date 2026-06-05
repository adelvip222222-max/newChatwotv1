import { Schema, models, model, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["owner", "admin", "agent"], default: "owner" },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = (models.User as Model<UserDocument>) || model("User", userSchema);

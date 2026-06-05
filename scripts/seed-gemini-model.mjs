/**
 * scripts/seed-gemini-model.mjs
 * Creates a Gemini 2.0 Flash AI model for the demo tenant.
 * Run: node scripts/seed-gemini-model.mjs
 */

import mongoose from "mongoose";
import crypto from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Load .env ────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (key && !process.env[key]) process.env[key] = value;
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error("❌ MONGODB_URI not set"); process.exit(1); }

// ─── Encrypt helper (mirrors crypto.ts) ───────────────────────────
const PREFIX = "enc:v1";

function getKey() {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AI_KEY_ENCRYPTION_SECRET not set");
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

// ─── Schemas ───────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({ email: String, tenantId: mongoose.Schema.Types.ObjectId });
const aiModelSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  name: String, provider: String, model: String,
  apiKeyEncrypted: String, baseUrl: String,
  isDefault: Boolean, isActive: Boolean,
}, { timestamps: true });
aiModelSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const User    = mongoose.models?.User    || mongoose.model("User",    userSchema);
const AiModel = mongoose.models?.AiModel || mongoose.model("AiModel", aiModelSchema);

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: "chatzi", bufferCommands: false });
  console.log("✅  Connected\n");

  const user = await User.findOne({ email: "demo@chatzi.ai" });
  if (!user) { console.error("❌ demo@chatzi.ai not found. Run seed-demo.mjs first."); process.exit(1); }

  const GEMINI_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) { console.error("❌ GOOGLE_AI_API_KEY not found in .env"); process.exit(1); }

  const existing = await AiModel.findOne({ tenantId: user.tenantId, name: "Gemini 2.0 Flash" });
  if (existing) {
    console.log("ℹ️  Gemini model already exists for this tenant.");
    process.exit(0);
  }

  // Set all others as non-default first
  await AiModel.updateMany({ tenantId: user.tenantId }, { $set: { isDefault: false } });

  const model = await AiModel.create({
    tenantId:        user.tenantId,
    name:            "Gemini 2.0 Flash",
    provider:        "google-gemini",
    model:           "gemini-2.0-flash",
    apiKeyEncrypted: encryptSecret(GEMINI_KEY),
    baseUrl:         "",
    isDefault:       true,
    isActive:        true,
  });

  console.log("✅  Gemini model created!");
  console.log("┌─────────────────────────────────────────┐");
  console.log("│         GEMINI MODEL READY              │");
  console.log("├─────────────────────────────────────────┤");
  console.log(`│  Name     : Gemini 2.0 Flash             │`);
  console.log(`│  Provider : google-gemini                │`);
  console.log(`│  Model ID : gemini-2.0-flash             │`);
  console.log(`│  ModelID  : ${model._id.toString().padEnd(28)} │`);
  console.log(`│  Default  : ✅ Yes                        │`);
  console.log(`│  API Key  : 🔐 Encrypted in DB            │`);
  console.log("└─────────────────────────────────────────┘");
  console.log("\n🚀  Test it at: http://localhost:3000/preview");
  process.exit(0);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });

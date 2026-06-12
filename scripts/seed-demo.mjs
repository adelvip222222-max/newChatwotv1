/**
 * scripts/seed-demo.mjs
 * ─────────────────────────────────────────────────────────────
 * Creates a demo owner account + tenant + default bot.
 * Run with: node scripts/seed-demo.mjs
 *
 * Credentials are read from DEMO_EMAIL and DEMO_PASSWORD.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Load .env manually ────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key   = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (key && !process.env[key]) process.env[key] = value;
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not set in .env");
  process.exit(1);
}

// ─── Minimal Schemas (mirror src/lib/models) ───────────────────
const tenantSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    slug:     { type: String, required: true, unique: true },
    ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    plan:     { type: String, default: "free" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["owner", "admin", "agent"], default: "owner" },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const botSchema = new mongoose.Schema(
  {
    tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    name:        { type: String, required: true },
    avatar:      { type: String, default: "" },
    description: { type: String, default: "" },
    isActive:    { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Tenant = mongoose.models?.Tenant || mongoose.model("Tenant", tenantSchema);
const User   = mongoose.models?.User   || mongoose.model("User",   userSchema);
const Bot    = mongoose.models?.Bot    || mongoose.model("Bot",    botSchema);

// ─── Demo credentials ──────────────────────────────────────────
const DEMO_EMAIL    = process.env.DEMO_EMAIL || "demo@chatzi.local";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || `Demo-${Date.now()}!`;
const DEMO_NAME     = "ChatZi Demo";
const DEMO_TENANT   = "ChatZi Demo";

async function main() {
  console.log("🔌  Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI, { dbName: "chatzi", bufferCommands: false });
  console.log("✅  Connected\n");

  // ── Check existing ──────────────────────────────────────────
  const existingUser = await User.findOne({ email: DEMO_EMAIL });
  if (existingUser) {
    const bot = await Bot.findOne({ tenantId: existingUser.tenantId });
    console.log("ℹ️   Demo user already exists!\n");
    console.log("┌─────────────────────────────────────────┐");
    console.log("│          DEMO ACCOUNT (EXISTING)        │");
    console.log("├─────────────────────────────────────────┤");
    console.log(`│  Email    : ${DEMO_EMAIL.padEnd(28)} │`);
    console.log(`│  Password : ${DEMO_PASSWORD.padEnd(28)} │`);
    console.log(`│  TenantID : ${existingUser.tenantId?.toString()?.slice(0,28) || "—"} │`);
    console.log(`│  BotID    : ${(bot?._id?.toString() || "—").padEnd(28)} │`);
    console.log("└─────────────────────────────────────────┘");
    process.exit(0);
  }

  // ── Create User ──────────────────────────────────────────────
  console.log("👤  Creating demo user…");
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await User.create({
    name:     DEMO_NAME,
    email:    DEMO_EMAIL,
    password: hashedPassword,
    role:     "owner"
  });

  // ── Create Tenant ────────────────────────────────────────────
  console.log("🏢  Creating tenant…");
  const tenant = await Tenant.create({
    name:     DEMO_TENANT,
    slug:     `chatzi-demo-${user._id.toString().slice(-5)}`,
    ownerId:  user._id,
    plan:     "free",
    isActive: true
  });

  // ── Link user to tenant ──────────────────────────────────────
  user.tenantId = tenant._id;
  user.ownerId  = user._id;
  await user.save();

  // ── Create default Bot ───────────────────────────────────────
  console.log("🤖  Creating default bot…");
  const bot = await Bot.create({
    tenantId:    tenant._id,
    name:        "مساعد ChatZi",
    avatar:      "",
    description: "البوت الافتراضي للمحادثات. يمكنك تغذيته من صفحة قاعدة المعرفة.",
    isActive:    true
  });

  // ── Done ─────────────────────────────────────────────────────
  console.log("\n✅  Demo account created!\n");
  console.log("┌─────────────────────────────────────────┐");
  console.log("│            DEMO ACCOUNT READY           │");
  console.log("├─────────────────────────────────────────┤");
  console.log(`│  Email    : ${DEMO_EMAIL.padEnd(28)} │`);
  console.log(`│  Password : ${DEMO_PASSWORD.padEnd(28)} │`);
  console.log(`│  TenantID : ${tenant._id.toString().padEnd(28)} │`);
  console.log(`│  BotID    : ${bot._id.toString().padEnd(28)} │`);
  console.log("├─────────────────────────────────────────┤");
  console.log("│  Login at  : http://localhost:3000/login │");
  console.log("│  Preview   : http://localhost:3000/preview│");
  console.log("└─────────────────────────────────────────┘");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});

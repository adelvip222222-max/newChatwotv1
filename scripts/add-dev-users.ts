import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// تحميل المتغيرات البيئية بدون مكتبة dotenv (لتجنب خطأ Module Not Found)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

// تعريف الـ Schemas الأساسية بشكل مبسط للسكريبت
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "owner" },
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  isActive: { type: Boolean, default: true },
});

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  plan: { type: String, default: "free" },
  isActive: { type: Boolean, default: true },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Tenant = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);

async function run() {
  try {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    let tenant = await Tenant.findOne();
    if (!tenant) {
      tenant = await Tenant.create({
        name: "Dev Tenant",
        slug: "dev-tenant-" + Date.now(),
        plan: "free",
        isActive: true,
      });
      console.log("Created dummy tenant:", tenant._id);
    }

    const passwordPlain = "Dev123!@#Secure";
    const hashedPassword = await bcrypt.hash(passwordPlain, 12);

    // حذف المستخدمين إذا كانوا موجودين مسبقاً لتجنب مشكلة الـ Duplicate
    await User.deleteOne({ email: "dev1@chatzi.com" });
    await User.deleteOne({ email: "dev2@chatzi.com" });

    const u1 = await User.create({
      name: "Developer One",
      email: "dev1@chatzi.com",
      password: hashedPassword,
      role: "owner",
      tenantId: tenant._id,
      isActive: true,
    });

    const u2 = await User.create({
      name: "Developer Two",
      email: "dev2@chatzi.com",
      password: hashedPassword,
      role: "admin",
      tenantId: tenant._id,
      isActive: true,
    });

    console.log("\n=========================================");
    console.log("✅ USERS CREATED SUCCESSFULLY");
    console.log("=========================================");
    console.log(`User 1: ${u1.email}`);
    console.log(`Password 1: ${passwordPlain}`);
    console.log(`Role: ${u1.role}`);
    console.log("-----------------------------------------");
    console.log(`User 2: ${u2.email}`);
    console.log(`Password 2: ${passwordPlain}`);
    console.log(`Role: ${u2.role}`);
    console.log("=========================================\n");

  } catch (error) {
    console.error("Error creating users:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();

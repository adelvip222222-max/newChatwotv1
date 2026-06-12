import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./src/lib/models/user";
import { Tenant } from "./src/lib/models/tenant";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin:SaLrbaZ7kV9DOcMP@cluster0.es4k5rg.mongodb.net/ChatZi"

async function connectToDatabase() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is required.");
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(MONGODB_URI);
}

async function createUsers() {
  try {
    await connectToDatabase();
    console.log("✅ متصل بقاعدة البيانات...");

    // Create a new tenant
    const tenantId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    const tenant = await Tenant.create({
      _id: tenantId,
      name: "الشركة التجريبية",
      slug: `demo-company-${Date.now()}`,
      ownerId: ownerId,
      plan: "free",
      isActive: true,
    });
    console.log("✅ تم إنشاء المستأجر (الشركة):", tenant.name);

    const passwordHash = await bcrypt.hash("12345678", 12);

    // Create Owner
    const owner = await User.create({
      _id: ownerId,
      name: "مدير النظام (Owner)",
      email: "owner@chatzi.local",
      password: passwordHash,
      role: "owner",
      tenantId: tenant._id,
      ownerId: ownerId,
      isActive: true,
    });
    console.log(`✅ تم إنشاء المستخدم (Owner): ${owner.email} | كلمة المرور: 12345678`);

    // Create Admin in the same tenant
    const admin = await User.create({
      name: "مشرف (Admin)",
      email: "admin@chatzi.local",
      password: passwordHash,
      role: "admin",
      tenantId: tenant._id,
      ownerId: ownerId, // references the owner
      isActive: true,
    });
    console.log(`✅ تم إنشاء المستخدم (Admin): ${admin.email} | كلمة المرور: 12345678`);

    console.log("🎉 تمت العملية بنجاح! يمكنك الآن تسجيل الدخول.");
    process.exit(0);
  } catch (error) {
    console.error("❌ حدث خطأ:", error);
    process.exit(1);
  }
}

createUsers();

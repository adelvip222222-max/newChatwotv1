import mongoose from "mongoose";
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

// تعريف مخطط خطط الدفع (BillingPlan)
const billingPlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: false },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  interval: { type: String, enum: ["month", "year"], required: true },
  priceCents: { type: Number, required: true },
  currency: { type: String, default: "usd" },
  aiMessageLimit: { type: Number, required: true },
  stripePriceId: { type: String, default: "" },
  createdByAdmin: { type: Boolean, default: true },
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
});

const BillingPlan = mongoose.models.BillingPlan || mongoose.model("BillingPlan", billingPlanSchema);

async function run() {
  try {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // تفريغ الخطط القديمة لتجنب التكرار
    await BillingPlan.deleteMany({ createdByAdmin: true });
    console.log("Cleared old admin billing plans.");

    const plans = [
      {
        name: "Free",
        description: "الخطة المجانية لبدء الاستخدام والتجربة",
        interval: "month",
        priceCents: 0,
        aiMessageLimit: 100,
        createdByAdmin: true,
        isPopular: false,
      },
      {
        name: "Starter",
        description: "مثالية للمشاريع الصغيرة والشركات الناشئة",
        interval: "month",
        priceCents: 999, // 9.99$
        aiMessageLimit: 1000,
        createdByAdmin: true,
        isPopular: false,
      },
      {
        name: "Pro",
        description: "للشركات المتنامية التي تحتاج ميزات قوية",
        interval: "month",
        priceCents: 2999, // 29.99$
        aiMessageLimit: 5000,
        createdByAdmin: true,
        isPopular: true, // الخطة الأكثر شعبية
      },
      {
        name: "Enterprise",
        description: "للشركات الكبيرة مع دعم غير محدود",
        interval: "month",
        priceCents: 9999, // 99.99$
        aiMessageLimit: 20000,
        createdByAdmin: true,
        isPopular: false,
      }
    ];

    await BillingPlan.insertMany(plans);

    console.log("\n=========================================");
    console.log("✅ BILLING PLANS CREATED SUCCESSFULLY");
    console.log("=========================================");
    plans.forEach(p => {
      console.log(`- ${p.name}: $${p.priceCents / 100}/${p.interval} (${p.aiMessageLimit} Messages)`);
    });
    console.log("=========================================\n");

  } catch (error) {
    console.error("Error creating billing plans:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();

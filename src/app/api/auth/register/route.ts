import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Bot, Tenant, User, BillingPlan, TenantSubscription } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { slugifyArabic } from "@/lib/strings";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(2)
});

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    await connectToDatabase();

    const email = body.email.toLowerCase().trim();
    const exists = await User.exists({ email });
    if (exists) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });
    }

    const password = await bcrypt.hash(body.password, 12);
    const user = await User.create({
      name: body.name,
      email,
      password,
      role: "owner"
    });

    const baseSlug = slugifyArabic(body.tenantName) || `tenant-${user._id.toString().slice(-6)}`;
    const tenant = await Tenant.create({
      name: body.tenantName,
      slug: `${baseSlug}-${user._id.toString().slice(-5)}`,
      ownerId: user._id,
      plan: "free",
      isActive: true
    });

    user.tenantId = tenant._id;
    user.ownerId = user._id;
    await user.save();

    const bot = await Bot.create({
      tenantId: tenant._id,
      name: "بوت ChatZi",
      description: "البوت الافتراضي لمحادثات العملاء. يمكنك تغذيته من صفحة قاعدة المعرفة.",
      isActive: true
    });

    const freePlan = await BillingPlan.findOne({ name: "Free" });
    if (freePlan) {
      await TenantSubscription.create({
        tenantId: tenant._id,
        planId: freePlan._id,
        status: "active",
        monthlyMessageLimit: freePlan.aiMessageLimit,
        usedMessages: 0,
        extraMessageCredits: 0
      });
    }

    return NextResponse.json({ ok: true, botId: bot._id.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء الحساب.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

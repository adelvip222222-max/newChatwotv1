import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Bot, Tenant, User, BillingPlan, TenantSubscription } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { slugifyArabic } from "@/lib/strings";
import { checkRateLimit, getClientIp, parseJsonBody } from "@/lib/api-security";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  password: z.string().min(12).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password must include uppercase, lowercase, and a number."),
  tenantName: z.string().min(2).max(120)
});

function getRegistrationError(error: unknown) {
  if (error instanceof z.ZodError) {
    const passwordIssue = error.issues.find((issue) => issue.path[0] === "password");
    if (passwordIssue) {
      return "Password must be at least 12 characters and include uppercase, lowercase, and a number.";
    }

    const firstIssue = error.issues[0];
    if (firstIssue) return firstIssue.message;
  }

  return error instanceof Error ? error.message : "Unable to create account.";
}

export async function POST(request: Request) {
  try {
    checkRateLimit(`register:${getClientIp(request)}`, { limit: 5, windowMs: 60 * 60_000 });
    const body = await parseJsonBody(request, registerSchema, { maxBytes: 16 * 1024 });
    await connectToDatabase();

    const email = body.email.toLowerCase().trim();
    const userId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const password = await bcrypt.hash(body.password, 12);
    const baseSlug = slugifyArabic(body.tenantName) || `tenant-${userId.toString().slice(-6)}`;

    const tenant = await Tenant.create({
      _id: tenantId,
      name: body.tenantName,
      slug: `${baseSlug}-${userId.toString().slice(-5)}`,
      ownerId: userId,
      plan: "free",
      isActive: true
    });

    const user = await User.create({
      _id: userId,
      name: body.name,
      email,
      password,
      role: "admin",
      tenantId: tenant._id,
      ownerId: userId,
      isActive: true
    });

    const bot = await Bot.create({
      tenantId: tenant._id,
      name: "ChatZi Bot",
      description: "Default customer conversations bot. You can train it from the knowledge base page.",
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

    return NextResponse.json({ ok: true, userId: user._id.toString(), botId: bot._id.toString() });
  } catch (error) {
    const message = getRegistrationError(error);
    console.error("Registration failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

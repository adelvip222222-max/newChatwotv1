import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { AuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { BillingPlan, Bot, Tenant, TenantSubscription, User } from "@/lib/models";
import { slugifyArabic } from "@/lib/strings";
import { checkRateLimit } from "@/lib/rate-limit";
import { logSystemEvent } from "@/lib/system-logger";

function getAuthRequestIp(req?: { headers?: Record<string, string | string[] | undefined> }) {
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwardedFor)) return forwardedFor[0]?.split(",")[0]?.trim() || "unknown";
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  const realIp = req?.headers?.["x-real-ip"];
  if (Array.isArray(realIp)) return realIp[0] || "unknown";
  return realIp || "unknown";
}

async function provisionOAuthUser(nextAuthUser: any, profile: any) {
  const email = String(nextAuthUser.email || profile?.email || "").toLowerCase().trim();
  const name = String(nextAuthUser.name || profile?.name || email.split("@")[0] || "ChatZi User").trim();

  if (!email) return false;
  if (profile && "email_verified" in profile && profile.email_verified === false) return false;

  await connectToDatabase();
  let user = await User.findOne({ email });

  if (user) {
    if (user.isActive === false || !user.tenantId) {
      logSystemEvent({ eventType: "login_failed", email, severity: "warning", details: { reason: "OAuth user inactive or missing tenant" }});
      return false;
    }
    const tenant = await Tenant.findOne({ _id: user.tenantId, isActive: true });
    if (!tenant) return false;

    user.lastLoginAt = new Date();
    await user.save();

    logSystemEvent({ eventType: "login_success", email, userId: user._id.toString(), details: { method: "oauth_google" }});

    nextAuthUser.id = user._id.toString();
    nextAuthUser.name = user.name;
    nextAuthUser.email = user.email;
    nextAuthUser.role = user.role;
    nextAuthUser.tenantId = user.tenantId.toString();
    nextAuthUser.isActive = true;
    nextAuthUser.isSuperAdmin = (user as any).isSuperAdmin === true || user.role === "super-admin";
    return true;
  }

  const userId = new Types.ObjectId();
  const tenantId = new Types.ObjectId();
  const tenantName = `${name}'s Workspace`;
  const baseSlug = slugifyArabic(tenantName) || `tenant-${userId.toString().slice(-6)}`;
  const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

  const tenant = await Tenant.create({
    _id: tenantId,
    name: tenantName,
    slug: `${baseSlug}-${userId.toString().slice(-5)}`,
    ownerId: userId,
    plan: "free",
    isActive: true
  });

  user = await User.create({
    _id: userId,
    name,
    email,
    password,
    role: "admin",
    tenantId: tenant._id,
    ownerId: userId,
    isActive: true,
    lastLoginAt: new Date()
  });

  await Bot.create({
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

  logSystemEvent({ eventType: "login_success", email, userId: user._id.toString(), details: { method: "oauth_google_new" }});

  nextAuthUser.id = user._id.toString();
  nextAuthUser.name = user.name;
  nextAuthUser.email = user.email;
  nextAuthUser.role = user.role;
  nextAuthUser.tenantId = tenant._id.toString();
  nextAuthUser.isActive = true;
  nextAuthUser.isSuperAdmin = user.role === "super-admin";
  return true;
}

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" }
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        const ipAddress = getAuthRequestIp(req);

        if (!email || !password) return null;
        
        try {
          checkRateLimit(`login:${ipAddress}:${email}`, { limit: 10, windowMs: 15 * 60_000 });
        } catch (err) {
          logSystemEvent({ eventType: "rate_limit_exceeded", email, ipAddress, severity: "warning", details: { reason: "Too many login attempts" } });
          throw err;
        }

        await connectToDatabase();
        const user = await User.findOne({ email }).select("+password");
        if (!user?.password || user.isActive === false) {
          logSystemEvent({ eventType: "login_failed", email, ipAddress, severity: "warning", details: { reason: "User not found or inactive" } });
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid || !user.tenantId) {
          logSystemEvent({ eventType: "login_failed", email, ipAddress, severity: "warning", details: { reason: "Invalid credentials" } });
          return null;
        }

        const tenant = await Tenant.findOne({ _id: user.tenantId, isActive: true });
        if (!tenant) return null;

        user.lastLoginAt = new Date();
        await user.save();

        logSystemEvent({ eventType: "login_success", email, userId: user._id.toString(), ipAddress, details: { method: "credentials" } });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId.toString(),
          isActive: true,
          isSuperAdmin: (user as any).isSuperAdmin === true || user.role === "super-admin"
        };
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          })
        ]
      : [])
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;
      if (account.provider === "google") return provisionOAuthUser(user, profile);
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.isActive = user.isActive;
        token.isSuperAdmin = user.isSuperAdmin === true || user.role === "super-admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.isActive = token.isActive;
        session.user.isSuperAdmin = token.isSuperAdmin === true;
      }
      return session;
    }
  }
};

export function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user?.tenantId) {
    throw new Error("تسجيل الدخول مطلوب.");
  }
  return session;
}

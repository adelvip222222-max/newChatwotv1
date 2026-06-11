import { connectToDatabase } from "@/lib/mongodb";
import { Entitlement, TenantSubscription, BillingPlan } from "@/lib/models";
import type { EntitlementKey } from "@/lib/models/entitlement";
import { logger } from "@/lib/logger";

export type { EntitlementKey };

// ─── Default plan entitlements ────────────────────────────────────────────────

const PLAN_DEFAULTS: Record<string, Record<EntitlementKey, number | boolean>> = {
  free: {
    max_channels: 2,
    max_agents: 1,
    max_bots: 1,
    max_team_members: 3,
    monthly_message_limit: 100,
    knowledge_enabled: false,
    advanced_ai_enabled: false,
    instagram_enabled: false,
    whatsapp_enabled: false,
    facebook_enabled: false,
    telegram_enabled: true,
    qdrant_enabled: false,
    api_access_enabled: false,
    white_label_enabled: false
  },
  starter: {
    max_channels: 5,
    max_agents: 5,
    max_bots: 3,
    max_team_members: 10,
    monthly_message_limit: 1000,
    knowledge_enabled: true,
    advanced_ai_enabled: false,
    instagram_enabled: true,
    whatsapp_enabled: true,
    facebook_enabled: true,
    telegram_enabled: true,
    qdrant_enabled: false,
    api_access_enabled: true,
    white_label_enabled: false
  },
  pro: {
    max_channels: 20,
    max_agents: 25,
    max_bots: 10,
    max_team_members: 50,
    monthly_message_limit: 10000,
    knowledge_enabled: true,
    advanced_ai_enabled: true,
    instagram_enabled: true,
    whatsapp_enabled: true,
    facebook_enabled: true,
    telegram_enabled: true,
    qdrant_enabled: true,
    api_access_enabled: true,
    white_label_enabled: false
  },
  enterprise: {
    max_channels: 999,
    max_agents: 999,
    max_bots: 999,
    max_team_members: 999,
    monthly_message_limit: 999999,
    knowledge_enabled: true,
    advanced_ai_enabled: true,
    instagram_enabled: true,
    whatsapp_enabled: true,
    facebook_enabled: true,
    telegram_enabled: true,
    qdrant_enabled: true,
    api_access_enabled: true,
    white_label_enabled: true
  }
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Get the effective value for an entitlement key for a tenant.
 * Priority: tenant-level override > plan-level entitlement > hardcoded default.
 */
export async function getEntitlement(
  tenantId: string,
  key: EntitlementKey
): Promise<number | boolean | null> {
  await connectToDatabase();

  // 1. Check tenant-level override
  const override = await Entitlement.findOne({ tenantId, key }).lean();
  if (override) {
    const expired = override.expiresAt && new Date(override.expiresAt) < new Date();
    if (!expired) {
      return override.limitValue !== undefined ? (override.limitValue as number)
        : (override.boolValue as boolean) ?? null;
    }
  }

  // 2. Fall back to plan-level default
  const subscription = await TenantSubscription.findOne({ tenantId }).lean();
  if (subscription) {
    const planKey = (subscription as any).planId?.toString?.() || "";
    const planName = (subscription as any).plan || "free";
    const defaults = PLAN_DEFAULTS[planName] || PLAN_DEFAULTS.free;
    if (key in defaults) return defaults[key];
  }

  // 3. Hardcoded safe default
  return PLAN_DEFAULTS.free[key] ?? null;
}

/**
 * Check a numeric limit entitlement.
 * Returns { allowed: boolean, current: number, limit: number }
 */
export async function checkNumericEntitlement(
  tenantId: string,
  key: EntitlementKey,
  currentCount: number
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limit = (await getEntitlement(tenantId, key)) as number;
  const effectiveLimit = typeof limit === "number" ? limit : 0;
  return {
    allowed: currentCount < effectiveLimit,
    current: currentCount,
    limit: effectiveLimit
  };
}

/**
 * Check a boolean feature entitlement.
 */
export async function checkBoolEntitlement(
  tenantId: string,
  key: EntitlementKey
): Promise<boolean> {
  const val = await getEntitlement(tenantId, key);
  return val === true;
}

/**
 * Assert an entitlement — throws an error if not allowed.
 * Use before channel/agent/bot creation.
 */
export async function assertEntitlement(
  tenantId: string,
  key: EntitlementKey,
  currentCount?: number
): Promise<void> {
  const val = await getEntitlement(tenantId, key);

  if (typeof val === "boolean") {
    if (!val) throw new Error(`Feature "${key}" is not available on your current plan.`);
    return;
  }

  if (typeof val === "number" && currentCount !== undefined) {
    if (currentCount >= val) {
      throw new Error(
        `Limit reached: "${key}" allows ${val} on your current plan. Current: ${currentCount}.`
      );
    }
  }
}

/**
 * Seed default entitlements for a tenant when they subscribe to a plan.
 */
export async function seedEntitlementsForPlan(
  tenantId: string,
  planName: string,
  planId?: string
): Promise<void> {
  await connectToDatabase();
  const defaults = PLAN_DEFAULTS[planName] || PLAN_DEFAULTS.free;

  const ops = Object.entries(defaults).map(([key, value]) => ({
    updateOne: {
      filter: { tenantId, key, isOverride: { $ne: true } },
      update: {
        $set: {
          tenantId,
          key,
          ...(typeof value === "number" ? { limitValue: value } : { boolValue: value }),
          ...(planId && { planId }),
          isOverride: false
        }
      },
      upsert: true
    }
  }));

  await Entitlement.bulkWrite(ops as any[]);
  logger.info("entitlements.seeded", { tenantId, planName });
}

/**
 * Set a tenant-level override (admin use).
 */
export async function setEntitlementOverride(
  tenantId: string,
  key: EntitlementKey,
  value: number | boolean,
  expiresAt?: Date
): Promise<void> {
  await connectToDatabase();
  await Entitlement.findOneAndUpdate(
    { tenantId, key },
    {
      $set: {
        tenantId,
        key,
        ...(typeof value === "number" ? { limitValue: value } : { boolValue: value }),
        isOverride: true,
        ...(expiresAt && { expiresAt })
      }
    },
    { upsert: true }
  );
}

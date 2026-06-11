import { redis } from "@/lib/redis";
import { connectToDatabase } from "@/lib/mongodb";
import { TenantSubscription } from "@/lib/models";
import { logger } from "@/lib/logger";

const QUOTA_KEY_PREFIX = "quota:ai_messages";
const MONGO_SYNC_EVERY = 10;

export function quotaRedisKey(tenantId: string): string {
  const now = new Date();
  const yyyyMM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${QUOTA_KEY_PREFIX}:${tenantId}:${yyyyMM}`;
}

function secondsUntilEndOfMonth(): number {
  const now = new Date();
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return Math.max(60, Math.floor((endOfMonth.getTime() - now.getTime()) / 1000));
}

async function getSubscriptionLimit(tenantId: string): Promise<{ limit: number; usedMessages: number } | null> {
  await connectToDatabase();
  const subscription = await TenantSubscription.findOne({ tenantId }).lean();
  if (!subscription) return null;
  const limit = (subscription.monthlyMessageLimit ?? 0) + (subscription.extraMessageCredits ?? 0);
  return { limit, usedMessages: subscription.usedMessages ?? 0 };
}

async function syncRedisCounterToMongo(tenantId: string, redisCount: number): Promise<void> {
  try {
    await connectToDatabase();
    await TenantSubscription.updateOne(
      { tenantId },
      { $set: { usedMessages: redisCount } }
    );
  } catch (err) {
    logger.warn("quota.mongo_sync_failed", {
      tenantId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Atomically assert and reserve a quota slot using Redis INCR.
 *
 * Design decisions:
 * - Redis key: quota:ai_messages:{tenantId}:{YYYY-MM} — monthly, per-tenant, isolated.
 * - On first use each month: SET NX (initialize from MongoDB usedMessages) + EXPIRE.
 * - INCR then compare against limit; if exceeded: DECR + throw.
 * - MongoDB sync: every MONGO_SYNC_EVERY increments (fire-and-forget).
 * - Redis down + free plan (limit ≤ 200): fail closed (use MongoDB fallback).
 * - Redis down + paid plan: fail open with warning log.
 *
 * Caller should NOT also call recordAiMessageUsage() when using this function —
 * the increment is embedded here. Use the legacy billing.ts functions only on the
 * old code path that hasn't migrated to quota.ts yet.
 */
export async function assertAndReserveQuota(tenantId: string): Promise<void> {
  const sub = await getSubscriptionLimit(tenantId);
  if (!sub) return;
  if (sub.limit <= 0) return;

  const key = quotaRedisKey(tenantId);
  const ttl = secondsUntilEndOfMonth();

  try {
    await redis.set(key, String(sub.usedMessages), "EX", ttl, "NX");

    const newCount = await redis.incr(key);

    if (newCount > sub.limit) {
      await redis.decr(key);
      throw new Error("تم استهلاك رصيد رسائل AI لهذه الخطة. اشتر باقة رسائل إضافية أو غيّر الخطة.");
    }

    if (newCount % MONGO_SYNC_EVERY === 0) {
      void syncRedisCounterToMongo(tenantId, newCount);
    }
  } catch (error) {
    const isQuotaError = error instanceof Error && error.message.includes("رصيد");
    if (isQuotaError) throw error;

    logger.warn("quota.redis_unavailable_fallback", {
      tenantId,
      error: error instanceof Error ? error.message : "unknown",
    });

    // Fail closed for free/limited plans (limit <= 200 messages)
    if (sub.limit <= 200) {
      if (sub.usedMessages >= sub.limit) {
        throw new Error("تم استهلاك رصيد رسائل AI لهذه الخطة. اشتر باقة رسائل إضافية أو غيّر الخطة.");
      }
    } else {
      // Paid plans: fail open — log and allow the request
      logger.error("quota.redis_down_paid_plan_allowed", {
        tenantId,
        mongoUsed: sub.usedMessages,
        limit: sub.limit,
      });
    }
  }
}

export async function getQuotaStatus(tenantId: string): Promise<{
  used: number;
  limit: number;
  redisCount: number;
  source: "redis" | "mongo";
}> {
  const sub = await getSubscriptionLimit(tenantId);
  const key = quotaRedisKey(tenantId);

  let redisCount = 0;
  try {
    const val = await redis.get(key);
    redisCount = val ? parseInt(val, 10) : 0;
  } catch {
    // Redis unavailable
  }

  return {
    used: sub?.usedMessages ?? 0,
    limit: sub?.limit ?? 0,
    redisCount,
    source: redisCount > 0 ? "redis" : "mongo",
  };
}

/**
 * Flush Redis counter to MongoDB immediately (e.g. on billing period end or admin sync).
 */
export async function flushQuotaToMongo(tenantId: string): Promise<void> {
  const key = quotaRedisKey(tenantId);
  try {
    const val = await redis.get(key);
    if (val !== null) {
      await syncRedisCounterToMongo(tenantId, parseInt(val, 10));
    }
  } catch (err) {
    logger.warn("quota.flush_failed", {
      tenantId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

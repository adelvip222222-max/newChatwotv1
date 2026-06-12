import { createRedisConnection } from "@/lib/redis-connection";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { normalizeRealtimeEventType } from "./events";
import type { AnyRealtimeEventType, RealtimeEnvelope, RealtimeEventType } from "./types";

const EVENT_ID_RANDOM_BASE = 36;

export function tenantRealtimeChannel(tenantId: string): string {
  return `inbox:${tenantId}:events`;
}

export function createRealtimeEvent<TPayload>(
  type: AnyRealtimeEventType,
  payload: TPayload
): RealtimeEnvelope<TPayload> {
  return {
    id: `${Date.now()}-${Math.random().toString(EVENT_ID_RANDOM_BASE).slice(2, 10)}`,
    type: normalizeRealtimeEventType(type),
    payload,
    ts: new Date().toISOString(),
  };
}

export async function publishTenantEvent<TPayload>(
  tenantId: string,
  type: AnyRealtimeEventType,
  payload: TPayload
): Promise<void> {
  if (!tenantId) return;
  const event = createRealtimeEvent(type, payload);

  try {
    await redis.publish(tenantRealtimeChannel(tenantId), JSON.stringify(event));
  } catch (error) {
    logger.warn("realtime.publish_failed", {
      tenantId,
      type: event.type,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function publishManyTenantEvents<TPayload>(
  tenantId: string,
  events: Array<{ type: RealtimeEventType | AnyRealtimeEventType; payload: TPayload }>
): Promise<void> {
  await Promise.all(events.map((event) => publishTenantEvent(tenantId, event.type, event.payload)));
}

export function createTenantSubscriber() {
  return createRedisConnection("chatzi-sse-sub", { failFast: false });
}

export async function isRealtimeAvailable(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

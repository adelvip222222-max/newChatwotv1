import { logger } from "./logger";
import { normalizeRealtimeEventType } from "./realtime/events";
import {
  createTenantSubscriber,
  isRealtimeAvailable,
  publishTenantEvent,
  tenantRealtimeChannel,
} from "./realtime/publisher";
import type {
  AnyRealtimeEventType,
  LegacyRealtimeEventType,
  RealtimeEnvelope,
  RealtimeEventType,
} from "./realtime/types";

export type { AnyRealtimeEventType, LegacyRealtimeEventType, RealtimeEnvelope, RealtimeEventType };
export { createTenantSubscriber, isRealtimeAvailable, normalizeRealtimeEventType, publishTenantEvent, tenantRealtimeChannel };

/**
 * Backward-compatible publisher used by older workers/services.
 * Legacy event names are normalized before publishing:
 * message -> message.created, conversation -> conversation.updated,
 * assignment -> conversation.assigned, delivery -> delivery.updated,
 * inbox -> inbox.snapshot.
 */
export async function publishRealtimeEvent(
  tenantId: string,
  type: AnyRealtimeEventType,
  data: unknown
): Promise<void> {
  try {
    await publishTenantEvent(tenantId, type, data);
  } catch (error) {
    logger.warn("realtime.compat_publish_failed", {
      tenantId,
      type,
      normalizedType: normalizeRealtimeEventType(type),
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

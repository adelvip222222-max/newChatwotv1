import type { AnyRealtimeEventType, RealtimeEventType } from "./types";

export const REALTIME_EVENTS = {
  MESSAGE_CREATED: "message.created",
  MESSAGE_UPDATED: "message.updated",
  CONVERSATION_UPDATED: "conversation.updated",
  CONVERSATION_ASSIGNED: "conversation.assigned",
  CONVERSATION_DELETED: "conversation.deleted",
  NOTIFICATION_CREATED: "notification.created",
  DELIVERY_UPDATED: "delivery.updated",
  INBOX_SNAPSHOT: "inbox.snapshot",
  HEARTBEAT: "heartbeat",
  READY: "ready",
  SYNC_REQUIRED: "sync.required",
  ERROR: "error",
} as const satisfies Record<string, RealtimeEventType>;

const legacyAliases: Partial<Record<AnyRealtimeEventType, RealtimeEventType>> = {
  inbox: REALTIME_EVENTS.INBOX_SNAPSHOT,
  message: REALTIME_EVENTS.MESSAGE_CREATED,
  conversation: REALTIME_EVENTS.CONVERSATION_UPDATED,
  assignment: REALTIME_EVENTS.CONVERSATION_ASSIGNED,
  delivery: REALTIME_EVENTS.DELIVERY_UPDATED,
};

export function normalizeRealtimeEventType(type: AnyRealtimeEventType): RealtimeEventType {
  return legacyAliases[type] || (type as RealtimeEventType);
}

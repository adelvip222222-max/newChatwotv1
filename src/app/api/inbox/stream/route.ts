import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";
import { getInboxRealtimeSnapshot } from "@/lib/inbox/service";
import {
  createTenantSubscriber,
  isRealtimeAvailable,
  normalizeRealtimeEventType,
  tenantRealtimeChannel,
  type RealtimeEnvelope,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();
const activeConnectionsByTenant = new Map<string, number>();
const MAX_CONNECTIONS_PER_TENANT = Number(process.env.REALTIME_MAX_CONNECTIONS_PER_TENANT || 200);
const HEARTBEAT_MS = Number(process.env.REALTIME_HEARTBEAT_MS || 30_000);
const FALLBACK_SYNC_MS = Number(process.env.REALTIME_FALLBACK_SYNC_MS || 60_000);

type RawRealtimeEnvelope = Partial<RealtimeEnvelope> & {
  data?: unknown;
  payload?: unknown;
};

function incrementConnection(tenantId: string) {
  const count = activeConnectionsByTenant.get(tenantId) || 0;
  if (count >= MAX_CONNECTIONS_PER_TENANT) return false;
  activeConnectionsByTenant.set(tenantId, count + 1);
  return true;
}

function decrementConnection(tenantId: string) {
  const count = activeConnectionsByTenant.get(tenantId) || 0;
  if (count <= 1) activeConnectionsByTenant.delete(tenantId);
  else activeConnectionsByTenant.set(tenantId, count - 1);
}

function parseLastEventDate(request: NextRequest) {
  const raw =
    request.headers.get("last-event-id") ||
    request.nextUrl.searchParams.get("lastEventId") ||
    request.nextUrl.searchParams.get("since") ||
    "";

  if (!raw) return undefined;
  const maybeDate = new Date(raw);
  return Number.isNaN(maybeDate.getTime()) ? undefined : maybeDate;
}

function normalizeRawEnvelope(rawMessage: string): RealtimeEnvelope {
  const parsed = JSON.parse(rawMessage) as RawRealtimeEnvelope;
  const type = normalizeRealtimeEventType((parsed.type || "sync.required") as any);
  return {
    id: parsed.id || `${Date.now()}-legacy`,
    type,
    payload: Object.prototype.hasOwnProperty.call(parsed, "payload") ? parsed.payload : parsed.data,
    ts: parsed.ts || new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await requirePermission(permissions.inboxRead);
  const tenantId = session.user.tenantId;

  if (!incrementConnection(tenantId)) {
    return new Response("Too many realtime connections for this tenant.", { status: 429 });
  }

  let lastUpdatedAt = parseLastEventDate(request) || new Date(request.nextUrl.searchParams.get("since") || 0);
  if (Number.isNaN(lastUpdatedAt.getTime())) lastUpdatedAt = new Date(0);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const timers = new Set<ReturnType<typeof setInterval>>();
      let cleanupSubscriber: (() => void) | undefined;

      const send = (event: string, data: unknown, id?: string) => {
        if (closed) return;
        try {
          const eventId = id || `${Date.now()}-${event}`;
          controller.enqueue(encoder.encode(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        timers.forEach((timer) => clearInterval(timer));
        timers.clear();
        cleanupSubscriber?.();
        decrementConnection(tenantId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });

      send("ready", {
        ok: true,
        tenantScoped: true,
        lastEventId: request.headers.get("last-event-id") || "",
        activeConnections: activeConnectionsByTenant.get(tenantId) || 0,
        ts: new Date().toISOString(),
      });

      try {
        const snapshot = await getInboxRealtimeSnapshot(tenantId, lastUpdatedAt);
        send("inbox.snapshot", snapshot, snapshot.updatedAt);
      } catch {
        send("sync.required", { reason: "initial_snapshot_failed", ts: new Date().toISOString() });
      }

      const heartbeat = setInterval(() => {
        send("heartbeat", { ts: new Date().toISOString() });
      }, HEARTBEAT_MS);
      timers.add(heartbeat);

      const redisUp = await isRealtimeAvailable().catch(() => false);

      if (redisUp) {
        const sub = createTenantSubscriber();
        const channel = tenantRealtimeChannel(tenantId);
        let subscribed = false;

        const dispose = () => {
          if (subscribed) void sub.unsubscribe(channel).catch(() => undefined);
          sub.disconnect();
        };
        cleanupSubscriber = dispose;

        try {
          sub.on("message", (ch: string, rawMessage: string) => {
            if (ch !== channel) return;
            try {
              const event = normalizeRawEnvelope(rawMessage);
              send(event.type, event.payload, event.id);
            } catch {
              send("sync.required", { reason: "malformed_realtime_event", ts: new Date().toISOString() });
            }
          });

          sub.on("error", () => {
            send("sync.required", { reason: "redis_subscriber_error", ts: new Date().toISOString() });
          });

          await sub.subscribe(channel);
          subscribed = true;

          const safetySync = setInterval(async () => {
            try {
              const snapshot = await getInboxRealtimeSnapshot(tenantId, lastUpdatedAt);
              const nextUpdatedAt = new Date(snapshot.updatedAt);
              if (!Number.isNaN(nextUpdatedAt.getTime()) && nextUpdatedAt > lastUpdatedAt) {
                lastUpdatedAt = nextUpdatedAt;
                send("inbox.snapshot", snapshot, snapshot.updatedAt);
              }
            } catch {
              send("sync.required", { reason: "safety_sync_failed", ts: new Date().toISOString() });
            }
          }, FALLBACK_SYNC_MS);
          timers.add(safetySync);

          return;
        } catch {
          dispose();
          cleanupSubscriber = undefined;
          send("sync.required", { reason: "redis_subscribe_failed", ts: new Date().toISOString() });
        }
      }

      // Redis unavailable fallback: low-frequency reconciliation only.
      const fallback = setInterval(async () => {
        try {
          const snapshot = await getInboxRealtimeSnapshot(tenantId, lastUpdatedAt);
          const nextUpdatedAt = new Date(snapshot.updatedAt);
          if (!Number.isNaN(nextUpdatedAt.getTime()) && nextUpdatedAt > lastUpdatedAt) {
            lastUpdatedAt = nextUpdatedAt;
            send("inbox.snapshot", snapshot, snapshot.updatedAt);
          } else {
            send("heartbeat", { ts: new Date().toISOString(), mode: "fallback" });
          }
        } catch (error) {
          send("error", { message: error instanceof Error ? error.message : "Realtime unavailable." });
        }
      }, FALLBACK_SYNC_MS);
      timers.add(fallback);
    },
    cancel() {
      decrementConnection(tenantId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

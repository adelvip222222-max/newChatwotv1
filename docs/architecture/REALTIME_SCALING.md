# Realtime Inbox Scaling — Architecture

## Overview

Before Day 4, the SSE inbox stream used long-polling (DB query every 4 seconds)
with an in-memory EventEmitter. This fails in multi-pod deployments because Pod A
handles a new message while Pod B is serving the SSE connection.

Day 4 introduces Redis Pub/Sub as the primary realtime transport.

---

## Before Day 4

```
Client ←── SSE stream ←── Node.js interval
                               │
                               └── getInboxRealtimeSnapshot() every 4s
                                        │
                                        └── MongoDB query
```

Problems:
- 4-second delay for new messages
- Does NOT work across multiple pods (in-memory only)
- Extra MongoDB load from constant polling

---

## After Day 4

### Redis Pub/Sub Path (Production, Redis available)

```
New Message/Event
     │
     ▼
publishRealtimeEvent(tenantId, type, data)
     │
     ▼
redis.publish("inbox:{tenantId}:events", JSON.stringify(event))
     │
     ▼ (pub/sub channel — tenant-isolated)
     ▼
createTenantSubscriber() ←── SSE handler subscribes
     │
     ▼
controller.enqueue(event) → Client SSE stream
```

### Polling Fallback (Dev / Redis unavailable)

```
Client ←── SSE stream ←── Node.js interval every 4s
                               │
                               └── getInboxRealtimeSnapshot() ← MongoDB
```

The fallback is **automatic** — `isRealtimeAvailable()` pings Redis before each
SSE connection. If Redis is down, the system silently falls back to polling.

---

## Files

| File | Role |
|------|------|
| `src/lib/realtime.ts` | Publisher + subscriber factory + availability check |
| `src/app/api/inbox/stream/route.ts` | SSE endpoint — tries pub/sub, falls back to polling |

---

## Tenant Isolation

Channel name: `inbox:{tenantId}:events`

- Each tenant has their own Redis channel
- SSE connections only subscribe to their tenant's channel
- No cross-tenant events possible

## Event Types

```typescript
type RealtimeEventType =
  | "inbox"         // Full inbox snapshot (polling compat)
  | "message"       // New message arrived
  | "conversation"  // Conversation status changed
  | "assignment"    // Agent assignment changed
  | "delivery"      // Message delivery status changed
  | "heartbeat"     // Keep-alive ping (every 25s)
  | "error"         // Error notification
```

## Publishing Events

Any worker or service can publish:

```typescript
import { publishRealtimeEvent } from "@/lib/realtime";

await publishRealtimeEvent(tenantId, "message", {
  conversationId: "...",
  messageId: "...",
  preview: "Hello...",
});
```

`publishRealtimeEvent` is fire-and-forget — it logs a warning on failure but
never throws, so message processing is never blocked by realtime failures.

## Subscriber Lifecycle

Each SSE connection creates a **dedicated** Redis subscriber connection:

```typescript
const sub = createTenantSubscriber(); // new ioredis connection
sub.on("message", handler);
await sub.subscribe(channel);
// On disconnect:
sub.unsubscribe(channel);
sub.disconnect();
```

The subscriber connection is **not** `failFast` (unlike the main `redis` client)
because subscriber connections must stay open for the lifetime of the SSE session.

## Multi-Pod Readiness

With Redis Pub/Sub:
- Pod A processes a new message → `publishRealtimeEvent(tenantId, ...)`
- Pod B is serving the SSE connection for the same tenant
- Redis delivers the event to Pod B's subscriber
- Pod B pushes the event to the client

**Result**: Real-time delivery across any number of pods.

## Heartbeat

The SSE pub/sub path sends a `heartbeat` event every 25 seconds to keep the
connection alive through proxies and load balancers.
The polling fallback sends a `heartbeat` every 4 seconds (on no-change cycles).

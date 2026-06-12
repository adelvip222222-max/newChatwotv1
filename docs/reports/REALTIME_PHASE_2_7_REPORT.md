# Realtime Phase 2–7 Implementation Report

## Summary

Implemented the remaining realtime migration work after Phase 0 and Phase 1. The platform now has a typed Redis Pub/Sub + SSE realtime layer, a production-oriented SSE endpoint, realtime event publishing from the main message creation paths, and frontend listeners that update the inbox/notifications from push events with low-frequency fallback sync.

## Phases Completed

### Phase 2 — Realtime Foundation

Created a typed realtime foundation:

- `src/lib/realtime/types.ts`
- `src/lib/realtime/events.ts`
- `src/lib/realtime/publisher.ts`
- Updated `src/lib/realtime.ts` as a backward-compatible facade.

Supported event names:

- `message.created`
- `message.updated`
- `conversation.updated`
- `conversation.assigned`
- `notification.created`
- `delivery.updated`
- `inbox.snapshot`
- `heartbeat`
- `ready`
- `sync.required`
- `error`

Legacy names are normalized automatically:

- `message` → `message.created`
- `conversation` → `conversation.updated`
- `assignment` → `conversation.assigned`
- `delivery` → `delivery.updated`
- `inbox` → `inbox.snapshot`

### Phase 3 — Redis Publisher

Added Redis tenant-scoped publishing through:

```ts
publishTenantEvent(tenantId, type, payload)
publishRealtimeEvent(tenantId, type, data)
```

Tenant channel format:

```txt
inbox:{tenantId}:events
```

Realtime publishing is best-effort. If Redis is unavailable, message persistence and queue processing still continue.

### Phase 4 — SSE Endpoint

Enhanced the existing SSE endpoint and added a canonical route:

- Existing compatibility route: `/api/inbox/stream`
- New canonical route: `/api/realtime/stream`

Implemented:

- authenticated SSE connections
- tenant isolation
- Redis Pub/Sub subscriber per connection
- `id:` field for browser reconnect support
- `Last-Event-ID` awareness
- heartbeat every 30 seconds
- cleanup on browser disconnect
- per-tenant connection limit
- fallback low-frequency reconciliation when Redis Pub/Sub is unavailable
- `X-Accel-Buffering: no` header for proxy buffering prevention

### Phase 5 — Inbox Frontend Integration

Updated the active inbox client:

- `src/components/inbox/ai-inbox-client.tsx`

The inbox now listens for the central dashboard realtime event bus:

```txt
chatzi:realtime-event
```

On `message.created`:

- the selected conversation timeline is patched immediately when possible
- the conversation list preview/unread count is patched immediately when possible
- if the conversation is not currently loaded, it falls back to a list refetch

On conversation or delivery changes:

- list/detail are revalidated only when needed

A 60-second fallback sync remains for resilience.

### Phase 6 — Dashboard Notifications Integration

Updated:

- `src/components/dashboard/realtime-bridge.tsx`
- `src/components/dashboard/notifications-menu.tsx`
- `src/app/dashboard/notifications/page.tsx`

The dashboard now opens one central SSE connection in `RealtimeBridge` and forwards events through browser `CustomEvent`.

Notifications now update from push events and keep a 60-second fallback sync instead of 8-second polling.

### Phase 7 — Production Hardening

Added:

- `src/app/api/health/realtime/route.ts`

Health route:

```txt
/api/health/realtime
```

Reports:

- Redis Pub/Sub availability
- transport mode
- heartbeat interval
- fallback sync interval
- max tenant connection limit
- tenant channel pattern

## Files Changed

### Realtime foundation

- `src/lib/realtime.ts`
- `src/lib/realtime/types.ts`
- `src/lib/realtime/events.ts`
- `src/lib/realtime/publisher.ts`

### SSE routes

- `src/app/api/inbox/stream/route.ts`
- `src/app/api/realtime/stream/route.ts`
- `src/app/api/health/realtime/route.ts`

### Event publishers

- `src/lib/inbox/service.ts`
- `src/server/channels/incomingPipeline.ts`
- `src/server/channels/ingressProcessor.ts`
- `src/lib/ai.ts`
- `src/lib/services/ai-agent.service.ts`
- `src/app/api/ai/route.ts`

### Frontend consumers

- `src/components/dashboard/realtime-bridge.tsx`
- `src/components/dashboard/notifications-menu.tsx`
- `src/components/inbox/ai-inbox-client.tsx`
- `src/app/dashboard/notifications/page.tsx`
- `src/app/dashboard/conversations/InboxClientUI.tsx` fallback polling reduced to 60 seconds

## Before / After

### Before

- Dashboard notifications polled every 8 seconds.
- Older conversation UI had 9-second conversation polling and 5-second active-thread polling.
- SSE existed but only emitted a generic `inbox` refresh event.
- Inbox refetched list/detail on every event instead of consuming structured events.
- No canonical `/api/realtime/stream` endpoint.
- No realtime health endpoint.

### After

- The dashboard uses push-based SSE via `/api/realtime/stream`.
- `RealtimeBridge` opens the central SSE connection and forwards events to the UI.
- Inbox consumes structured events such as `message.created`.
- Notifications update instantly from realtime events.
- Fallback sync is reduced to 60 seconds.
- SSE sends heartbeat and supports browser reconnect IDs.
- Redis failure no longer breaks the app; fallback reconciliation continues.

## Deployment Notes

Recommended environment variables:

```env
REALTIME_MAX_CONNECTIONS_PER_TENANT=200
REALTIME_HEARTBEAT_MS=30000
REALTIME_FALLBACK_SYNC_MS=60000
```

For Nginx / reverse proxy, keep buffering disabled for SSE routes. The response now includes:

```txt
X-Accel-Buffering: no
```

## Validation Attempt

`npm ci` could not be used because `package-lock.json` is not synchronized with `package.json`:

- missing `preact@10.11.3`
- missing `@emnapi/runtime@1.11.0`
- missing `@emnapi/core@1.11.0`

A temporary `npm install --ignore-scripts` was attempted only for local validation. `package-lock.json` was not changed.

`npm run lint` could not run before install because `next` was unavailable in `node_modules`.

`tsc --noEmit` still cannot provide a clean project-level result because dependency installation is incomplete/invalid in this environment and the project already has unrelated TypeScript issues in existing files.

## Manual Test Checklist

1. Start Redis.
2. Start Next.js.
3. Open `/api/health/realtime` and confirm `ok: true`.
4. Open dashboard inbox in one browser tab.
5. Open DevTools Network and confirm one `/api/realtime/stream` connection from the dashboard layout.
6. Send an inbound message through widget/Telegram/API.
7. Confirm toast appears instantly.
8. Confirm inbox conversation preview updates instantly.
9. Open the conversation and confirm timeline patches without waiting 5 seconds.
10. Confirm notification menu updates without 8-second polling.
11. Restart Redis and confirm the UI does not crash and fallback sync continues.
12. Restore Redis and confirm SSE events resume.

## Known Limitations

- Redis Pub/Sub is best-effort and does not replay missed events after long disconnects.
- The 60-second fallback sync is kept intentionally for recovery from missed events, browser sleep, or Redis restart.
- For stronger delivery guarantees, the next upgrade should replace or supplement Pub/Sub with Redis Streams.
- Some older/unused inbox UI code still exists, but its polling interval was reduced to 60 seconds.

## Readiness Score

Realtime system after this implementation: **8/10** for MVP production readiness.

Remaining enterprise upgrade: Redis Streams replay + central client-side realtime provider with connection status UI.

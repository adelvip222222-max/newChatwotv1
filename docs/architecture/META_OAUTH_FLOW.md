# Meta OAuth Flow — Architecture

## Overview

This document describes the secure server-side Meta (Facebook/Instagram) OAuth flow implemented in Day 3. The flow completely eliminates the critical vulnerability from the original implementation (access token returned to the browser via `postMessage`).

## Security Principles

1. **No token to frontend** — access tokens never reach the browser.
2. **Server-side exchange only** — `code → token` exchange happens entirely on the server.
3. **Signed state with Redis TTL** — OAuth state is a random nonce stored in Redis (10-minute TTL), not a JWT or cookie value readable by the client.
4. **Single-use state** — `consumeOAuthState()` deletes the key immediately after reading.
5. **Encrypted at rest** — `pageAccessTokenEncrypted` / `appSecretEncrypted` stored via AES-256-GCM (`encryptSecret()`).
6. **Tenant isolation** — state and page session both carry `tenantId`; the connect route verifies the session's `tenantId` matches the authenticated session.
7. **Permission gate** — all OAuth routes require `permissions.settingsManage` (owner/admin only).

## Flow Diagram

```
Browser                   Server                   Meta
  │                         │                        │
  │  GET /api/oauth/meta/   │                        │
  │  start?returnUrl=...    │                        │
  │────────────────────────►│                        │
  │                         │ Generate stateKey      │
  │                         │ Redis SET oauth:meta:  │
  │                         │ state:{key} (10min TTL)│
  │◄────────────────────────│ 302 → Meta OAuth Dialog│
  │                         │                        │
  │                         │                        │
  │  (user approves)        │                        │
  │                         │◄───────────────────────│
  │                         │ GET /api/oauth/meta?   │
  │                         │ code=...&state={key}   │
  │                         │                        │
  │                         │ consumeOAuthState()    │
  │                         │ (validates + deletes)  │
  │                         │                        │
  │                         │ Exchange code → token  │
  │                         │ (server-to-server)     │
  │                         │                        │
  │                         │ Fetch /me/accounts     │
  │                         │ + Instagram accounts   │
  │                         │                        │
  │                         │ Redis SET oauth:meta:  │
  │                         │ pages:{sessionKey}     │
  │◄────────────────────────│ (15min TTL)            │
  │ 302 /dashboard/channels │                        │
  │ /meta-connect?session=  │                        │
  │                         │                        │
  │  GET /api/oauth/meta/   │                        │
  │  pages?session={key}    │                        │
  │────────────────────────►│                        │
  │                         │ Return page list       │
  │◄────────────────────────│ (NO tokens)            │
  │                         │                        │
  │  POST /api/oauth/meta/  │                        │
  │  connect                │                        │
  │  { session, pageId,     │                        │
  │    type }               │                        │
  │────────────────────────►│                        │
  │                         │ Lookup session         │
  │                         │ Encrypt token          │
  │                         │ Create Channel record  │
  │                         │ Subscribe webhooks     │
  │◄────────────────────────│ { channelId,           │
  │                         │   webhookStatus }      │
```

## Files

| File | Responsibility |
|------|---------------|
| `src/lib/meta-oauth.ts` | State management, token exchange, page fetching, channel creation |
| `src/app/api/oauth/meta/start/route.ts` | Generate state, redirect to Meta |
| `src/app/api/oauth/meta/route.ts` | Receive callback, exchange code, store pages session |
| `src/app/api/oauth/meta/pages/route.ts` | Return page list (no tokens) |
| `src/app/api/oauth/meta/connect/route.ts` | Connect selected page, create channel |
| `src/app/dashboard/channels/meta-connect/page.tsx` | React UI for page selection |

## Redis Key Schema

```
oauth:meta:state:{64-char-hex}   TTL=600s  (consumed once)
oauth:meta:pages:{48-char-hex}   TTL=900s  (readable, deleted on connect)
```

## Channel Config Schema

### Facebook Channel
```json
{
  "pageId": "...",
  "pageName": "...",
  "pageAccessTokenEncrypted": "enc:v1:...",
  "appSecretEncrypted": "enc:v1:...",
  "verifyToken": "...",
  "webhookStatus": "subscribed | webhook_subscription_failed",
  "webhookSubscribedAt": "ISO8601 | null",
  "permissions": ["MANAGE", "ADVERTISE", ...]
}
```

### Instagram Channel
```json
{
  "instagramBusinessId": "...",
  "username": "...",
  "linkedPageId": "...",
  "pageAccessTokenEncrypted": "enc:v1:...",
  "appSecretEncrypted": "enc:v1:...",
  "verifyToken": "...",
  "webhookStatus": "subscribed | webhook_subscription_failed",
  "webhookSubscribedAt": "ISO8601 | null",
  "permissions": ["MANAGE", ...]
}
```

## Webhook Subscription

After channel creation, the server attempts:
```
POST /{page-id}/subscribed_apps
subscribed_fields: messages,messaging_postbacks,message_deliveries,message_reads
```

If this fails (most commonly because the Meta App hasn't completed App Review), the channel is saved with `webhookStatus: "webhook_subscription_failed"`. The channel is usable for outbound messaging but will not receive inbound webhooks until the subscription succeeds.

**This is a non-fatal condition** — the system degrades gracefully and the UI shows a clear warning.

## Meta App Review Requirements

The following permissions require Meta App Review before they work in production:

| Permission | Required For |
|-----------|-------------|
| `pages_messaging` | Receiving/sending Messenger messages |
| `instagram_manage_messages` | Receiving/sending Instagram DMs |
| `pages_manage_metadata` | Subscribing page to webhook |

In development, these work with test users/pages only.

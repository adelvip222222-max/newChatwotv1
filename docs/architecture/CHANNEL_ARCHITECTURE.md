# Channel Architecture
**Project:** ChatZi — Omnichannel Foundation
**Date:** 2026-06-11

---

## Overview

The channel system is built on a **ProviderAdapter** pattern. Each communication channel (Telegram, WhatsApp, etc.) is encapsulated behind a uniform interface. The core pipeline is channel-agnostic.

---

## ProviderAdapter Interface

```typescript
interface ProviderAdapter {
  provider: ChannelProvider;
  verifyWebhook(request: Request, channel?: ChannelDocument): Promise<boolean>;
  normalizeIncoming(payload: any, channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]>;
  sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }>;
  parseDeliveryStatus(payload: any): Promise<DeliveryStatusResult | null>;
  getHealth(channel: ChannelDocument): Promise<HealthResult>;
}
```

Every channel adapter implements this interface. The pipeline (`incomingPipeline.ts`, `outboundWorker.ts`) talks ONLY to this interface — never directly to a provider SDK.

---

## Supported Channels

| Channel | Type | Status |
|---|---|---|
| `telegram` | Bot API webhook | ✅ Full |
| `whatsapp` | Meta Cloud API | ⚠️ Partial — sendMessage stub |
| `facebook` | Meta Messenger | ⚠️ Partial — sendMessage stub |
| `instagram` | Meta Instagram | ❌ Stub |
| `website` | Embedded widget | ✅ Full |
| `webhook` | Generic webhook | ✅ Full |
| `email` | SMTP/IMAP | ❌ Stub |
| `api` | Programmatic API | ❌ Stub |

---

## Inbound Flow

```
External Platform
      │
      ▼
POST /api/channels/{provider}/webhook
      │
      ▼ [1] resolveInboundChannel()
      │    → lookup Channel by webhookSecret / phoneNumberId / pageId
      │
      ▼ [2] adapter.verifyWebhook()
      │    → verify signature (HMAC-SHA256, secret token, etc.)
      │    → reject if invalid → 403
      │
      ▼ [3] adapter.normalizeIncoming()
      │    → parse provider-specific payload
      │    → return NormalizedIncomingMessage[]
      │
      ▼ [4] Deduplication check
      │    → WebhookEvent.findOne({ externalEventId })
      │    → skip if already processed
      │
      ▼ [5] Contact Resolution
      │    → ChannelIdentity.findOne({ provider, externalUserId })
      │    → upsert Contact + ChannelIdentity
      │
      ▼ [6] Conversation Resolution
      │    → find open conversation for identity
      │    → create new if none exists
      │    → detect handover keywords → set mode=human
      │
      ▼ [7] Message Persistence
      │    → Message.create({ direction: incoming, sender: user })
      │
      ▼ [8] Queue to core-routing-queue
           → jobId = "route__{messageId}"
           → 3 retries, exponential backoff
```

---

## Outbound Flow

```
AI Worker / Agent Reply
      │
      ▼ Message.create({ direction: outgoing, deliveryStatus: queued })
      │
      ▼ egressQueue.add("prepare-outbound", { messageId, provider })
      │
      ▼ Egress Worker
      │    → load message + conversation + channel
      │    → getAdapter(provider)
      │
      ▼ adapter.sendMessage({ channel, externalUserId, text, attachments })
      │
      ▼ Update MessageDelivery record
           → deliveryStatus: sent | failed
           → externalMessageId stored for delivery receipts
```

---

## Webhook Flow (Meta platforms)

Meta (WhatsApp, Facebook, Instagram) uses a two-phase webhook setup:

```
Phase 1 — Verification (GET):
  GET /api/channels/{provider}/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  → verify hub.verify_token == channel.config.verifyToken
  → return hub.challenge

Phase 2 — Events (POST):
  POST /api/channels/{provider}/webhook
  → verify X-Hub-Signature-256: sha256={HMAC}
  → process payload
```

**Current Status:** WhatsApp and Facebook webhook verification always returns `true` — MUST be fixed before production.

Required implementation:
```typescript
async verifyWebhook(request: Request, channel: ChannelDocument): Promise<boolean> {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const secret = channel.config?.appSecret;
  return verifySha256Hmac(rawBody, signature, secret);
}
```

---

## OAuth Flow (Meta)

```
User clicks "Connect Facebook/Instagram"
      │
      ▼ GET /api/oauth/meta
      │    → redirect to Meta OAuth dialog
      │    → scope: pages_messaging, instagram_basic, instagram_manage_messages
      │
      ▼ Meta redirects to /api/oauth/meta?code=...&state=...
      │    → exchange code for access_token
      │    → GET /me/accounts (list pages)
      │    → GET /{page-id}/instagram_accounts
      │
      ▼ For each page/IG account:
           → upsert Channel record with access_token (encrypted)
           → subscribe webhook for the page
           → activate channel
```

**Current Status:** OAuth endpoint exists but flow is incomplete. Page subscription and channel activation not implemented.

---

## Channel Resolution Strategy

When an inbound webhook arrives without a `channelId` in the URL:

1. **Telegram:** match by `X-Telegram-Bot-Api-Secret-Token` header → `channel.config.webhookSecret`
2. **WhatsApp:** match by `payload.entry[0].changes[0].value.metadata.phone_number_id` → `channel.config.phoneNumberId`
3. **Facebook:** match by `payload.entry[0].id` (page ID) → `channel.config.pageId`
4. **Instagram:** match by `payload.entry[0].id` (IG business account ID) → `channel.config.instagramBusinessId`
5. **Dev fallback:** if only one active channel of that type exists, use it (DEVELOPMENT ONLY)

---

## Channel Registry

`src/server/channels/registry.ts` — singleton adapter map.

```typescript
// Register
registerAdapter(telegramAdapter);
registerAdapter(whatsappAdapter);

// Retrieve
const adapter = getAdapter("telegram");
```

Adapters are initialized once via `initializeAdapters()` called at pipeline entry.

---

## Required Improvements (Day 2+)

| Priority | Item |
|---|---|
| CRITICAL | Implement WhatsApp HMAC-SHA256 verification |
| CRITICAL | Implement Facebook HMAC-SHA256 verification |
| HIGH | Complete WhatsApp `sendMessage` (Meta Cloud API) |
| HIGH | Complete Facebook `sendMessage` (Graph API) |
| HIGH | Complete Instagram adapter (normalize + send) |
| HIGH | Complete Meta OAuth flow (page subscription) |
| MEDIUM | Add `parseDeliveryStatus` for WhatsApp delivery receipts |
| MEDIUM | Telegram: handle photo/document/audio attachments |
| LOW | Email adapter (SMTP outbound, IMAP inbound) |

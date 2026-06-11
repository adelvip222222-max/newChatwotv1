---
name: Webhook Security Architecture
description: How WhatsApp/Facebook webhook HMAC verification works and why rawBody threading is needed
---

## Rule
Webhook routes must read `rawBody = await request.text()` and pass it through `enqueueInboundWebhook({ rawBody })`. The HMAC check is done in the adapter, not the route.

**Why:** `Request.body` is a stream — it can only be consumed once. If the route calls `request.text()` to parse JSON, the adapter cannot re-read it. rawBody must be threaded.

## Secret priority
1. `channel.config.appSecret` (AES-256-GCM encrypted in MongoDB, decrypted via `decryptSecret()`)
2. `META_APP_SECRET` env var (global fallback)
3. No secret → reject in production, warn and allow in development

## Dev fallback
Both `webhookIngress.ts` and `incomingPipeline.ts` have a channel auto-discovery fallback (one active channel).
It is ONLY active when `ALLOW_UNSAFE_CHANNEL_FALLBACK=true` AND `NODE_ENV !== "production"`.

## How to apply
- New Meta webhook route: `rawBody = await request.text()` → pass to `enqueueInboundWebhook`
- New adapter: implement `verifyWebhook(request, channel?, rawBody?)` using `crypto.timingSafeEqual()`
- `ProviderAdapter` interface has `rawBody?` as optional 3rd param to `verifyWebhook`

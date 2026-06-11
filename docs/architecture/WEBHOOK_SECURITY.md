# Webhook Security — WhatsApp & Facebook Channels

## Architecture

```
Meta Cloud API
     │  POST /api/channels/whatsapp/webhook
     │  Headers: x-hub-signature-256: sha256=<hex>
     ▼
┌─────────────────────────────────────────────────────────────┐
│  route.ts                                                   │
│  1. rawBody = await request.text()                         │
│  2. payload = JSON.parse(rawBody)                          │
│  3. enqueueInboundWebhook({ ..., rawBody })                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  webhookIngress.ts                                          │
│  1. resolveInboundChannel() — lookup by phoneNumberId/pageId│
│  2. adapter.verifyWebhook(request, channel, rawBody) ← KEY  │
│     - Uses channel.config.appSecret (per-channel)          │
│     - Falls back to META_APP_SECRET env var                 │
│     - Returns 403 if invalid                               │
│  3. Idempotency check via WebhookEvent.findOneAndUpdate     │
│  4. ingressQueue.add(...)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## HMAC Verification (WhatsApp & Facebook)

Both adapters implement identical timing-safe HMAC-SHA256 verification:

```typescript
// pseudocode from whatsapp.ts / facebook.ts
function verifyHmac(rawBody, signatureHeader, secret) {
  const expected = HMAC-SHA256(rawBody, secret).hex()
  const candidate = signatureHeader.replace("sha256=", "")
  // Validate hex format (64 chars)
  // Use crypto.timingSafeEqual() to prevent timing attacks
}
```

### Secret Resolution Priority

1. `channel.config.appSecret` (encrypted per-channel, stored in MongoDB)
2. `META_APP_SECRET` environment variable (platform-wide fallback)
3. If neither is set → rejects in production; allows in development (logged as warn)

### Why Per-Channel Secrets?

Multi-tenant platforms may have different Meta App credentials per customer or per region. Using a global `META_APP_SECRET` binds the entire platform to one Meta App, which:
- Prevents tenants from using their own Meta Apps
- Creates a single point of failure
- Leaks all tenants' data if the global secret is compromised

---

## rawBody Threading

The `Request` body stream can only be consumed once. The route handler reads `await request.text()` and passes the string explicitly through:

```
route.ts → enqueueInboundWebhook({ rawBody }) → adapter.verifyWebhook(request, channel, rawBody)
```

This avoids the `"body already consumed"` error when the adapter tries to re-read the body.

---

## Channel Discovery

Incoming webhooks are matched to the correct `Channel` document by:

| Provider | Lookup Field |
|----------|--------------|
| WhatsApp | `config.phoneNumberId` from payload metadata |
| Facebook | `config.pageId` from `entry[0].id` |
| Instagram | `config.instagramBusinessId` from `entry[0].id` |
| Telegram | `config.webhookSecret` from `X-Telegram-Bot-Api-Secret-Token` header |

If no channel is found and `tenantId` is not provided → `404 Channel not found`.

---

## Dev Fallback (REMOVED)

Previously, in `NODE_ENV !== "production"`, the ingress would fall back to the only active channel if none matched. This was a security hole that allowed unsigned webhooks from any Meta App to ingest messages.

**Current behavior**: The fallback is disabled unless `ALLOW_UNSAFE_CHANNEL_FALLBACK=true` is set **and** `NODE_ENV !== "production"`. A warning is logged when the fallback is used.

---

## Idempotency

The ingress uses an upsert on `WebhookEvent` keyed by `{ provider, externalEventId }`:

- First receipt → status: `"received"` → job enqueued
- Duplicate → status already exists → returns `{ ok: true, duplicate: true }` without re-enqueuing

---

## Webhook Verification GET (Meta Challenge)

The GET handler validates the `hub.verify_token`:
1. Looks up a `Channel` document with `config.verifyToken === token`
2. Falls back to `WHATSAPP_VERIFY_TOKEN` / `FACEBOOK_VERIFY_TOKEN` env vars
3. Returns `hub.challenge` on success, `403` otherwise

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Spoofed Meta webhook | Per-channel HMAC-SHA256 verification |
| Timing attack on HMAC | `crypto.timingSafeEqual()` |
| Body tampering | rawBody passed directly from route without re-serialization |
| Replay attack | Idempotency dedup on `externalEventId` |
| Cross-tenant poisoning | Channel resolved to specific `tenantId` before processing |
| Dev fallback abuse in prod | Fallback gated on `ALLOW_UNSAFE_CHANNEL_FALLBACK=true` AND non-prod env |

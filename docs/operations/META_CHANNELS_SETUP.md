# Meta Channels Setup Guide (WhatsApp & Facebook)

## Prerequisites

- A Meta Developer account at https://developers.facebook.com
- A verified Meta Business Account
- A WhatsApp Business Account or Facebook Page

---

## WhatsApp Cloud API Setup

### Step 1 — Create a Meta App

1. Go to https://developers.facebook.com/apps → **Create App**
2. Select **Business** type
3. Note your **App ID** and **App Secret**

### Step 2 — Add WhatsApp Product

1. In your app dashboard → **Add Product** → **WhatsApp**
2. Note your **Phone Number ID** and **WhatsApp Business Account ID**
3. Generate or use an existing **Access Token** (System User token recommended for production)

### Step 3 — Configure Webhook

1. In WhatsApp → Configuration → Webhook
2. **Callback URL**: `https://your-domain.com/api/channels/whatsapp/webhook`
3. **Verify Token**: Choose a strong random string (e.g., `openssl rand -hex 32`)
4. Subscribe to: `messages`

### Step 4 — Create Channel in ChatZi

```json
POST /api/channels/config
{
  "type": "whatsapp",
  "name": "My WhatsApp Channel",
  "config": {
    "phoneNumberId": "<from Meta dashboard>",
    "wabaId": "<WhatsApp Business Account ID>",
    "appSecret": "<App Secret — will be encrypted at rest>",
    "accessToken": "<System User Access Token — will be encrypted at rest>",
    "verifyToken": "<same token used in Meta webhook config>"
  }
}
```

**Security**: `appSecret` and `accessToken` are encrypted with AES-256-GCM before storage. Never store them in plaintext.

### Step 5 — Verify Connectivity

```bash
# Test webhook challenge verification
curl "https://your-domain.com/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING"
# Expected: CHALLENGE_STRING
```

---

## Facebook Messenger Setup

### Step 1 — Create a Meta App (if not already done)

Same as WhatsApp Step 1.

### Step 2 — Add Messenger Product

1. In your app → **Add Product** → **Messenger**
2. Link your **Facebook Page**
3. Note your **Page ID** and generate a **Page Access Token**

### Step 3 — Configure Webhook

1. In Messenger → Settings → Webhooks
2. **Callback URL**: `https://your-domain.com/api/channels/facebook/webhook`
3. **Verify Token**: A strong random string
4. Subscribe to: `messages`, `messaging_postbacks`

### Step 4 — Create Channel in ChatZi

```json
POST /api/channels/config
{
  "type": "facebook",
  "name": "My Facebook Page",
  "config": {
    "pageId": "<Facebook Page ID>",
    "appSecret": "<App Secret — will be encrypted at rest>",
    "pageAccessToken": "<Page Access Token — will be encrypted at rest>",
    "verifyToken": "<same token used in Meta webhook config>"
  }
}
```

> **Note**: Facebook `sendMessage` is not yet implemented (Day 3). Incoming messages will be received and routed but outbound replies will fail with `FACEBOOK_SEND_NOT_IMPLEMENTED`.

---

## Shared Meta App Secret

If all your channels use the **same Meta App** (common for single-tenant deployments), you can set a platform-wide fallback:

```env
META_APP_SECRET=your-meta-app-secret
```

This is used when a channel's `config.appSecret` is not set. For multi-tenant deployments, always set per-channel secrets.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|:--------:|-------------|
| `META_APP_SECRET` | No | Platform-wide fallback app secret |
| `WHATSAPP_VERIFY_TOKEN` | No | Fallback verify token for challenge handshake |
| `FACEBOOK_VERIFY_TOKEN` | No | Fallback verify token for challenge handshake |
| `ALLOW_UNSAFE_CHANNEL_FALLBACK` | Never in prod | Set to `true` for dev-only channel auto-discovery |
| `AI_KEY_ENCRYPTION_SECRET` | Yes | Key used to encrypt `appSecret`, `accessToken` at rest |

---

## Testing Locally with ngrok

```bash
ngrok http 3000
# Copy the https URL, use as webhook callback in Meta dashboard
```

Set the channel's `verifyToken` to match what you configure in the Meta webhook panel.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 403 on webhook POST | Wrong `appSecret` or signature mismatch | Verify `channel.config.appSecret` matches Meta App Secret |
| 404 on webhook POST | Channel not found or inactive | Check `phoneNumberId` / `pageId` matches channel config |
| 403 on GET challenge | Wrong `verifyToken` | Update channel config or `WHATSAPP_VERIFY_TOKEN` env |
| Messages not enqueued | Redis/BullMQ down | Check worker logs and Redis connectivity |
| `ACCESS_TOKEN_DECRYPT_FAILED` | Wrong `AI_KEY_ENCRYPTION_SECRET` | Ensure env var matches the one used when storing the token |

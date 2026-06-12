# Instagram Adapter — Architecture

## Overview

Instagram DM is implemented as a first-class `ProviderAdapter` in
`src/server/channels/providers/instagram.ts`. It reuses the Meta Graph API
infrastructure (same OAuth, same webhook signature verification, same `/me/messages`
endpoint) but has its own config schema and error codes.

## Webhook Verification

Uses `HMAC-SHA256` via the `X-Hub-Signature-256` header — identical to the
Facebook adapter pattern established in Day 2/3.

```
rawBody → HMAC-SHA256(appSecret) → timingSafeEqual(expected, candidate)
```

Secret resolution order:
1. `channel.config.appSecretEncrypted` (decrypted server-side)
2. `channel.config.appSecret` (plain, legacy)
3. `META_APP_SECRET` env var
4. Dev-only: if no secret is set and `NODE_ENV !== "production"`, returns `true`

**Never** returns `true` unconditionally.

## Inbound Normalization

Instagram DMs arrive via `entry[].messaging[]` — same structure as Facebook
Messenger. Key differences:

| Field | Facebook | Instagram |
|-------|---------|-----------|
| sender.id | PSID (Page-Scoped) | IGSID (Instagram-Scoped) |
| recipient.id | Page ID | Instagram Business Account ID |
| Attachments | image/video/audio/file/... | image/video/audio/file/... |
| is_echo | present | present — **must be skipped** |

`normalizeIncoming` skips echo messages (`msg.is_echo === true`).
Attachments are normalized to `NormalizedAttachment[]`.

## Outbound (sendMessage)

```
POST https://graph.facebook.com/v18.0/me/messages
Authorization: Bearer {PAGE_ACCESS_TOKEN}

{
  "recipient": { "id": "{IGSID}" },
  "message": { "text": "..." },
  "messaging_type": "RESPONSE"
}
```

The page access token is **never stored in plaintext**. It is decrypted from
`channel.config.pageAccessTokenEncrypted` using `decryptSecret()` at call time
and **never logged**.

## Channel Config Schema

```typescript
{
  instagramBusinessId: string;   // Instagram Business Account ID
  linkedPageId: string;          // Facebook Page ID (token owner)
  username: string;              // @username for display
  pageAccessTokenEncrypted: string; // encrypted page token
  appSecretEncrypted?: string;   // optional per-channel app secret
  verifyToken: string;           // for GET webhook verification
  permissions: string[];         // ['instagram_basic', 'instagram_manage_messages', ...]
}
```

## Error Codes

| Code | Constant | Meaning |
|------|---------|---------|
| 190 | INVALID_ACCESS_TOKEN | Token expired or revoked |
| 200 | PERMISSION_ERROR | App lacks required permission |
| 551 | RECIPIENT_NOT_REACHABLE | User blocked or deleted conversation |
| 613 | RATE_LIMIT_EXCEEDED | Meta rate limit hit |
| 10900/10901 | OUTSIDE_MESSAGING_WINDOW | 24-hour window expired |
| 10902 | APP_REVIEW_REQUIRED | Permission needs App Review |
| 10903 | NOT_INSTAGRAM_PRO_ACCOUNT | Must be Business/Creator account |
| 10904 | INSTAGRAM_NOT_LINKED_TO_PAGE | IG not linked to Facebook Page |
| 10800 | UNSUPPORTED_ATTACHMENT_TYPE | Can't send that attachment type |

## Health Check

`getHealth()` returns:
- `unconfigured` if `instagramBusinessId` or `pageAccessTokenEncrypted` is missing
- `error` if required permissions (`instagram_manage_messages`, `instagram_basic`,
  `pages_show_list`) are missing from `channel.config.permissions`
- `healthy` if all checks pass

## App Review Requirements

Instagram DM API requires Meta App Review for:
- `instagram_manage_messages` — required to read/send DMs
- `instagram_basic` — required to view profile info

Without these, the adapter will connect but only work in development mode
(for users who are testers on the Facebook App).

## Registration

The adapter is registered in `src/server/channels/providers/index.ts`:

```typescript
import { instagramAdapter } from "./instagram";
registerAdapter(instagramAdapter);
```

The old stub from `stubs.ts` is no longer imported for instagram.

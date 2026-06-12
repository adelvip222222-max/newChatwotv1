# Day 2 Final Report — Security Hardening & Channel Foundation

**Date**: June 11, 2026  
**Sprint**: DAY 2 of the ChatZi build sprint  
**Status**: ✅ Complete

---

## Objectives Delivered

### 1. Super Admin System

| Item | Status |
|------|--------|
| `User.isSuperAdmin: Boolean` Mongoose field added | ✅ |
| `isSuperAdmin` propagated through NextAuth JWT & session | ✅ |
| `next-auth.d.ts` types updated | ✅ |
| `requireSuperAdmin()` guard in `src/server/auth/guards.ts` | ✅ |
| All `/api/admin/*` routes migrated to `requireSuperAdmin()` | ✅ |
| `requirePlatformAdmin()` in `authz.ts` fixed to use `isSuperAdmin` | ✅ |
| `scripts/make-super-admin.ts` CLI promotion script | ✅ |

**Security fix**: Previously `requirePlatformAdmin()` checked `role === "admin"` — any tenant admin could reach platform admin routes. Now it requires the dedicated `isSuperAdmin` boolean which is only set via the CLI script.

### 2. Webhook HMAC Security — WhatsApp

| Item | Status |
|------|--------|
| `src/server/channels/providers/whatsapp.ts` — real adapter | ✅ |
| Per-channel HMAC-SHA256 using `channel.config.appSecret` | ✅ |
| Timing-safe comparison via `crypto.timingSafeEqual()` | ✅ |
| Falls back to global `META_APP_SECRET` env var | ✅ |
| Real `sendMessage()` via Meta Cloud API v19.0 | ✅ |
| Known Meta error codes mapped (190, 131026, 131056, 100) | ✅ |
| `rawBody` threading from route → ingress → adapter | ✅ |
| Route simplified — no more global env HMAC in route.ts | ✅ |

### 3. Webhook HMAC Security — Facebook

| Item | Status |
|------|--------|
| `src/server/channels/providers/facebook.ts` — real adapter | ✅ |
| Per-channel HMAC-SHA256 (identical logic to WhatsApp) | ✅ |
| `normalizeIncoming()` parses Messenger events | ✅ |
| `sendMessage()` returns `FACEBOOK_SEND_NOT_IMPLEMENTED` | ✅ (Day 3) |
| Instagram detection (payload.object === "instagram") | ✅ |

### 4. Unsafe Channel Fallback Removed

| Item | Status |
|------|--------|
| Dev fallback in `webhookIngress.ts` gated behind `ALLOW_UNSAFE_CHANNEL_FALLBACK=true` | ✅ |
| Dev fallback in `incomingPipeline.ts` gated behind `ALLOW_UNSAFE_CHANNEL_FALLBACK=true` | ✅ |
| Warning logged when fallback is used | ✅ |
| Production can never use fallback (env check AND NODE_ENV check) | ✅ |

### 5. Channel Provider Interface

| Item | Status |
|------|--------|
| `ProviderAdapter.verifyWebhook` signature extended with `rawBody?: string` | ✅ |
| `EnqueueWebhookInput` extended with `rawBody?: string` | ✅ |
| `stubs.ts` cleaned — whatsapp/facebook removed, remaining stubs updated | ✅ |
| `providers/index.ts` registers real whatsapp + facebook adapters | ✅ |

### 6. API Deprecation

| Item | Status |
|------|--------|
| `GET /api/conversations` — `Deprecation: true` header added | ✅ |
| `Link: </api/inbox/conversations>; rel="successor-version"` header | ✅ |
| Deduplication notes documented | ✅ |

### 7. Tests

| Suite | Tests | Status |
|-------|-------|--------|
| Webhook HMAC verification | 8 tests | ✅ |
| Super Admin flag semantics | 3 tests | ✅ |
| RBAC permission model | 4 tests | ✅ |
| Channel fallback guard | 1 test | ✅ |

---

## Security Issues Fixed

| Issue | Severity | Fixed |
|-------|----------|-------|
| `requirePlatformAdmin()` checked role, not `isSuperAdmin` | **CRITICAL** | ✅ |
| WhatsApp/Facebook HMAC used global env var, not per-channel secret | **HIGH** | ✅ |
| Dev channel fallback leaked to production (no env check) | **HIGH** | ✅ |
| WhatsApp/Facebook adapters in stubs returned `true` always | **HIGH** | ✅ |
| Request body consumed before adapter HMAC check | **HIGH** | ✅ |

---

## Architecture Changes

```
Before:
  route.ts: HMAC check with global META_APP_SECRET
  adapter (stubs.ts): verifyWebhook() → return true

After:
  route.ts: reads rawBody, passes to ingress (no HMAC in route)
  webhookIngress.ts: resolves channel, calls adapter.verifyWebhook(request, channel, rawBody)
  adapter (whatsapp.ts/facebook.ts): HMAC with channel.config.appSecret (decrypted) or fallback
```

---

## Known Gaps for Day 3

- Facebook `sendMessage` is NOT_IMPLEMENTED — needs Messenger Send API integration
- Instagram adapter is still a stub
- `/api/settings/*` routes use inline `isAdminRole()` instead of `requirePermission()` — should be migrated
- `ai-providers` route uses `requireAdmin()` (tenant admin) while it should likely be `requireSuperAdmin()` — needs product decision

---

## Files Changed

### New Files
- `src/server/channels/providers/whatsapp.ts`
- `src/server/channels/providers/facebook.ts`
- `scripts/make-super-admin.ts`
- `tests/day2-security.test.ts`
- `docs/architecture/RBAC_ENFORCEMENT.md`
- `docs/architecture/WEBHOOK_SECURITY.md`
- `docs/operations/META_CHANNELS_SETUP.md`
- `docs/reports/DAY2_FINAL_REPORT.md`
- `docs/reports/DAY2_API_DEDUPLICATION_NOTES.md`

### Modified Files
- `src/lib/models/user.ts` — added `isSuperAdmin` field
- `src/types/next-auth.d.ts` — added `isSuperAdmin` to Session/JWT/User types
- `src/lib/auth.ts` — propagate `isSuperAdmin` through JWT and session callbacks
- `src/lib/authz.ts` — `requirePlatformAdmin()` now checks `isSuperAdmin` flag
- `src/server/auth/guards.ts` — added `requireSuperAdmin()` function
- `src/server/channels/types.ts` — `verifyWebhook` signature adds `rawBody?`
- `src/server/channels/webhookIngress.ts` — rawBody threading, per-channel verification, gated fallback
- `src/server/channels/incomingPipeline.ts` — gated dev fallback
- `src/server/channels/providers/index.ts` — registers real whatsapp + facebook adapters
- `src/server/channels/providers/stubs.ts` — removed whatsapp/facebook, updated signatures
- `src/app/api/channels/whatsapp/webhook/route.ts` — passes rawBody, no global HMAC
- `src/app/api/channels/facebook/webhook/route.ts` — passes rawBody, no global HMAC
- `src/app/api/conversations/route.ts` — deprecation headers
- `src/app/api/admin/users/route.ts` — `requireSuperAdmin`
- `src/app/api/admin/users/[id]/route.ts` — `requireSuperAdmin`
- `src/app/api/admin/billing/plans/route.ts` — `requireSuperAdmin`
- `src/app/api/admin/billing/packs/route.ts` — `requireSuperAdmin`
- `src/app/api/admin/ai-models/route.ts` — `requireSuperAdmin`
- `src/app/api/admin/ai-models/[id]/route.ts` — `requireSuperAdmin`
- `src/app/api/admin/subscriptions/cancel/route.ts` — `requireSuperAdmin`

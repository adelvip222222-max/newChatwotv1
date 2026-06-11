---
name: Meta OAuth Flow
description: Secure server-side Meta OAuth for Facebook/Instagram channel connection
---

## Rule
Never return Meta access tokens to the frontend. All token handling is server-side only.

## How to apply
- State: `generateOAuthState()` → stored in Redis with 10-min TTL → `consumeOAuthState()` deletes on use
- Callback: exchanges `code` server-side, stores pages in Redis session (15-min TTL), redirects to selection UI
- Pages API: returns page list WITHOUT tokens (strips `accessToken` field)
- Connect: `consumePagesSession()` + `encryptSecret(token)` → store in Channel.config.pageAccessTokenEncrypted
- All routes require `requirePermission(permissions.settingsManage)`

## Redis key schema
- `oauth:meta:state:{64-hex}` TTL=600s (single-use)
- `oauth:meta:pages:{48-hex}` TTL=900s (readable, deleted on connect)

## Why
Original code had CRITICAL bug: `postMessage({ token: '...' }, '*')` leaked access token to any window.

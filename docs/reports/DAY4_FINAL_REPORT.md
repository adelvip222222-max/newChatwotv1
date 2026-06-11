# Day 4 Final Report — Instagram Adapter, AI Reliability, Realtime Scaling

**Date**: Day 4  
**Status**: ✅ Complete

---

## 1. Summary

### What Was Done

| Task | Status | Notes |
|------|--------|-------|
| T4.1 — Instagram Adapter (full) | ✅ Done | Real HMAC, real sendMessage, no fakes |
| T4.2 — Instagram Connection UI Polish | ✅ Done | Permission badges, missing-perms warnings |
| T4.3 — AI Quota Race Condition Fix | ✅ Done | Redis INCR atomic, fail-closed for free plans |
| T4.4 — Token-Aware AI Context | ✅ Done | 4000-token budget, `buildTokenAwareTranscript()` |
| T4.5 — SSE Redis Pub/Sub | ✅ Done | Pub/Sub primary, polling fallback |
| T4.6 — AI Provider Resolution | ✅ Analysis + docs (migration deferred to Day 5/6) |
| T4.7 — Lead/Ticket Tool Foundation | ✅ Done | `save_lead_data`, `create_ticket`, `update_contact_profile` |
| T4.8 — Tests | ✅ Done | 30 assertions in tests/day4.test.ts |
| T4.9 — Documentation | ✅ Done | 4 architecture docs + this report |

### What Was NOT Done / Deferred

- `AiProvider` → `AiModel` full migration: deferred to Day 5/6. Current state is
  safe and documented. `AiProvider` is already the primary source in `ai-router.ts`.
- Conversation summarization for very long histories: deferred to Day 5. Placeholder
  truncation message is shown to the AI instead.
- Full `Lead` and `Ticket` Mongoose models: deferred to Day 5. Tools currently
  store to `Task` collection with typed `type` field.

---

## 2. Instagram Status

| Capability | Status | Notes |
|------------|--------|-------|
| Webhook Verification | ✅ Secure | HMAC-SHA256, timingSafeEqual, per-channel appSecret |
| Inbound (normalize) | ✅ Working | entry[].messaging[], echo skip, attachment normalization |
| Outbound (sendMessage) | ✅ Real API | POST /v18.0/me/messages, token decrypted server-side |
| OAuth / Connection | ✅ Working | Full flow from Day 3, now registers instagram adapter |
| UI | ✅ Polished | Permission badges, missing-perm warnings, IG account listing |
| Production Ready | ⚠️ Partial | Needs Meta App Review for `instagram_manage_messages` |

**Key note**: Instagram DM API requires Meta App Review in production.
In development, it works for testers on the Facebook App. `getHealth()` returns
`error` status if required permissions are missing from channel config.

---

## 3. AI Reliability Status

### Quota Atomicity

**Before**: `assertCanSendAiMessage()` (read) + `recordAiMessageUsage()` (write) = race  
**After**: `assertAndReserveQuota()` uses Redis INCR — single atomic operation

Redis key: `quota:ai_messages:{tenantId}:{YYYY-MM}`  
TTL: seconds until end of UTC month  
MongoDB sync: every 10 increments + billing webhooks  
Redis down (free): fail closed  
Redis down (paid): fail open + error log  

### Context Window

**Before**: `.limit(10)` — fixed, no token awareness  
**After**: `buildTokenAwareTranscript(messages, 2000)` — token-budget driven

- Fetches up to 60 messages, selects newest that fit in 2000-token budget
- Always includes at least 2 messages
- Truncated history gets a visible placeholder in the context

### Provider Resolution

`AiProvider` is the authoritative source. `AiModel` is legacy.  
Full migration deferred — see `docs/architecture/AI_TOOLS_LEAD_TICKET_FOUNDATION.md`.

### Lead/Ticket Tools

3 new tools: `save_lead_data` (idempotent upsert), `create_ticket` (dedup-safe),
`update_contact_profile` (merge-safe). All scoped to `tenantId + conversationId`.

**Remaining risk**: Tools store to `Task` collection until Day 5 introduces
`Lead` and `Ticket` models.

---

## 4. Realtime Status

| Aspect | Before | After |
|--------|--------|-------|
| Transport | DB polling every 4s | Redis Pub/Sub (primary) |
| Message latency | Up to 4 seconds | Near-instant |
| Multi-pod ready | ❌ No | ✅ Yes |
| Fallback | N/A | Polling every 4s (auto, silent) |
| Tenant isolation | By query filter | By channel name `inbox:{tenantId}:events` |

Publishing an event:
```typescript
publishRealtimeEvent(tenantId, "message", data);
```

The SSE route (`/api/inbox/stream`) auto-detects Redis availability on each
connection. If Redis is down, it silently uses the polling path.

---

## 5. Tests

Tests in `tests/day4.test.ts` — 30 assertions.

### Test Categories

| Category | Tests | Status |
|----------|-------|--------|
| Instagram Adapter | 10 | ✅ All pass |
| AI Quota | 7 | ✅ All pass |
| AI Context | 5 | ✅ All pass |
| Realtime | 4 | ✅ All pass |
| AI Tools | 4 | ✅ All pass |

Run with: `node --input-type=module tests/day4-runner.js`

### Commands Run

- `npm run lint`: not configured (Next.js lint config exists but `eslint` not in node_modules)
- `npm run typecheck`: not runnable (tsc missing from node_modules, pnpm workspace incomplete)
- `npm test`: jest not installed (same issue as Day 3)
- Tests verified via Node.js 24 ESM runner

---

## 6. Risks Remaining

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Instagram App Review | HIGH | Required for production DMs. Dev mode works for app testers. |
| Meta 24h messaging window | HIGH | Instagram allows re-entry only if user messages first. Adapter returns `OUTSIDE_MESSAGING_WINDOW`. |
| Redis availability | MEDIUM | Fail-closed for free plans, fail-open for paid. Polling fallback for SSE. |
| AI provider migration (AiModel→AiProvider) | LOW | AiProvider already primary. AiModel read-only until Day 5/6 migration. |
| Lead/Ticket stored in Task collection | LOW | Typed by `type` field. Full models in Day 5. |

---

## 7. Readiness for Day 5

| Day 5 Feature | Readiness |
|---------------|-----------|
| Qdrant integration | ✅ Ready — knowledge pipeline unchanged, embedding provider isolated |
| Lead model | ✅ Ready — `save_lead_data` tool + Task schema foundation |
| Ticket model | ✅ Ready — `create_ticket` tool + Task schema foundation |
| Entitlement model | ✅ Ready — quota.ts provides the counter infrastructure |
| Conversation summarization | ⚠️ Foundation only — placeholder in context, summarizer not built |

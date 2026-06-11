# DAY 1 — Final Report
**Project:** ChatZi (newChatwotv1)
**Date:** 2026-06-11
**Prepared by:** Architecture Analysis (Day 1)

---

## Current System Score

| Domain | Score | Notes |
|---|---|---|
| **Omnichannel** | 45/100 | Telegram ✅, WhatsApp partial ⚠️, Facebook partial ⚠️, Instagram ❌, Email ❌ |
| **AI** | 65/100 | LLM working, personas working, knowledge-grounded. No Qdrant, dual-model confusion, context issues |
| **Knowledge Base** | 60/100 | Ingestion works, 4-level taxonomy, hybrid search. No Qdrant, in-memory similarity, sync training |
| **Billing** | 75/100 | Stripe fully integrated, plans + packs + webhooks. Race condition on quota, no entitlements |
| **SaaS** | 55/100 | Multi-tenant isolation mostly done. Super admin broken, no invitations, no entitlements |
| **Security** | 40/100 | WhatsApp/Facebook webhook always-true, super admin check broken, no RBAC at route level |
| **Scalability** | 55/100 | BullMQ queue architecture is solid. SSE not scalable, knowledge search O(n), retrain synchronous |
| **Maintainability** | 60/100 | Good model structure, but God services, duplicate routes, dual provider model hurt maintainability |

**Overall System Score: 57/100**

---

## Top 20 Problems (Ordered by Severity)

### 🔴 CRITICAL

**#1 — WhatsApp webhook verification is disabled**
- Location: `src/server/channels/providers/stubs.ts:6`
- `verifyWebhook()` always returns `true`
- Any attacker can inject fake messages into the system
- **Fix:** Implement HMAC-SHA256 verification (X-Hub-Signature-256 header)

**#2 — Facebook webhook verification is disabled**
- Same as #1 for Facebook Messenger
- Location: `src/server/channels/providers/stubs.ts:39`

**#3 — Super Admin check is broken**
- Location: `src/lib/authz.ts:9`
- `requirePlatformAdmin()` checks `role === "admin"` only
- Any tenant "admin" role can access `/admin/*` Super Admin pages
- **Fix:** Add `User.isSuperAdmin: boolean` flag; check that instead

**#4 — No RBAC enforcement at API route level**
- Session check (`requireSession`) does not verify permissions
- Any authenticated user (even `viewer` role) can call `inbox.reply`, `knowledge.manage`, etc.
- The permission system in `src/server/permissions/` is defined but never enforced at routes
- **Fix:** Create and apply `requirePermission(session, permission)` at each route

**#5 — WhatsApp sendMessage is a stub**
- Location: `src/server/channels/providers/stubs.ts:33`
- `sendMessage()` returns `{ success: true }` without sending anything
- All WhatsApp outbound messages silently disappear
- **Fix:** Implement Meta Cloud API send (Day 2 task)

### 🟠 HIGH

**#6 — AI quota counter has race condition**
- Location: `src/lib/billing.ts:98-117`
- `assertCanSendAiMessage()` reads `usedMessages`, then `recordAiMessageUsage()` increments
- Under concurrent AI workers (concurrency=3), can over-serve quota
- **Fix:** Atomic Redis INCR with per-billing-cycle TTL

**#7 — Knowledge training runs synchronously in request handler**
- Location: `src/lib/knowledge.ts:254-328`
- `trainKnowledgeDocument()` called inline during `/api/knowledge` POST
- For large PDFs (100+ pages), this exceeds Next.js 10-second route timeout
- **Fix:** Queue training job to BullMQ knowledge-worker

**#8 — In-memory cosine similarity (no Qdrant)**
- Location: `src/lib/knowledge.ts:352-396`
- Loads up to 250 chunks into Node.js memory per search query
- At 10,000 chunks: ~25MB per request, O(n) CPU
- **Fix:** Qdrant vector database (Day 5)

**#9 — SSE realtime not scalable across pods**
- Location: `src/app/api/inbox/stream/route.ts`
- In-memory EventEmitter — events only reach clients connected to same Node.js process
- Horizontal scaling (2+ pods) breaks inbox realtime
- **Fix:** Redis pub/sub as event bus

**#10 — retrainAllKnowledge is serial and blocking**
- Location: `src/lib/knowledge.ts:330-338`
- Loops documents one by one, awaiting each training job
- 100 documents × 30s each = 50 minutes blocking
- **Fix:** Dispatch parallel BullMQ jobs with batch size control

**#11 — Dual AI provider system (AiProvider + AiModel coexist)**
- Location: `src/lib/services/ai-agent.service.ts:111-116`
- Two provider resolution paths create confusion and inconsistent behavior
- Legacy `AiModel` records can shadow newer `AiProvider` configuration
- **Fix:** Migrate to `AiProvider` only; deprecate `AiModel`

**#12 — Instagram adapter is a complete stub**
- Location: `src/server/channels/providers/stubs.ts:68-75`
- All methods are no-ops; normalizeIncoming returns empty array
- Users who connect Instagram see nothing

**#13 — Dev-mode channel fallback bypasses tenant isolation**
- Location: `src/server/channels/incomingPipeline.ts:228-230`
- In dev, if only one active channel of that type exists, uses it regardless of tenant
- Code may accidentally deploy with this behavior active

### 🟡 MEDIUM

**#14 — Conversation.assigneeId AND assignedAgentId both exist**
- Location: `src/lib/models/conversation.ts:37-38`
- Same field duplicated under two names — causes inconsistent writes
- Same for `teamId` + `assignedTeamId`

**#15 — Tenant.plan and TenantSubscription.planId are two sources of truth**
- Location: `src/lib/models/tenant.ts:8`, `src/lib/models/tenant-subscription.ts`
- Tenant has `plan: "free"` string AND TenantSubscription has `planId`
- They can drift apart silently

**#16 — AI context window fixed at 10 messages, no token counting**
- Location: `src/lib/services/ai-agent.service.ts:148`
- No awareness of actual token budget
- Long messages can exceed model context silently (API error)

**#17 — No Lead or Ticket model**
- Contacts have `lifecycleStage: "lead"` but no pipeline tracking
- CRM pipeline (lead stages, deal value, ticket SLAs) is completely absent

**#18 — No user invitation system**
- Users can only join by registering with the same tenant (no invite flow)
- No way to onboard team members properly

**#19 — BillingPlan has optional tenantId — confusing global vs per-tenant plans**
- Location: `src/lib/models/billing-plan.ts:5`
- Plan can be null-tenantId (global) or specific-tenantId (custom)
- Lookup queries are complex `$or` conditions as a result

**#20 — No Entitlement model — plan limits only enforce message count**
- Cannot limit: max channels, max agents, max bots, feature flags
- All tenants on any plan get all features

---

## Top 20 Quick Wins (Ordered by Impact)

**#1 — Fix WhatsApp webhook HMAC** (2h) → Closes critical security hole
**#2 — Fix Facebook webhook HMAC** (2h) → Closes critical security hole
**#3 — Fix `requirePlatformAdmin` to use isSuperAdmin** (1h) → Fixes admin security
**#4 — Remove dev fallback channel resolution** (30min) → Tenant isolation improvement
**#5 — Add `requirePermission()` to inbox reply route** (1h) → RBAC for most-used action
**#6 — Implement WhatsApp sendMessage (Meta Cloud API)** (4h) → WhatsApp becomes operational end-to-end
**#7 — Move knowledge training to BullMQ job** (4h) → Eliminates request timeout risk
**#8 — Fix AI quota with Redis INCR** (2h) → Prevents quota over-serving under load
**#9 — Deduplicate /api/conversations vs /api/inbox/conversations** (3h) → Reduces confusion and maintenance burden
**#10 — Fix embedding dimension mismatch filter** (1h) → Fixes silent wrong search scores
**#11 — Add `isSuperAdmin` field to User model** (1h) → Foundation for proper super admin
**#12 — Fix `sender` + `senderType` redundancy on Message** (1h) → Data model clarity
**#13 — Fix assigneeId vs assignedAgentId duplication** (2h) → Eliminates write inconsistency
**#14 — Fix Tenant.plan vs TenantSubscription drift** (2h) → Eliminates dual source of truth
**#15 — Add `concurrency` env var docs to workers** (30min) → Operations clarity
**#16 — Log warning when channel cannot be resolved** (30min) → Easier debugging of missed messages
**#17 — Add `routingKeywords` use in core-routing-worker** (3h) → Team auto-routing unlocked
**#18 — Create expired knowledge cleanup cron** (2h) → Prevent DB bloat from temporary knowledge
**#19 — Add knowledge training progress endpoint** (1h) → Better UX for large document uploads
**#20 — Consolidate AiProvider + AiModel to single model** (4h) → Removes dual-path AI confusion

---

## Readiness For Day 2

### ✅ Green — Can Start Immediately
- WhatsApp HMAC fix (code is structured, just needs implementation)
- Facebook HMAC fix (same)
- Super Admin fix (straightforward field addition)
- Dev fallback removal (one-line delete)
- RBAC `requirePermission` helper (authz.ts already has foundation)

### ⚠️ Requires Attention Before Proceeding
- **WhatsApp `sendMessage`** — needs Meta App review for `messages` permission before going live in production. Can develop and test in sandbox.
- **Meta OAuth flow** — requires configured Meta App with correct redirect URIs and app permissions

### ❌ Blockers for Channel Go-Live
| Channel | Blocker |
|---|---|
| WhatsApp | sendMessage stub + HMAC fix needed |
| Facebook | sendMessage stub + HMAC fix needed |
| Instagram | OAuth + full adapter needed |
| Email | No adapter at all |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Fake webhook injection (WhatsApp/FB) | HIGH | HIGH | Fix Day 2 — T2.1, T2.2 |
| Knowledge timeout in prod (large doc) | HIGH | MEDIUM | Fix Day 3 — T3.3 |
| Quota over-serve at scale | MEDIUM | MEDIUM | Fix Day 4 — T4.2 |
| SSE breaks under multi-pod | MEDIUM | HIGH | Fix Day 4 — T4.5 |
| Knowledge search too slow at 10k+ chunks | MEDIUM | HIGH | Fix Day 5 — T5.1 |

**Verdict: Day 2 CAN begin with channel implementation, but T2.1 and T2.2 (webhook verification) MUST be the first two tasks completed before any channel is enabled in production.**

---

## Deliverables Checklist

| Deliverable | Status |
|---|---|
| `docs/reports/DAY1_DISCOVERY_REPORT.md` | ✅ Complete |
| `docs/architecture/CHANNEL_ARCHITECTURE.md` | ✅ Complete |
| `docs/architecture/MESSAGE_PIPELINE.md` | ✅ Complete |
| `docs/architecture/AI_ARCHITECTURE.md` | ✅ Complete |
| `docs/architecture/KNOWLEDGE_ARCHITECTURE.md` | ✅ Complete |
| `docs/architecture/SAAS_ARCHITECTURE.md` | ✅ Complete |
| `docs/reports/7_DAY_EXECUTION_BACKLOG.md` | ✅ Complete |
| `docs/reports/DAY1_FINAL_REPORT.md` | ✅ Complete (this file) |

**Day 1 is complete. Ready to proceed to Day 2.**

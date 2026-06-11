# 7-Day Execution Backlog
**Project:** ChatZi (newChatwotv1)
**Generated:** 2026-06-11

---

## Legend

- **Priority:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
- **Complexity:** XS (< 1h) | S (1-3h) | M (3-6h) | L (6-12h) | XL (1-2 days)
- **Status:** Day 1 = Architecture & Design (THIS DOC)

---

## Day 2 — Security Hardening & Channel Foundation

**Goal:** Fix all critical security holes. Complete WhatsApp. Begin Facebook.

---

### T2.1 — Fix WhatsApp webhook HMAC verification
- **Priority:** 🔴 Critical
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - Replace `return true` stub in `whatsappAdapter.verifyWebhook`
  - Read raw body before parsing JSON
  - Implement `verifySha256Hmac(rawBody, x-hub-signature-256, channel.config.appSecret)`
  - GET handler for hub verification challenge
- **Files:** `src/server/channels/providers/stubs.ts`, `src/app/api/channels/whatsapp/webhook/route.ts`

### T2.2 — Fix Facebook webhook HMAC verification
- **Priority:** 🔴 Critical
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - Same as T2.1 for Facebook
  - GET handler for hub challenge at `/api/channels/facebook/webhook`
- **Files:** `src/server/channels/providers/stubs.ts`, `src/app/api/channels/facebook/webhook/route.ts`

### T2.3 — Fix Super Admin role check
- **Priority:** 🔴 Critical
- **Complexity:** XS (1h)
- **Dependencies:** None
- **Details:**
  - Add `isSuperAdmin: Boolean` field to User model
  - Update `requirePlatformAdmin()` to check `isSuperAdmin` flag instead of `role === "admin"`
  - Migration: set `isSuperAdmin = true` for existing admin users via script
- **Files:** `src/lib/models/user.ts`, `src/lib/authz.ts`, `scripts/`

### T2.4 — Implement WhatsApp sendMessage (Meta Cloud API)
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** T2.1
- **Details:**
  - POST to `https://graph.facebook.com/v18.0/{phone_number_id}/messages`
  - Authorization: `Bearer {access_token}` from `channel.config.accessToken`
  - Support: text messages, template messages
  - Handle 24-hour messaging window enforcement
  - Parse delivery status from webhook status updates
- **Files:** `src/server/channels/providers/stubs.ts` → extract to `providers/whatsapp.ts`

### T2.5 — Add RBAC permission checks to inbox API routes
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** None
- **Details:**
  - Create `requirePermission(session, permission)` helper in `authz.ts`
  - Apply to: `/api/inbox/conversations/[id]/reply` → `inbox.reply`
  - Apply to: `/api/inbox/conversations/[id]/assignment` → `inbox.assign`
  - Apply to: `/api/knowledge/*` → `knowledge.manage`
  - Apply to: `/api/settings/*` → `settings.manage`
- **Files:** `src/lib/authz.ts`, `src/app/api/inbox/`, `src/app/api/knowledge/`

### T2.6 — Remove dev-mode channel fallback from production
- **Priority:** 🟠 High
- **Complexity:** XS (30min)
- **Dependencies:** None
- **Details:**
  - In `resolveInboundChannel()`, the `NODE_ENV !== "production"` fallback to first matching channel is a security bypass
  - Move to a strict lookup-only mode
  - Add proper logging when channel cannot be resolved
- **Files:** `src/server/channels/incomingPipeline.ts`

### T2.7 — Deduplicate /api/conversations vs /api/inbox/conversations
- **Priority:** 🟡 Medium
- **Complexity:** M (3h)
- **Dependencies:** None
- **Details:**
  - Audit both routes — identify which is actually used by the frontend
  - Deprecate unused route (keep one canonical path)
  - `/api/inbox/conversations` appears more complete — keep it
  - Add redirect/deprecation header to the old route
- **Files:** `src/app/api/conversations/`, `src/app/api/inbox/conversations/`

**Day 2 Estimated Effort:** ~18-20h

---

## Day 3 — WhatsApp Full + Facebook Full + Meta OAuth

**Goal:** WhatsApp and Facebook fully operational end-to-end.

---

### T3.1 — Complete Facebook sendMessage (Graph API)
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** T2.2
- **Details:**
  - POST to `https://graph.facebook.com/v18.0/me/messages`
  - `recipient: { id: externalUserId }`, `message: { text }`
  - Bearer token from `channel.config.pageAccessToken`
  - Delivery receipt parsing
- **Files:** `src/server/channels/providers/stubs.ts` → `providers/facebook.ts`

### T3.2 — Complete Meta OAuth flow
- **Priority:** 🟠 High
- **Complexity:** L (8h)
- **Dependencies:** T2.4, T3.1
- **Details:**
  - Complete `/api/oauth/meta/route.ts` — exchange code for access token
  - Fetch available pages: `/me/accounts`
  - For Instagram: fetch IG business accounts linked to pages
  - Auto-create Channel records with encrypted tokens
  - Subscribe webhooks for each page
  - UI feedback in `src/app/dashboard/channels/`
- **Files:** `src/app/api/oauth/meta/route.ts`, `src/app/dashboard/channels/`

### T3.3 — Move knowledge training to BullMQ job
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** None
- **Details:**
  - Create `knowledge-training-queue` in `src/lib/queues/index.ts`
  - Create `workers/knowledge-worker.ts`
  - `trainKnowledgeDocument` dispatches to queue instead of running inline
  - `retrainAllKnowledge` dispatches jobs in parallel (Promise.all with batch size)
  - Document status shows "processing" while queued
- **Files:** `src/lib/queues/index.ts`, `workers/knowledge-worker.ts`, `src/lib/knowledge.ts`

### T3.4 — Fix Tenant.plan vs TenantSubscription.planId inconsistency
- **Priority:** 🟡 Medium
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - Remove `plan` field from `Tenant` model or make it purely derived
  - Update all code reading `tenant.plan` to use `TenantSubscription`
  - OR keep `tenant.plan` as a denormalized cache, updated by billing events
- **Files:** `src/lib/models/tenant.ts`, `src/lib/billing.ts`, `src/lib/auth.ts`

### T3.5 — Fix embedding dimension mismatch in knowledge search
- **Priority:** 🟡 Medium
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - Filter KnowledgeChunk search by `embeddingProvider` matching the query embedding provider
  - When OpenAI key is added, flag all local-hash chunks as `needsRetraining = true`
  - Update `searchKnowledge` to skip chunks with incompatible dimensions
- **Files:** `src/lib/knowledge.ts`

**Day 3 Estimated Effort:** ~20-22h

---

## Day 4 — Instagram + AI Enhancement + Quota Fix

**Goal:** Instagram working. AI context + quota reliability improved.

---

### T4.1 — Complete Instagram adapter
- **Priority:** 🟠 High
- **Complexity:** L (8h)
- **Dependencies:** T3.2
- **Details:**
  - Instagram messaging uses same Meta Graph API as Facebook
  - Normalize incoming: `entry[0].messaging[0]` (DM) + reactions
  - sendMessage: POST to `/me/messages` with IG scoped user IDs
  - Handle 24-hour window for standard messaging
  - Story reply handling
- **Files:** `src/server/channels/providers/stubs.ts` → `providers/instagram.ts`

### T4.2 — Fix AI quota race condition (atomic counter)
- **Priority:** 🟠 High
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - Replace MongoDB read+increment with Redis INCR for `usedMessages`
  - Key: `quota:{tenantId}:{YYYY-MM}` → expires at end of billing period
  - `assertCanSendAiMessage` → `REDIS.GET quota:...`
  - `recordAiMessageUsage` → `REDIS.INCR quota:...`
  - Sync Redis counter back to MongoDB periodically (cron)
- **Files:** `src/lib/billing.ts`, new `src/lib/quota.ts`

### T4.3 — Improve AI context window (token-aware)
- **Priority:** 🟡 Medium
- **Complexity:** M (3h)
- **Dependencies:** None
- **Details:**
  - Replace `limit(10)` with token-based context window
  - Estimate tokens per message (already have `estimateTokens`)
  - Build context from most recent messages up to 4000 tokens
  - System prompt + knowledge prompt + context must fit in model limit
  - Add conversation summary for long conversations (>20 messages)
- **Files:** `src/lib/services/ai-agent.service.ts`, `src/lib/ai.ts`

### T4.4 — Separate AiProvider from AiModel (consolidate)
- **Priority:** 🟡 Medium
- **Complexity:** M (4h)
- **Dependencies:** None
- **Details:**
  - `AiProvider` is the new unified model — `AiModel` is legacy
  - Migrate existing `AiModel` records to `AiProvider` format
  - Update `ai-agent.service.ts` and `ai.ts` to use only `AiProvider`
  - Deprecate `AiModel` model (keep collection, stop writing to it)
- **Files:** `src/lib/services/ai-agent.service.ts`, `src/lib/ai.ts`, `scripts/`

### T4.5 — Implement SSE scaling via Redis pub/sub
- **Priority:** 🟡 Medium
- **Complexity:** M (4h)
- **Dependencies:** None
- **Details:**
  - Replace in-memory `EventEmitter` in `/api/inbox/stream` with Redis pub/sub
  - Channel: `inbox:{tenantId}:events`
  - Publish when: new message, conversation update, assignment change
  - Each SSE connection subscribes to tenant channel
  - Supports multi-pod deployment
- **Files:** `src/app/api/inbox/stream/route.ts`, new `src/lib/realtime.ts`

**Day 4 Estimated Effort:** ~21-22h

---

## Day 5 — Qdrant Integration + Lead/Ticket Foundation

**Goal:** Vector search with Qdrant. Lead/Ticket model created.

---

### T5.1 — Integrate Qdrant for vector search
- **Priority:** 🟠 High
- **Complexity:** L (8h)
- **Dependencies:** T3.3
- **Details:**
  - Install `@qdrant/js-client-rest`
  - Create `src/lib/qdrant.ts` client with collection management
  - Collection naming: `chatzi_{tenantId}_{botId}`
  - On chunk creation: `qdrant.upsert()` with payload
  - On chunk deletion: `qdrant.delete()`
  - `searchKnowledge` → `qdrant.search()` + keyword from MongoDB
  - Env vars: `QDRANT_URL`, `QDRANT_API_KEY`
- **Files:** `src/lib/qdrant.ts`, `src/lib/knowledge.ts`

### T5.2 — Migrate existing chunks to Qdrant
- **Priority:** 🟠 High
- **Complexity:** M (3h)
- **Dependencies:** T5.1
- **Details:**
  - One-time migration script: `scripts/migrate-chunks-to-qdrant.ts`
  - Batch upsert all KnowledgeChunk records to Qdrant
  - Filter: only chunks with `embeddingProvider: "openai"` (skip local-hash)
  - Progress logging
- **Files:** `scripts/migrate-chunks-to-qdrant.ts`

### T5.3 — Create Lead model
- **Priority:** 🟠 High
- **Complexity:** M (3h)
- **Dependencies:** None
- **Details:**
  ```typescript
  Lead {
    tenantId, contactId, conversationId,
    stage: "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
    value: number
    currency: string
    assignedTo: ObjectId → User
    sourceChannel: string
    tags: string[]
    customFields: Mixed
    dueAt: Date
    closedAt: Date
  }
  ```
  - API: `GET/POST /api/leads`, `PATCH /api/leads/[id]`
- **Files:** `src/lib/models/lead.ts`, `src/app/api/leads/`

### T5.4 — Create Ticket model
- **Priority:** 🟠 High
- **Complexity:** M (3h)
- **Dependencies:** None
- **Details:**
  ```typescript
  Ticket {
    tenantId, contactId, conversationId,
    title: string
    description: string
    status: "open" | "in_progress" | "pending" | "resolved" | "closed"
    priority: "low" | "medium" | "high" | "urgent"
    category: string
    assignedTo: ObjectId → User
    teamId: ObjectId → Team
    dueAt: Date
    resolvedAt: Date
    slaBreached: boolean
  }
  ```
  - API: `GET/POST /api/tickets`, `PATCH /api/tickets/[id]`
- **Files:** `src/lib/models/ticket.ts`, `src/app/api/tickets/`

### T5.5 — Implement Entitlement model
- **Priority:** 🟡 Medium
- **Complexity:** M (3h)
- **Dependencies:** None
- **Details:**
  - Create `Entitlement` model (see SAAS_ARCHITECTURE.md)
  - Populate on plan subscription
  - `checkEntitlement(tenantId, "max_channels")` helper
  - Enforce: max_channels check before Channel.create
  - Enforce: max_agents check before User.create (invite)
- **Files:** `src/lib/models/entitlement.ts`, `src/lib/entitlements.ts`

**Day 5 Estimated Effort:** ~20-22h

---

## Day 6 — Team Routing + Follow-Up + Cleanup Cron

**Goal:** Smart team routing. Auto follow-up. Operational cron jobs.

---

### T6.1 — Team-based conversation routing
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** None
- **Details:**
  - In `core-routing-worker.ts`: after AI insight, check `conversation.aiIntent`
  - Match intent keywords against `team.routingKeywords[]`
  - Auto-assign conversation to matching team
  - Notify team members via SSE
  - Fallback: unassigned pool if no match
- **Files:** `workers/core-routing-worker.ts`, new `src/lib/routing.ts`

### T6.2 — Implement auto follow-up worker
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** T3.3 (worker pattern)
- **Details:**
  - Create `followup-queue` in BullMQ
  - When conversation created: if `bot.autoFollowupEnabled`, schedule delayed job
  - Job checks: conversation still open, customer hasn't replied since
  - Generate follow-up message via AI (personalized)
  - Increment attempt counter; stop at `bot.followupMaxAttempts`
- **Files:** `src/lib/queues/index.ts`, `workers/followup-worker.ts`

### T6.3 — Auto-close conversations cron
- **Priority:** 🟡 Medium
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - `/api/cron/auto-close` endpoint (called by Vercel cron or external scheduler)
  - Find conversations: `status=open, bot.autoCloseEnabled=true, lastCustomerMessageAt > autoCloseAfterMinutes`
  - Send `bot.autoCloseMessage`, set status=closed
- **Files:** new `src/app/api/cron/auto-close/route.ts`

### T6.4 — Expired knowledge cleanup cron
- **Priority:** 🟡 Medium
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - `/api/cron/cleanup-expired-knowledge`
  - Delete KnowledgeChunk where `isTemporary=true AND expiresAt < now`
  - Mark KnowledgeDocument as "expired"
  - Delete from Qdrant collection (after T5.1)
- **Files:** new `src/app/api/cron/cleanup-expired-knowledge/route.ts`

### T6.5 — Fix Conversation.assigneeId vs assignedAgentId duplication
- **Priority:** 🟡 Medium
- **Complexity:** S (2h)
- **Dependencies:** None
- **Details:**
  - Standardize on `assignedAgentId` + `assignedTeamId`
  - Deprecate `assigneeId` + `teamId`
  - Update all reads/writes to use canonical fields
  - Write migration to copy `assigneeId → assignedAgentId` where needed
- **Files:** `src/lib/models/conversation.ts`, inbox API routes

### T6.6 — Configurable SLA rules
- **Priority:** 🟢 Low
- **Complexity:** M (4h)
- **Dependencies:** None
- **Details:**
  - Create `SlaPolicy` model per tenant
  - `firstResponseTarget: number` (minutes)
  - `resolutionTarget: number` (minutes)
  - Priority-based overrides
  - Update `incomingPipeline.ts` to use policy instead of hardcoded 15min/24h
- **Files:** `src/lib/models/sla-policy.ts`, `src/server/channels/incomingPipeline.ts`

**Day 6 Estimated Effort:** ~18-22h

---

## Day 7 — Membership System + Billing Hardening + Polish

**Goal:** User invitation system. Billing edge cases. Platform stability.

---

### T7.1 — User invitation system
- **Priority:** 🟠 High
- **Complexity:** L (8h)
- **Dependencies:** T2.3
- **Details:**
  - `POST /api/invitations` — create invitation token (email + role + tenantId)
  - Send invitation email (via Resend or Nodemailer)
  - `GET /api/invitations/[token]` — validate + show accept form
  - `POST /api/invitations/[token]/accept` — create User + join tenant
  - Invitation expiry (48h)
- **Files:** new `src/lib/models/invitation.ts`, `src/app/api/invitations/`

### T7.2 — Billing: enforce plan limits
- **Priority:** 🟠 High
- **Complexity:** M (4h)
- **Dependencies:** T5.5
- **Details:**
  - Before `Channel.create`: check `entitlement max_channels`
  - Before user invite: check `entitlement max_agents`
  - Return clear error messages with upgrade CTAs
  - Show limits in billing dashboard
- **Files:** `src/lib/entitlements.ts`, channel API, user API

### T7.3 — Add `isSuperAdmin` to all admin routes
- **Priority:** 🟠 High
- **Complexity:** S (2h)
- **Dependencies:** T2.3
- **Details:**
  - Update all `/api/admin/*` routes to use `isSuperAdmin` check
  - Update admin layout middleware to redirect non-super-admins
  - Audit all 14 admin API routes
- **Files:** `src/app/api/admin/*/route.ts`, `src/app/admin/layout.tsx`

### T7.4 — Billing cycle reset reliability
- **Priority:** 🟡 Medium
- **Complexity:** S (2h)
- **Dependencies:** T4.2
- **Details:**
  - Current: `usedMessages` reset in `handleInvoicePaymentSucceeded`
  - Also reset Redis quota counter on cycle reset
  - Handle case: Stripe webhook missed → sync via cron
  - `/api/cron/sync-subscriptions` already exists — extend it
- **Files:** `src/lib/billing.ts`, `src/app/api/cron/sync-subscriptions/route.ts`

### T7.5 — API documentation (OpenAPI spec)
- **Priority:** 🟢 Low
- **Complexity:** M (4h)
- **Dependencies:** All Day 2-6 routes stable
- **Details:**
  - Generate OpenAPI 3.0 spec for all public API routes
  - Especially: webhook endpoints (for channel setup docs)
  - Postman collection export
- **Files:** `docs/api/openapi.yaml`

### T7.6 — E2E smoke tests for critical flows
- **Priority:** 🟡 Medium
- **Complexity:** M (4h)
- **Dependencies:** All above
- **Details:**
  - Test: registration → tenant provisioning → bot creation
  - Test: Telegram webhook → message persisted → AI reply → egress
  - Test: billing checkout → subscription activated → quota works
  - Use existing `tests/` folder (Jest + Supertest)
- **Files:** `tests/`

**Day 7 Estimated Effort:** ~24-26h

---

## Summary Table

| Day | Theme | Tasks | Est. Hours |
|---|---|---|---|
| 1 | Architecture & Discovery | This document | 8h |
| 2 | Security + Channel Foundation | T2.1-T2.7 | 18-20h |
| 3 | WhatsApp Full + Facebook + Meta OAuth | T3.1-T3.5 | 20-22h |
| 4 | Instagram + AI Enhancement | T4.1-T4.5 | 21-22h |
| 5 | Qdrant + Lead/Ticket Models | T5.1-T5.5 | 20-22h |
| 6 | Team Routing + Follow-Up + Crons | T6.1-T6.6 | 18-22h |
| 7 | Membership + Billing + Polish | T7.1-T7.6 | 24-26h |
| **Total** | | | **129-142h** |

---

## Critical Path (Do Not Defer)

1. **T2.1 + T2.2** — WhatsApp/Facebook webhook security (must be done before going live)
2. **T2.3** — Super admin fix (security hole)
3. **T3.3** — Knowledge training async (prevents request timeouts in production)
4. **T4.2** — Quota race condition fix (prevents over-serving)
5. **T5.1** — Qdrant (knowledge search will not scale beyond ~5k chunks without it)

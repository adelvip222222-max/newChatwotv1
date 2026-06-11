# DAY 1 — Discovery Report
**Project:** ChatZi (newChatwotv1)
**Date:** 2026-06-11

---

## Current Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5.19 (App Router + Pages Router hybrid) |
| Runtime | Node.js, TypeScript 5.7 |
| Database | MongoDB (Mongoose ODM) |
| Auth | NextAuth v4 — Credentials + Google OAuth — JWT sessions |
| Queue | BullMQ 5.x (4 queues: ingress, core-routing, ai-processing, egress) |
| Cache/Broker | Redis (ioredis) |
| Realtime | SSE (Server-Sent Events) — `/api/inbox/stream` |
| AI | OpenAI SDK (multi-provider: OpenAI, OpenRouter, DeepSeek, xAI, Groq, Ollama) |
| Billing | Stripe (subscriptions + one-time message packs) |
| Storage | No object storage — files processed in-memory (Buffer) |
| Embeddings | OpenAI `text-embedding-3-small` or local hash fallback |
| Vector DB | **None** — cosine similarity computed in JavaScript in-memory (Qdrant NOT integrated) |
| PWA | Service Worker + Web App Manifest |
| i18n | Custom `i18n.ts` (Arabic primary) |

---

## Existing Domains

| Domain | Status | Location |
|---|---|---|
| Auth | ✅ Implemented | `src/lib/auth.ts`, `src/app/api/auth/` |
| Users | ✅ Implemented | `src/lib/models/user.ts`, `src/app/api/users/` |
| Tenants | ✅ Implemented | `src/lib/models/tenant.ts`, `src/lib/tenant-scope.ts` |
| Teams | ✅ Implemented | `src/lib/models/team.ts` |
| Bots | ✅ Implemented | `src/lib/models/bot.ts`, `src/app/api/bots/` |
| Channels | ✅ Partial | `src/lib/models/channel.ts`, `src/server/channels/` |
| Conversations | ✅ Implemented | `src/lib/models/conversation.ts`, `src/app/api/conversations/`, `src/app/api/inbox/conversations/` |
| Messages | ✅ Implemented | `src/lib/models/message.ts` |
| Contacts | ✅ Implemented | `src/lib/models/contact.ts`, `src/app/api/contacts/` |
| AI Personas | ✅ Implemented | `src/lib/models/ai-persona.ts`, `src/app/api/personas/` |
| AI Providers | ✅ Implemented | `src/lib/models/ai-provider.ts`, `src/lib/models/ai-model.ts` |
| Knowledge Base | ✅ Implemented | `src/lib/knowledge.ts`, `src/lib/models/knowledge-*.ts` |
| Billing | ✅ Implemented | `src/lib/billing.ts`, `src/lib/models/billing-plan.ts` |
| Admin | ✅ Implemented | `src/app/admin/`, `src/app/api/admin/` |
| Notifications | ✅ Partial | `src/app/api/notifications/` |
| Tasks | ✅ Partial | `src/lib/models/task.ts` |
| Leads/Tickets | ❌ Missing | Not modeled |
| Entitlements | ❌ Missing | Embedded in TenantSubscription only |
| Membership | ❌ Missing | Role embedded directly in User model |

---

## Existing Models

### Tenant
- **Purpose:** Multi-tenant root entity
- **Relations:** owns → Users, Channels, Conversations, Bots
- **Problems:** `plan` field (string) duplicates `TenantSubscription.planId` — source of truth ambiguity

### User
- **Purpose:** Platform user within a tenant
- **Relations:** belongs to Tenant, belongs to Teams (array), `ownerId` self-reference
- **Problems:**
  - Role embedded directly in User — no separate Membership/Role model
  - `ownerId` is confusing (points to self for owners, to the creator for sub-users — undocumented)
  - No `superAdmin` boolean — platform admin concept leaks through role=`admin`

### Team
- **Purpose:** Group of agents within a tenant
- **Relations:** belongs to Tenant, has `memberIds[]` → Users
- **Problems:** Members stored as embedded array — hard to query "all teams for a user" efficiently

### Bot
- **Purpose:** AI bot entity with knowledge & follow-up config
- **Relations:** belongs to Tenant, has Channels, Knowledge
- **Problems:** Conflates AI config (confidence thresholds) with operational config (auto-close) in one model

### Channel
- **Purpose:** Communication channel connection (Telegram, WhatsApp, etc.)
- **Relations:** belongs to Tenant + Bot, has ChannelIdentities
- **Problems:** `config` is `Schema.Types.Mixed` — no validation, no encryption at schema level for sensitive keys

### ChannelIdentity
- **Purpose:** Maps external user IDs to internal Contacts per channel
- **Relations:** belongs to Tenant + Channel + Contact
- **Problems:** None critical

### Conversation
- **Purpose:** A support thread between contact and tenant
- **Relations:** belongs to Tenant, Bot, Contact, ChannelIdentity, Team, User (assignee)
- **Problems:**
  - BOTH `assigneeId` AND `assignedAgentId` exist — duplicate, causes confusion
  - BOTH `teamId` AND `assignedTeamId` exist — duplicate
  - SLA fields (firstResponseDueAt, etc.) hardcoded to 15min/24h in pipeline — not configurable

### Message
- **Purpose:** Individual message in a conversation
- **Relations:** belongs to Tenant, Conversation, Contact, ChannelIdentity
- **Problems:**
  - `sender` and `senderType` overlap in meaning — one field is sufficient
  - No index on `conversationId + createdAt` compound (exists but no DESC index)

### Contact
- **Purpose:** A customer/lead in the system
- **Relations:** belongs to Tenant, linked via ChannelIdentity
- **Problems:**
  - No `Lead` / `Ticket` model separate from Contact
  - `lifecycleStage` default is "lead" but no lead pipeline tracking

### KnowledgeDocument / KnowledgeChunk / KnowledgeCategory / KnowledgeCollection
- **Purpose:** 4-level knowledge taxonomy for RAG
- **Relations:** Tenant → Category → Collection → Document → Chunks
- **Problems:**
  - Embeddings stored as `Number[]` array IN MongoDB — O(n) in-memory cosine similarity
  - No Qdrant integration despite being in the roadmap
  - `embeddingDimensions = 128` (local hash) but OpenAI embeddings are 1536-dim — mismatch

### AiPersona / AiProvider / AiModel / AiSetting
- **Purpose:** Multi-model AI configuration per tenant
- **Relations:** AiPersona → AiModel; AiProvider is global
- **Problems:**
  - Both `AiProvider` (new) and `AiModel` (legacy) models exist — dual provider resolution in `ai-agent.service.ts`
  - Priority-based provider selection does not account for per-tenant provider preferences

### BillingPlan
- **Purpose:** Subscription plan catalog
- **Relations:** global or per-tenant (optional tenantId)
- **Problems:** Optional `tenantId` on a plan creates an ambiguous global/per-tenant plan concept

### TenantSubscription
- **Purpose:** Active subscription per tenant
- **Relations:** belongs to Tenant, references BillingPlan
- **Problems:**
  - No `Entitlement` model — limits baked into `monthlyMessageLimit` only
  - `usedMessages` counter has no atomic reset guarantee across workers

### MessagePack / PaymentEvent
- **Purpose:** One-time credit packs + payment audit log
- **Problems:** None critical

### Task / SavedReply / ConversationNote / ConversationEvent / ConversationInsight
- **Purpose:** Operational inbox features
- **Problems:** Task model has no relation to Lead/Ticket — disconnected from CRM pipeline

---

## Existing APIs

| Route | Purpose | Auth | Problems |
|---|---|---|---|
| `POST /api/auth/register` | User registration + tenant creation | Public | No email verification |
| `GET/POST /api/bots` | CRUD bots | Session | OK |
| `GET/POST /api/conversations` | List/create conversations | Session | Duplicated by `/api/inbox/conversations` |
| `GET/POST /api/inbox/conversations` | Inbox-specific conversation CRUD | Session | Duplicate of above |
| `POST /api/inbox/conversations/[id]/reply` | Send agent reply | Session | No permission check (inbox.reply) |
| `GET /api/inbox/stream` | SSE realtime stream | Session | In-memory event bus — not scalable across pods |
| `POST /api/channels/telegram/webhook` | Telegram inbound | Webhook secret | OK |
| `POST /api/channels/whatsapp/webhook` | WhatsApp inbound | **Always returns true** | CRITICAL: No signature verification |
| `POST /api/channels/facebook/webhook` | Facebook inbound | **Always returns true** | CRITICAL: No signature verification |
| `POST /api/knowledge` | Upload knowledge document | Session | File processed synchronously in request |
| `POST /api/knowledge/retrain` | Retrain all documents | Session | Runs synchronously — can timeout |
| `POST /api/billing/checkout` | Stripe checkout | Session | OK |
| `POST /api/billing/stripe/webhook` | Stripe events | Stripe signature | OK |
| `GET/POST /api/admin/*` | Super admin CRUD | Session + role=admin | `requirePlatformAdmin` only checks role=admin, not role=owner — inconsistent with tenant admin |
| `POST /api/ai/route` | Legacy AI routing | Session | Bypasses queue system |

---

## Existing Integrations

| Integration | Status | Notes |
|---|---|---|
| Telegram | ✅ Implemented | Full: webhook verify, normalize, sendMessage |
| WhatsApp (Meta) | ⚠️ Partial | Normalize: ✅, sendMessage: stub returns `{success:true}`, no HMAC verify |
| Facebook Messenger | ⚠️ Partial | Normalize: ✅, sendMessage: stub, verify always returns true |
| Instagram | ❌ Stub | All methods are no-ops |
| Email | ❌ Stub | All methods are no-ops |
| Stripe | ✅ Implemented | Checkout, subscriptions, webhooks, portal |
| OpenAI | ✅ Implemented | Chat completions + embeddings |
| OpenRouter / DeepSeek / xAI / Groq / Ollama | ✅ Implemented | Via OpenAI-compatible SDK |
| Qdrant | ❌ Missing | Mentioned in roadmap, not integrated |
| Google OAuth | ✅ Implemented | Via NextAuth Google provider |
| Meta OAuth (Facebook/Instagram) | ⚠️ Partial | `/api/oauth/meta/route.ts` exists, flow incomplete |

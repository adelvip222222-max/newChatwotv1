# SaaS Architecture
**Project:** ChatZi
**Date:** 2026-06-11

---

## Overview

ChatZi is a multi-tenant SaaS platform. Each tenant is an isolated workspace with its own users, channels, conversations, AI configuration, and billing.

---

## Tenant Model

```
Tenant {
  name: string          // "Acme Co's Workspace"
  slug: string          // "acme-co-workspace-a1b2c" (unique, URL-safe)
  ownerId: ObjectId     // → User (the first user who registered)
  plan: string          // "free" (DENORMALIZED from TenantSubscription — source of truth ambiguity)
  isActive: boolean
}
```

**Tenant Isolation:** Every resource (User, Channel, Conversation, Message, Contact, Knowledge, Bot) is scoped by `tenantId`. All queries require `tenantId` filter. `tenant-scope.ts` provides helpers for enforcing this.

**Known Issue:** `Tenant.plan` (string) and `TenantSubscription.planId` are two separate sources of truth. Must normalize to use only `TenantSubscription`.

---

## User & Membership

### Current Model
Role is embedded directly in the User document:
```
User {
  tenantId: ObjectId    // which tenant
  role: "owner" | "admin" | "manager" | "agent" | "viewer"
  teams: ObjectId[]     // team memberships (embedded array)
  ownerId: ObjectId     // self for owner; creator for sub-users
}
```

**Problem:** A user can only belong to ONE tenant. There is no Membership model. This prevents:
- Agency use-case (one user managing multiple tenants)
- Invitation flow tracking
- Role per-tenant vs global role separation

### Target Model (Recommended)

```
User {
  email, name, password, isActive
  isSuperAdmin: boolean   // platform-level flag
}

Membership {
  userId: ObjectId → User
  tenantId: ObjectId → Tenant
  role: "owner" | "admin" | "manager" | "agent" | "viewer"
  invitedBy: ObjectId → User
  invitedAt: Date
  acceptedAt: Date
  isActive: boolean
}
```

This migration is a Day 6+ task. Keep existing model until then.

---

## Roles & Permissions

### Role Hierarchy
```
owner     → All permissions (same as admin, designated first user)
admin     → All permissions
manager   → contacts:rw, inbox:rw+assign+manage, teams:rw, ai:r, knowledge:rw, reports:r, settings:r
agent     → contacts:r, inbox:r+reply, knowledge:rw, ai:r, settings:r
viewer    → contacts:r, inbox:r, teams:r, ai:r, knowledge:r, reports:r, billing:r, settings:r
```

### Permission System
Defined in `src/server/permissions/permissions.ts`:
```
contacts.read/write/delete
companies.read/write/delete
inbox.read/reply/assign/manage
teams.read/write
ai.read/manage
knowledge.read/manage
automations.read/manage
reports.read
billing.read/manage
settings.read/manage
```

`roleHasPermission(role, permission)` is available but **not enforced** at API route level.

**Critical Gap:** API routes use only `requireSession()` (checks logged in) or `requireAdmin()` (checks owner|admin). No permission-level checks like `requirePermission(session, "inbox.reply")`.

---

## Plans & Subscriptions

### BillingPlan
```
BillingPlan {
  name: "Free" | "Starter" | "Pro" | "Business" (admin-defined)
  interval: "month" | "year"
  priceCents: number
  aiMessageLimit: number   // monthly AI message quota
  stripePriceId: string
  createdByAdmin: boolean  // only admin-created plans are public
  isPopular: boolean
  isActive: boolean
  tenantId?: ObjectId      // optional: plan scoped to specific tenant (custom plan)
}
```

### MessagePack (one-time credits)
```
MessagePack {
  name: string
  messageCredits: number
  priceCents: number
  sortOrder: number
  stripePriceId: string
  createdByAdmin: boolean
}
```

### TenantSubscription
```
TenantSubscription {
  tenantId: ObjectId (unique — one subscription per tenant)
  planId: ObjectId → BillingPlan
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: "active" | "inactive" | "past_due" | "canceled" | "trialing"
  currentPeriodEnd: Date
  monthlyMessageLimit: number   // copied from plan at subscription time
  usedMessages: number          // incremented per AI message
  extraMessageCredits: number   // from purchased packs
}
```

### Entitlements Gap
Currently, entitlements are only `monthlyMessageLimit`. Missing:
- Max channels per tenant
- Max agents (seats) per tenant
- Max bots per tenant
- Feature flags (knowledge base enabled, advanced AI enabled, etc.)

**Recommended Entitlement Model:**
```typescript
Entitlement {
  tenantId: ObjectId
  planId: ObjectId
  key: string    // "max_channels" | "max_agents" | "max_bots" | "knowledge_enabled" | etc.
  value: number | boolean | string
  source: "plan" | "override"  // override for custom enterprise deals
}
```

---

## Super Admin

### Current Implementation
The "super admin" concept is confused:
- `authz.ts: requireAdmin()` → checks `role === "admin" || role === "owner"` (tenant-level admin)
- `authz.ts: requirePlatformAdmin()` → checks `role === "admin"` only (inconsistent)
- Super admin pages at `/admin/` use `requirePlatformAdmin()`
- There is no global super-admin user separate from tenants

**Problem:** Any tenant "admin" can access `/admin/` routes if they know the URL. No `isSuperAdmin` flag or separate super-admin tenant.

### Target Super Admin Model
```
User.isSuperAdmin: boolean  // platform-level flag
  → true for Replit/ops team accounts only
  → has access to /admin/* routes regardless of tenant
  → can impersonate any tenant (read-only)
  → can create/modify global plans
  → can cancel any subscription
  → can deactivate any tenant
```

Super admin pages should verify `session.user.isSuperAdmin === true`, not role.

---

## Tenant Lifecycle

```
Registration / OAuth Sign-in
        │
        ▼ [Auto-provisioning]
        │  Tenant.create({ name, slug, ownerId })
        │  User.create({ role: "owner", tenantId })
        │  Bot.create({ name: "ChatZi Bot", tenantId })
        │  TenantSubscription.create({ planId: FreePlan, status: active })
        │
        ▼ [Active State]
        │  Tenant uses platform within Free plan limits
        │
        ▼ [Upgrade]
        │  Stripe Checkout → plan subscription
        │  TenantSubscription updated via Stripe webhook
        │
        ▼ [Suspension]
        │  Tenant.isActive = false (manual by super admin)
        │  OR subscription.status = "past_due" (payment failed)
        │  → middleware blocks all API access
        │
        ▼ [Deletion]
           (Not implemented — soft-delete only via isActive flag)
```

---

## Tenant Isolation Guarantees

| Layer | Enforcement | Status |
|---|---|---|
| Database queries | `tenantId` filter on all queries | ✅ Done in most places |
| API routes | `requireSession()` + `tenantId` from JWT | ✅ |
| Webhook ingress | Channel lookup by tenantId | ✅ |
| Knowledge search | `tenantId + botId` filter | ✅ |
| Admin routes | `requirePlatformAdmin()` | ⚠️ Broken — checks wrong role |
| Super admin isolation | Separate `isSuperAdmin` flag | ❌ Missing |
| Cross-tenant reads | No explicit cross-tenant guard | ⚠️ Rely on query scoping only |

---

## Scaling Considerations

| Component | Current Limit | Fix Required |
|---|---|---|
| SSE realtime | In-memory — 1 server only | Redis pub/sub or Socket.io + Redis adapter |
| Worker heartbeats | Redis key per worker | Already scalable |
| AI quota counters | MongoDB `$inc` — race condition | Redis INCR with TTL for atomic counting |
| Stripe webhooks | Idempotency via PaymentEvent | ✅ Already handled |
| BullMQ | Redis-backed — horizontally scalable | ✅ Already handled |

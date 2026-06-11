# RBAC Enforcement — ChatZi Platform

## Overview

ChatZi enforces two orthogonal authorization layers:

| Layer | Guard | Applied To |
|-------|-------|------------|
| **Tenant RBAC** | `requirePermission(permission)` | All tenant-scoped API routes |
| **Super Admin** | `requireSuperAdmin()` | All `/api/admin/*` routes |

---

## Role Hierarchy (Tenant Scope)

```
owner  >  admin  >  agent  >  viewer
```

| Permission Key | owner | admin | agent | viewer |
|---|:---:|:---:|:---:|:---:|
| `inbox:reply` | ✅ | ✅ | ✅ | ❌ |
| `inbox:assign` | ✅ | ✅ | ❌ | ❌ |
| `inbox:view` | ✅ | ✅ | ✅ | ✅ |
| `knowledge:manage` | ✅ | ✅ | ❌ | ❌ |
| `bots:manage` | ✅ | ✅ | ❌ | ❌ |
| `channels:manage` | ✅ | ✅ | ❌ | ❌ |
| `settings:manage` | ✅ | ✅ | ❌ | ❌ |
| `billing:manage` | ✅ | ❌ | ❌ | ❌ |

Defined in: `src/server/permissions/permissions.ts` and `src/server/permissions/roles.ts`

---

## Guard Functions Reference

### `requirePermission(permission: Permission)` — `src/server/auth/guards.ts`

Used in all tenant-scoped routes that modify or read sensitive data.

Call chain:
1. `requireActiveUser()` — verifies JWT session + active user in DB
2. `roleHasPermission(session.user.role, permission)` — checks the role matrix

**Throws** with HTTP 400 (wrapped in catch) if:
- Session missing → "Authentication is required."
- No tenantId → "Tenant access is required."
- User not active in DB → "Active user access is required."
- Role lacks permission → "Permission required: {permission}"

### `requireSuperAdmin()` — `src/server/auth/guards.ts`

Used exclusively in `/api/admin/*` routes.

Logic:
1. JWT fast path — if `session.user.isSuperAdmin === true`, allow immediately.
2. DB slow path — fresh lookup of `User.isSuperAdmin` field to catch revoked flags.

### `requireAdmin()` — `src/lib/authz.ts`

Used in routes that require tenant-level admin role (`owner` or `admin`).

---

## Super Admin vs Tenant Admin

| Concept | `isSuperAdmin` | `role: "admin" / "owner"` |
|---------|:-:|:-:|
| Cross-tenant platform access | ✅ | ❌ |
| Manage all billing plans | ✅ | ❌ |
| Manage all AI models | ✅ | ❌ |
| Within-tenant operations | ✅ (all) | ✅ (scoped) |
| Normal business operations | ✅ (all) | per role matrix |

Super admins have all capabilities but **should still be scoped by `tenantId`** in queries to avoid accidental cross-tenant data mutations.

---

## Settings Routes — Known Gap (Day 3)

`/api/settings/tenant` and `/api/settings/ai` currently use inline `isAdminRole()` checks rather than `requirePermission()`. These should be migrated in Day 3:

```typescript
// Before (fragile)
if (!isAdminRole(session.user.role)) { ... }

// After (correct)
const session = await requirePermission(permissions.settingsManage);
```

---

## How to Promote a Super Admin

```bash
npx ts-node -r tsconfig-paths/register scripts/make-super-admin.ts user@example.com
```

The user must log out and log back in for the JWT to reflect the new flag.

---

## Adding a New Protected Route

```typescript
// Tenant-scoped route
import { requirePermission } from "@/server/auth/guards";
import { permissions } from "@/server/permissions/permissions";

export async function POST(request: Request) {
  const session = await requirePermission(permissions.botsManage);
  // session.user.tenantId is guaranteed here
}

// Admin-only route
import { requireSuperAdmin } from "@/server/auth/guards";

export async function POST(request: Request) {
  await requireSuperAdmin();
}
```

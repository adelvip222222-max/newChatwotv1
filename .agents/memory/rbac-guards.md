---
name: RBAC Guards Map
description: Which guard function to use for which type of route in ChatZi
---

## Guard Selection

| Route type | Guard | File |
|-----------|-------|------|
| Platform admin (`/api/admin/*`) | `requireSuperAdmin()` | `src/server/auth/guards.ts` |
| Tenant-scoped with permission | `requirePermission(permissions.X)` | `src/server/auth/guards.ts` |
| Tenant admin only | `requireAdmin()` | `src/lib/authz.ts` |
| Any authenticated user | `requireAuth()` / `requireSession()` | `src/server/auth/guards.ts` / `src/lib/auth.ts` |

## Known Gap (Day 3)
- `/api/settings/tenant` and `/api/settings/ai` use inline `isAdminRole()` checks — should migrate to `requirePermission(permissions.settingsManage)`
- `/api/admin/ai-providers` uses `requireAdmin()` (tenant admin) — product decision needed on whether this should be `requireSuperAdmin()`
- Health routes (`/api/health/*`) use `requireAdmin()` — acceptable for internal monitoring

## Permissions are defined in
`src/server/permissions/permissions.ts` — permission keys
`src/server/permissions/roles.ts` — role → permission matrix

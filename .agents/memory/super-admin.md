---
name: Super Admin System
description: How isSuperAdmin is stored, propagated, and enforced in ChatZi
---

## Rule
All `/api/admin/*` routes must use `requireSuperAdmin()` from `src/server/auth/guards.ts`.
Never use `requirePlatformAdmin()` from `authz.ts` for admin routes — that function is kept for backward compat only.

**Why:** Previously `requirePlatformAdmin()` checked `role === "admin"`, meaning any tenant admin could reach platform admin routes. The `isSuperAdmin` boolean is decoupled from tenant roles.

## How to apply
- New `/api/admin/*` route → import `requireSuperAdmin` from `@/server/auth/guards`
- Promote a user: `npx ts-node -r tsconfig-paths/register scripts/make-super-admin.ts email@example.com`
- User must re-login for JWT to reflect new flag (JWT-cached; DB-verified on mismatch)

## JWT propagation
- Credentials provider: `(user as any).isSuperAdmin === true` (Mongoose lean doesn't type this)
- OAuth provider: hardcoded `false` — super admins must be set explicitly via script
- JWT callback: `token.isSuperAdmin = user.isSuperAdmin === true`
- Session callback: `session.user.isSuperAdmin = token.isSuperAdmin === true`

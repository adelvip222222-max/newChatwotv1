# DAY 3 — RBAC Decisions

## Routes Migrated

### `/api/settings/ai`
- **Before:** `requireAdmin()` (checked `isAdminRole(role)` — owner/admin)
- **After:** `requirePermission(permissions.aiManage)` = `"ai.manage"`
- **Rationale:** `ai.manage` is the correct semantic permission for AI configuration. It is only granted to owner and admin roles (same net effect), but this ties the enforcement to the RBAC permission graph instead of a role-name string. If the permission is later granted to managers, no route code changes needed.

### `/api/settings/tenant`
- **Before:** Inline `isAdminRole()` check after `requireSession()`
- **After:** `requirePermission(permissions.settingsManage)` = `"settings.manage"`
- **Rationale:** `settings.manage` is restricted to owner/admin. Inline role checks bypass the RBAC system and create drift risk.

### `/api/admin/ai-providers`
- **Before:** `requireAdmin()` — allowed any tenant owner/admin to manage platform-level AI providers
- **After:** `requireSuperAdmin()` — restricts to platform super-admins only
- **Decision:** This route manages global `AiProvider` records with no `tenantId` — they are **platform-scoped**, not tenant-scoped. Allowing tenant admins to modify platform-level provider configs is a privilege escalation risk.
- **Documented in:** `docs/architecture/RBAC_ENFORCEMENT.md`

## Permission Matrix

| Route | Permission | Owner | Admin | Manager | Agent | Viewer |
|-------|-----------|-------|-------|---------|-------|--------|
| `POST /api/settings/ai` | `ai.manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PUT /api/settings/tenant` | `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `POST /api/admin/ai-providers` | superAdmin | ✅* | ❌ | ❌ | ❌ | ❌ |
| `GET /api/oauth/meta/start` | `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `GET /api/oauth/meta/pages` | `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `POST /api/oauth/meta/connect` | `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `GET /api/knowledge/documents/[id]/status` | `knowledge.read` | ✅ | ✅ | ✅ | ✅ | ✅ |

*Only if `isSuperAdmin: true` on User document

## Principles Applied

1. **Permission over role**: Routes check semantic permissions, not role names directly.
2. **Platform vs tenant scope**: Platform-level config (`AiProvider`, `AiModel` with no tenant) is gated by `requireSuperAdmin()`. Tenant-level config is gated by tenant-scoped permissions.
3. **No inline checks**: All auth enforcement passes through `requirePermission()` or `requireSuperAdmin()` — never inline `role === "admin"` or `isAdminRole()`.
4. **Principle of least privilege**: Knowledge status check uses `knowledge.read` (wide access) not `knowledge.manage` (restricted), since reading status is needed by agents monitoring their AI's KB.

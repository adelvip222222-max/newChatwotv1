# Developer Panel & Super-Admin Middleware Report

## Summary

This change hardens platform-level access and adds a protected Developer Panel for operational visibility and safe maintenance actions.

## Implemented

### 1. Super-admin middleware hardening

Updated:

- `src/middleware.ts`

Protected paths now require `token.isSuperAdmin === true`:

- `/admin`
- `/admin/*`
- `/api/admin/*`
- `/developer`
- `/developer/*`
- `/api/developer/*`

Non-super-admin users are redirected to `/dashboard` for pages and receive `403` for protected APIs.

Important note: `isSuperAdmin` is stored in the NextAuth JWT. If a user is promoted to super-admin while already logged in, they should sign out and sign in again to refresh the token.

### 2. Developer Panel UI

Created:

- `src/app/developer/layout.tsx`
- `src/app/developer/page.tsx`
- `src/components/developer/developer-panel.tsx`

The panel shows:

- CPU cores and load average
- RAM usage
- Node.js process memory and uptime
- Disk usage
- MongoDB database stats
- Redis health and latency
- PM2 process status
- Latest database backups
- Maintenance actions

### 3. Developer APIs

Created:

- `src/app/api/developer/metrics/route.ts`
- `src/app/api/developer/backup/route.ts`
- `src/app/api/developer/backups/route.ts`
- `src/app/api/developer/backups/[name]/route.ts`
- `src/app/api/developer/restart/route.ts`

All endpoints call `requireSuperAdmin()` before performing any action.

### 4. Operations layer

Created:

- `src/lib/developer/operations.ts`

Capabilities:

- Collect system metrics using Node `os` and process APIs.
- Read disk usage safely with `df -kP`.
- Read MongoDB `db.stats()`.
- Ping Redis through the existing Redis connection helper.
- Read PM2 status using `pm2 jlist`.
- Create compressed JSON database backups without shelling out to `mongodump`.
- Download backups with path traversal protection.
- Restart PM2 processes through an allowlisted target list only.

### 5. Safe restart controls

Restart is disabled by default.

To enable it on the server:

```bash
DEVELOPER_PANEL_ALLOW_RESTART=true
```

Supported restart targets only:

- `web`
- `workers`
- `all`

No arbitrary shell commands are accepted from the frontend.

### 6. Backup storage

Default backup directory:

```txt
backups/mongo
```

Override with:

```bash
DEVELOPER_BACKUP_DIR=/secure/path/chatzi-backups
```

Added `.gitignore` entries:

- `backups/`
- `*.dump`
- `*.archive`

## Security notes

- No environment secrets are displayed.
- No API keys are displayed.
- Restart API requires explicit confirmation string `RESTART`.
- Download API validates backup filenames and prevents path traversal.
- Restart is disabled unless explicitly enabled by environment variable.
- PM2 operations are allowlisted and do not accept arbitrary process names or commands.

## Manual test checklist

1. Login as a normal owner/admin user.
2. Visit `/admin` and confirm redirect to `/dashboard`.
3. Visit `/developer` and confirm redirect to `/dashboard`.
4. Call `/api/admin/users` and confirm 403 if not super-admin.
5. Call `/api/developer/metrics` and confirm 403 if not super-admin.
6. Login as `isSuperAdmin: true` user.
7. Visit `/admin` and confirm access.
8. Visit `/developer` and confirm metrics load.
9. Click refresh and confirm metrics update.
10. Create database backup and confirm it appears in the backup list.
11. Download the backup and confirm file downloads as `.json.gz`.
12. Keep restart disabled and confirm restart buttons are disabled.
13. Set `DEVELOPER_PANEL_ALLOW_RESTART=true`, restart app manually, and confirm restart controls become active.

## Known limitations

- Database backup is JSON-based and intended for operational snapshots. For very large production databases, a proper `mongodump` or managed MongoDB snapshot strategy is still recommended.
- PM2 metrics require the app user to have access to the `pm2` binary and PM2 process list.
- Disk usage uses `df`, so Windows environments may show disk status as unavailable.
- Super-admin status in middleware depends on the NextAuth JWT and requires re-login after promotion.

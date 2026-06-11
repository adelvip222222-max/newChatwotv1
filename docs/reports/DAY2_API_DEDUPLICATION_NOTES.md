# Day 2 — API Deduplication Notes

## Duplicate Conversation Endpoints

Two endpoints currently serve conversation data:

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/conversations` | **Deprecated** | Legacy, minimal — returns paginated list only |
| `GET /api/inbox/conversations` | **Active** | Full inbox view with filters, unread counts, assignment data |

### Deprecation Headers Added

`GET /api/conversations` now returns:
```
Deprecation: true
Link: </api/inbox/conversations>; rel="successor-version"
```

### Migration Path

All frontend code should switch to `/api/inbox/conversations`. The deprecated endpoint will be removed in a future release (planned Day 5 cleanup).

The `/api/inbox/conversations` endpoint supports all parameters from the deprecated route plus additional filters:
- `?status=open|resolved|pending|all`
- `?mode=all|assigned|unassigned|mine`
- `?priority=urgent|high|normal|low|all`
- `?unread=1`
- `?q=<search term>`
- `?limit=<n>&offset=<n>`

---

## Admin AI Provider vs AI Model

Two overlapping admin endpoints for AI configuration:

| Endpoint | Model | Purpose |
|----------|-------|---------|
| `POST /api/admin/ai-providers` | `AiProvider` | Platform-level provider config (OpenAI, Anthropic…) |
| `POST /api/admin/ai-models` | `AiModel` | Tenant-scoped model instances with custom base URLs |

These serve different purposes and should not be merged. `ai-providers` is a platform singleton per provider; `ai-models` allows multiple instances per tenant.

---

## Health Route Fragmentation

The `/api/health/*` sub-routes (mongo, redis, queues, workers, failed-jobs) are separate files. This is intentional — each probe should be independently callable to allow targeted health checks in monitoring. No deduplication needed.

---

## Recommendations

1. **Remove `/api/conversations` in Day 5** after confirming no frontend usage.
2. **Consolidate channel config routes** — currently `/api/channels/config` handles all providers but the Meta-specific routes (`/api/channels/meta/accounts`, `/api/channels/telegram/setup`) are separate. Consider a unified `/api/channels/{id}/configure` pattern.
3. **Worker health endpoints** — `/api/health/workers` and `/api/health/queues` overlap. Merge into `/api/health/queues` with per-queue worker status.

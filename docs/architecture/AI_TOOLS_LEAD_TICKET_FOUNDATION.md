# AI Tools — Lead & Ticket Extraction Foundation

## Overview

Day 4 expands the AI tools registry (`src/lib/ai/tools-registry.ts`) with
structured extraction tools that Day 5 will wire to full Lead and Ticket models.

---

## Tools Added

### `save_lead_data`

**Purpose**: Extract and persist lead qualification data from a conversation.

**Behavior**: Idempotent — upserts by `(tenantId, contactId, type="lead")`.
If a lead Task already exists for this contact, it is updated, not duplicated.

**Fields**:
- `name` (required)
- `email`, `phone`, `company`, `interest`, `notes` (optional)
- `score` — AI-assigned lead quality score 0–100

**Storage**: `Task` collection, `type: "lead"`. Will be migrated to a dedicated
`Lead` model in Day 5.

---

### `create_ticket`

**Purpose**: Create a support ticket when the AI cannot resolve the issue.

**Behavior**:
- Checks for existing open ticket on the same conversation first
- If one exists: returns its ID (idempotent — no duplicate created)
- If not: creates `Task` with `type: "ticket"`

**Fields**: `title` (required), `description` (required), `priority` (low/medium/high/urgent), `category`

**Storage**: `Task` collection, `type: "ticket"`. Will be extended with a full
`Ticket` model (status, assignee, SLA) in Day 5.

---

### `update_contact_profile`

**Purpose**: Update confirmed contact information within the conversation.

**Behavior**:
- No-ops if no `contactId` in context
- Only updates fields explicitly provided
- `customFields` are merged (not replaced) using dot-notation keys
- Gracefully handles missing `Contact` model (returns safe message for Day 5 migration)

---

### `save_extracted_data` (legacy, kept)

**Purpose**: Generic data extraction → Task. Kept for backward compatibility.
New AI agents should prefer `save_lead_data` or `create_ticket` for typed extraction.

---

### `escalate_to_human` (unchanged)

Pauses AI, sets `conversation.mode = "human"`, triggers SMS callback if configured.

---

## Tool Context Contract

All tool executors receive:

```typescript
type ToolContext = {
  tenantId: string;       // always present — required for isolation
  conversationId: string; // always present
  contactId?: string;     // optional — may not be set for anonymous channels
  conversation?: any;     // Mongoose document — for escalate_to_human
  sendSmsCallback?: Function; // for escalate_to_human
};
```

All data stored by tools is tagged with `tenantId` + `conversationId`.
No tool stores data without tenant scoping.

---

## Day 5 Migration Plan

| Current (Day 4) | Day 5 Target |
|-----------------|-------------|
| `Task { type: "lead" }` | `Lead` model with pipeline stages, score, attribution |
| `Task { type: "ticket" }` | `Ticket` model with SLA, status workflow, assignment |
| `update_contact_profile` best-effort | `Contact` model update with validation |

The tools interface and contract will remain identical — Day 5 only changes the
underlying storage, not the AI-facing API.

---

## AI Provider Resolution (Task 4.6 Analysis)

### Current State

| Model | Purpose | Scope |
|-------|---------|-------|
| `AiProvider` | System-level provider config (OpenAI, Anthropic, Gemini…) | Global |
| `AiModel` | Legacy per-tenant model config (name → provider + model string) | Per-tenant |

`ai-router.ts` already uses `AiProvider` as the primary source. `AiModel` is
only referenced in legacy code paths and the `AiSetting` settings panel.

### Decision: Keep Both, Document the Hierarchy

**Why not migrate now**: Removing `AiModel` would break existing tenants who have
per-tenant model overrides. The migration requires a data migration script and
testing each tenant's AI behavior.

**Compatibility layer (Day 5/6)**:
```
AiProvider (global) → primary routing
AiModel (per-tenant) → per-bot override (if botId matches an AiModel entry)
```

See `docs/reports/DAY4_FINAL_REPORT.md` for the full migration plan.

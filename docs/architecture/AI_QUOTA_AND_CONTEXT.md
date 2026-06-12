# AI Quota and Context Window — Architecture

## Overview

Two critical improvements made in Day 4:

1. **Atomic quota enforcement** via Redis INCR (eliminates race condition)
2. **Token-aware context window** (eliminates context overflow errors)

---

## AI Quota: Race Condition Fix

### Problem (Before Day 4)

```
Worker A: assertCanSendAiMessage() → usedMessages=99, limit=100 → OK
Worker B: assertCanSendAiMessage() → usedMessages=99, limit=100 → OK  ← race
Worker A: recordAiMessageUsage()   → usedMessages=100
Worker B: recordAiMessageUsage()   → usedMessages=101  ← OVER LIMIT
```

Both workers read `usedMessages=99` before either writes. Result: tenant gets
2 AI messages when they only had 1 remaining.

### Solution (After Day 4)

File: `src/lib/quota.ts`

Uses Redis atomic `INCR` as the gate:

```
1. SET quota:ai_messages:{tenantId}:{YYYY-MM}  {mongoUsed}  EX {ttlSeconds}  NX
   └── Initializes from MongoDB on first use this month (SET NX = only if not exists)

2. INCR quota:ai_messages:{tenantId}:{YYYY-MM}
   └── Returns new count atomically — impossible for two workers to get the same value

3. if newCount > limit:
     DECR quota:ai_messages:{tenantId}:{YYYY-MM}  ← rollback
     throw QuotaExceededError

4. if newCount % 10 === 0:
     async sync to MongoDB (fire-and-forget)
```

### Redis Key Design

```
quota:ai_messages:{tenantId}:{YYYY-MM}
```

- Per-tenant, per-month isolation
- TTL = seconds until end of UTC month (auto-expires with billing cycle)
- Initialized from `TenantSubscription.usedMessages` on key creation
- No cross-tenant data leakage

### Redis Down Behavior

| Plan Type | Redis Down Behavior |
|-----------|-------------------|
| Free / Limited (≤200 messages) | **Fail closed** — use MongoDB count, throw if exceeded |
| Paid (> 200 messages) | **Fail open** — allow request, log `quota.redis_down_paid_plan_allowed` |

Decision rationale: free users are more likely to be at/near their limit;
paid users have a buffer and the financial impact of an overage is recoverable.

### MongoDB Sync

Redis counter is synced to `TenantSubscription.usedMessages` every 10 increments.
On billing period rollover (invoice.payment_succeeded webhook), MongoDB resets to 0
and the new-month Redis key starts fresh.

### Migration Note

`src/lib/ai.ts` now calls `assertAndReserveQuota()` from `quota.ts` instead of
the old `assertCanSendAiMessage()` + `recordAiMessageUsage()` pair from `billing.ts`.
The old billing.ts functions remain for any legacy code paths.

---

## AI Context Window: Token-Aware

### Problem (Before Day 4)

```typescript
.limit(10)   // hardcoded — may be too many tokens for small models
             // or too few for long conversations needing context
```

No awareness of:
- System prompt token usage
- Knowledge context token usage
- Model context limits

### Solution (After Day 4)

File: `src/lib/ai.ts`

```typescript
const CONTEXT_BUDGET_TOKENS = process.env.CONTEXT_BUDGET_TOKENS || 4000;
const SYSTEM_RESERVE_TOKENS = 1200;     // system + persona prompts
const KNOWLEDGE_RESERVE_TOKENS = 800;  // RAG context
const TRANSCRIPT_BUDGET_TOKENS = 2000; // conversation history
```

The `buildTokenAwareTranscript(messages, budgetTokens)` function:
1. Processes messages newest-first
2. Estimates tokens: `Math.ceil(text.length / 4)` (4 chars ≈ 1 token)
3. Stops when budget is exhausted (with minimum 2 messages always included)
4. Prepends a truncation placeholder if history is cut:
   `[... محادثة سابقة محذوفة لتوفير مساحة — استمر بناءً على السياق الأخير ...]`

Fetches up to 60 messages (vs. the old 10) to give the algorithm room to fill
the budget with as much history as fits.

### Token Budget Breakdown (default 4000 tokens)

| Component | Budget |
|-----------|--------|
| System prompt + persona | 1200 tokens reserved |
| RAG knowledge context | 800 tokens reserved |
| Conversation transcript | 2000 tokens available |
| Total | 4000 tokens |

### Configuration

Override via environment: `CONTEXT_BUDGET_TOKENS=8000` for gpt-4o (128k context).
The default 4000 is safe for all models including gpt-3.5-turbo (4096 total context).

### Future: Conversation Summarization

When a conversation is too long to fit even with the budget algorithm, the
current implementation truncates and adds a placeholder. Day 5/6 will add
automatic summarization using the AI itself to compress old history into a
summary block.

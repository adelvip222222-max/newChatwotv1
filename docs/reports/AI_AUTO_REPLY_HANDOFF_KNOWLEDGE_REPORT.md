# AI Auto Reply, Human Handoff, Email Alert, and Knowledge Binding Report

**Date:** June 11, 2026  
**Scope:** AI behaviour for inbound conversations across channels.

## Summary

This patch changes the AI routing and response policy so inbound customer messages are handled by AI automatically whenever the conversation is open and not already paused or handed off to a human.

It also adds safe human handoff behaviour to prevent endless AI clarification loops. When escalation is required, the AI sends one final handoff message to the customer, marks the conversation as human-owned, pauses AI, raises priority, updates realtime state, and attempts to notify the registered account email.

## Files Changed

- `src/lib/ai.ts`
- `src/lib/ai/escalation.ts`
- `workers/core-routing-worker.ts`
- `src/server/channels/ingressProcessor.ts`
- `docs/reports/AI_AUTO_REPLY_HANDOFF_KNOWLEDGE_REPORT.md`

## Behaviour Implemented

### 1. Automatic AI Replies

The core routing worker now tries to route every open incoming customer message to the AI queue when:

- conversation is not closed/resolved,
- conversation is not already in human mode,
- AI is not manually paused.

If a channel/conversation has no `botId`, the worker attempts to attach the first active bot in the tenant before routing. This prevents conversations from silently skipping AI just because the channel was created without an explicit bot binding.

### 2. Human Handoff Requested by Customer

Previously, handoff keywords such as `human`, `agent`, `support`, `موظف`, `خدمة العملاء`, or `انسان` paused AI immediately in the ingress layer, so the customer could receive no final AI acknowledgement.

Now, ingress only marks:

```ts
conversation.metadata.aiPolicy.handoffRequested = true
```

The AI worker then sends a final handoff response and transfers the conversation to human mode.

### 3. Loop Prevention

The AI now tracks lightweight conversation policy state in:

```ts
conversation.metadata.aiPolicy
```

Tracked values include:

- `clarificationCount`
- `repeatedUserCount`
- `lastUserFingerprint`
- `lastAssistantFingerprint`
- `lastKnowledgeConfidence`
- `lastKnowledgeSourceCount`
- `lastAiReplyAt`

Escalation happens automatically when:

- the same customer question repeats too many times,
- the AI generates the same reply twice,
- knowledge confidence stays low after clarification attempts,
- the AI reaches max automatic turns,
- the AI provider fails.

Environment controls:

```env
AI_MAX_AUTO_TURNS=10
AI_MAX_CLARIFICATION_TURNS=2
AI_MAX_REPEATED_USER_TURNS=1
AI_ESCALATION_EMAIL_COOLDOWN_MS=900000
```

### 4. Knowledge Base Binding

AI generation now reinforces tenant/bot-scoped RAG rules:

- search is scoped by `tenantId` and `botId`,
- retrieved knowledge is treated as the first source of truth,
- low confidence triggers targeted clarification,
- repeated low confidence triggers human handoff instead of hallucination.

The reply message metadata stores knowledge diagnostics:

- confidence,
- intent,
- keywords,
- source count,
- optional source list if enabled on the bot.

### 5. Email Notification on Escalation

Added:

```txt
src/lib/ai/escalation.ts
```

The notification system resolves recipients in this order:

1. `AI_ESCALATION_EMAIL_TO` env override,
2. tenant owner email,
3. active owner/admin/manager users in the tenant.

Supported delivery methods:

```env
AI_ESCALATION_WEBHOOK_URL=https://your-webhook.example.com/ai-escalation
```

or:

```env
RESEND_API_KEY=...
EMAIL_FROM="ChatZi <notifications@yourdomain.com>"
```

If neither is configured, the system logs a warning and still completes the handoff safely without blocking the customer response.

## Important Operational Notes

- The system does not add `nodemailer` to avoid changing dependencies and lockfiles.
- For real email delivery, configure either `RESEND_API_KEY` + `EMAIL_FROM` or `AI_ESCALATION_WEBHOOK_URL`.
- Email sending has cooldown protection to avoid spamming account owners during repeated inbound messages after handoff.
- Once conversation is in human mode, future inbound messages will not be answered by AI until AI is resumed.

## Manual Test Checklist

1. Send a normal message in a web/Telegram/WhatsApp conversation.
2. Confirm AI replies automatically.
3. Ask for a human agent using `موظف` or `human`.
4. Confirm AI sends one final handoff message.
5. Confirm conversation mode becomes `human` and `aiPaused=true`.
6. Confirm priority becomes `high` and status becomes `pending`.
7. Configure `RESEND_API_KEY` and confirm an escalation email is sent to account owner.
8. Ask an out-of-knowledge question repeatedly.
9. Confirm AI does not loop forever and escalates after configured clarification limit.
10. Confirm future messages after handoff are not answered by AI automatically.

## Validation

A full TypeScript check could not be completed in this environment because project dependencies are not installed in `node_modules`; the compiler reports missing modules such as `mongoose`, `next`, and `@types/node`. These are environment/dependency installation errors, not validation of the patch itself.

Run on the target machine:

```bash
npm install
npm run build
npm run lint
```

Then restart workers:

```bash
pm2 restart all
```

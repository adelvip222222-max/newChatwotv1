# Message Pipeline Design
**Project:** ChatZi
**Date:** 2026-06-11

---

## Full Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INBOUND MESSAGE PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────┘

External Platform (Telegram / WhatsApp / Facebook / Widget / Webhook)
         │
         │  HTTP POST
         ▼
┌─────────────────────┐
│  Next.js API Route  │   /api/channels/{provider}/webhook
│  (Webhook Ingress)  │
└─────────┬───────────┘
          │
          ▼ STEP 1: VERIFY
          │  adapter.verifyWebhook(request, channel)
          │  → Signature check (HMAC-SHA256, secret token)
          │  → Reject 403 if invalid
          │
          ▼ STEP 2: NORMALIZE
          │  adapter.normalizeIncoming(payload, channel)
          │  → Parse provider-specific format
          │  → Return NormalizedIncomingMessage[]
          │  → Fields: provider, externalEventId, externalUserId,
          │             externalMessageId, text, attachments, customer, timestamp
          │
          ▼ STEP 3: DEDUPLICATE
          │  WebhookEvent.findOne({ tenantId, provider, externalEventId })
          │  → Skip if already processed (idempotency)
          │  → Create WebhookEvent record (status: processed | ignored)
          │
          ▼ STEP 4: RESOLVE CONTACT
          │  ChannelIdentity.findOne({ tenantId, provider, externalUserId })
          │  → If found: update lastSeenAt, load Contact
          │  → If not: Contact.create() + ChannelIdentity.create()
          │
          ▼ STEP 5: RESOLVE CONVERSATION
          │  Conversation.findOne({ tenantId, channelIdentityId, status: open|snoozed })
          │  → If found: update lastMessageAt, unreadCount, slaStatus
          │  → If not: Conversation.create() with SLA deadlines
          │  → Handover keyword detection → mode=human if matched
          │
          ▼ STEP 6: PERSIST MESSAGE
          │  Message.create({
          │    tenantId, conversationId, contactId,
          │    direction: "incoming", sender: "user",
          │    content, attachments, deliveryStatus: "delivered"
          │  })
          │
          ▼ STEP 7: ENQUEUE (async from here)
          │  coreRoutingQueue.add("route-message", { tenantId, conversationId, messageId })
          │  jobId = "route__{messageId}"  (deduplication)
          │  → 3 retries, exponential backoff starting 1000ms
          │
          ▼ Return { success: true, queued: true } to webhook caller

─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORE ROUTING WORKER                                 │
│                   Queue: core-routing-queue  Concurrency: 10                │
└─────────────────────────────────────────────────────────────────────────────┘

          ▼ STEP 8: ROUTE
          │  Load conversation + message from MongoDB
          │  → Skip if: message not incoming customer message
          │  → Skip if: conversation closed/resolved
          │
          ▼ STEP 9: AI INTELLIGENCE (async best-effort)
          │  refreshConversationIntelligence({ tenantId, conversationId })
          │  → Analyzes sentiment, intent, confidence
          │  → Updates conversation.aiStatus, aiSentiment, aiIntent
          │  → Sets needsHuman flag if escalation needed
          │
          ▼ STEP 10: ROUTING DECISION
          │  If conversation.mode === "human" OR aiPaused OR !botId:
          │    → Skip AI → return { routed: false, reason: "human_or_ai_paused" }
          │  If insight.needsHuman:
          │    → Skip AI → return { routed: false, reason: "ai_escalated_to_human" }
          │  Else:
          │    → aiProcessingQueue.add("generate-ai-reply", ...)
          │       jobId = "ai__{messageId}"

─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI PROCESSING WORKER                                │
│                   Queue: ai-processing-queue  Concurrency: 3                │
└─────────────────────────────────────────────────────────────────────────────┘

          ▼ STEP 11: AI REPLY GENERATION
          │  generateAiReply({ tenantId, botId, conversationId, message })
          │  → searchKnowledge() — vector + keyword hybrid search
          │  → buildKnowledgePrompt() — inject top-k results
          │  → assertCanSendAiMessage() — check quota
          │  → OpenAI chat.completions.create()
          │  → Message.create({ direction: outgoing, sender: assistant })
          │  → recordAiMessageUsage() — increment counter
          │
          ▼ STEP 12: ENQUEUE EGRESS
          │  egressQueue.add("prepare-outbound", { messageId, provider })
          │  jobId = "egress__{messageId}"

─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│                           EGRESS WORKER                                     │
│                   Queue: egress-queue  Concurrency: 5                       │
└─────────────────────────────────────────────────────────────────────────────┘

          ▼ STEP 13: SEND MESSAGE
          │  Load message + conversation + channel
          │  adapter.sendMessage({ channel, externalUserId, text, attachments })
          │  → On success: message.deliveryStatus = "sent"
          │  → On failure: message.deliveryStatus = "failed"
          │               → retry via BullMQ (3 attempts)
          │
          ▼ STEP 14: DELIVERY TRACKING (optional)
             MessageDelivery.create({ messageId, externalMessageId, status })
             → Updated later via delivery receipt webhooks

─────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│                    OUTBOUND (AGENT REPLY) PATH                              │
└─────────────────────────────────────────────────────────────────────────────┘

Agent sends reply via dashboard:
  POST /api/inbox/conversations/{id}/reply
          │
          ▼ Message.create({ direction: outgoing, sender: agent })
          ▼ conversation.mode = "human" (pause AI)
          ▼ egressQueue.add("prepare-outbound", ...)
          ▼ Same egress path as AI replies
```

---

## Queue Configuration

| Queue | Worker File | Concurrency | Retries | Backoff |
|---|---|---|---|---|
| ingress-queue | `workers/ingress-worker.ts` | 20 | 3 | exponential 1s |
| core-routing-queue | `workers/core-routing-worker.ts` | 10 | 3 | exponential 1s |
| ai-processing-queue | `workers/ai-worker.ts` | 3 | 3 | exponential 5s |
| egress-queue | `workers/egress-worker.ts` | 5 | 3 | exponential 1s |

---

## Error Handling

- Failed jobs are recorded in `FailedJob` collection via `recordFailedJob()`
- All workers have `worker.on("failed")` handlers
- Worker heartbeats tracked in Redis via `startWorkerHeartbeat()`
- Health endpoints: `/api/health/queues`, `/api/health/workers`

---

## Known Issues

1. **AI quota check not atomic** — `assertCanSendAiMessage` reads then `recordAiMessageUsage` increments — race condition possible under high concurrency
2. **Context window fixed at 10 messages** — no sliding window, no token counting
3. **Sequential retrain** — `retrainAllKnowledge` loops documents serially — blocks for large knowledge bases
4. **SSE stream not scalable** — in-memory event bus, breaks under multi-pod deployment
5. **No outbound queue for ingress-worker** — ingress-worker.ts exists but purpose unclear (possibly legacy)

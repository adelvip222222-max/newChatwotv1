# AI Architecture Design
**Project:** ChatZi
**Date:** 2026-06-11
**Status:** Design document — current state + target architecture

---

## Overview

ChatZi's AI system is a multi-persona, multi-provider orchestration engine that handles automated customer conversations. It uses a knowledge-grounded LLM approach with tool-calling support.

---

## Current Implementation

### Provider Layer
Multi-provider via OpenAI-compatible SDK:

```
AiProvider (DB) → priority-sorted
  └── openai    → api.openai.com
  └── openrouter → openrouter.ai/api/v1
  └── deepseek  → api.deepseek.com/v1
  └── xai       → api.x.ai/v1
  └── groq      → api.groq.com/openai/v1
  └── ollama    → localhost:11434/v1
```

API keys are encrypted at rest (`crypto.ts` using AES encryption). The `AiAgentService` and `generateAiReply` in `ai.ts` resolve the active provider dynamically.

**Problem:** Both `AiProvider` (new model) and `AiModel` (legacy model) coexist. Resolution logic in `ai-agent.service.ts` checks both, creating dual-path complexity.

### Persona System
`AiPersona` model defines role-specific AI agents:

```
AiPersona {
  roleName: "Sales" | "Support" | "Receptionist" | custom
  systemPrompt: string       // full LLM system prompt
  greetingMessage: string    // sent on persona selection
  maxTurns: number           // loop prevention limit
  tone: string               // professional | friendly | formal
  knowledgeMode: "grounded" | "free"
  handoffPolicy: "when_needed" | "always_available" | "never"
  allowedTools: string[]     // subset of tools registry
  channelScope: string[]     // which channels this persona serves
}
```

### Conversation Flow with Personas

```
New conversation arrives
        │
        ▼
startConversation()
  → Query active personas for tenant
  → If multiple: send interactive button selector to customer
  → If one: activate it directly
  → If zero: skip AI, wait for agent
        │
Customer selects persona (or types)
        │
        ▼
generateDynamicResponse()
  → Detect "SELECT_PERSONA_{id}" prefix
  → Set conversation.activePersonaId
  → Check aiTurnCount >= persona.maxTurns → escalate
  → Resolve provider (AiProvider → AiModel fallback)
  → Build messages array (last 10 messages as context)
  → Filter tools by persona.allowedTools
  → openai.chat.completions.create({ tools, tool_choice: auto })
  → Handle tool_calls OR text reply
```

---

## Target AI Architecture

### Receptionist Agent
```
Purpose: First contact — greet, qualify, route

Trigger: New conversation (no active persona)
Input: First customer message
Output: 
  - Department selection buttons
  - OR direct routing if single department
  - OR free-text greeting

Implementation:
  - System prompt: brand voice + available departments
  - Tools: [select_department, collect_contact_info]
  - maxTurns: 3 (quick routing, then escalate)
  - handoffPolicy: "always_available"
```

### Sales Agent
```
Purpose: Lead qualification, product info, booking

Trigger: Customer selects Sales persona
Input: Customer messages
Output:
  - Product information (from knowledge base)
  - Pricing (from knowledge base)
  - Lead data collection
  - Booking link

Implementation:
  - knowledgeMode: "grounded"
  - Tools: [search_knowledge, save_lead_data, create_booking, escalate_to_human]
  - Confidence threshold: >60 to answer directly
  - maxTurns: 10
```

### Support Agent
```
Purpose: Issue resolution, technical help

Trigger: Customer selects Support persona
Input: Problem description
Output:
  - Solutions from knowledge base
  - Ticket creation if unresolved
  - Escalation to human agent

Implementation:
  - knowledgeMode: "grounded"
  - Tools: [search_knowledge, create_ticket, escalate_to_human]
  - handoffPolicy: "when_needed"
  - maxTurns: 8
```

### Knowledge Retrieval
```
Input: question (string), tenantId, botId
Process:
  1. Extract keywords (Arabic + English stop-word aware)
  2. Create embedding (OpenAI text-embedding-3-small)
  3. Semantic search in Qdrant (target) / MongoDB (current)
  4. Keyword search via MongoDB $text index
  5. Hybrid scoring: semantic × 0.68 + keyword × 0.32
  6. Confidence calculation from top-k scores
  7. Return: { results, confidence, intent, keywords }

Target: Replace in-memory cosine with Qdrant ANN search
  → 100x faster at scale
  → Supports 1536-dim OpenAI embeddings
  → Filtered search by tenantId, botId, expiresAt
```

### Follow-Up Agent
```
Purpose: Re-engage inactive conversations

Trigger: bot.autoFollowupEnabled = true
         AND lastCustomerMessageAt > followupDelayMinutes
         AND conversation.status = "open"

Process (to be implemented):
  1. Cron job or BullMQ delayed job
  2. Load conversation context
  3. Generate follow-up message via LLM
  4. Check followupMaxAttempts
  5. Send via egress queue
  6. If max attempts reached → close conversation
```

### Human Handoff
```
Trigger (any of):
  - HANDOVER_KEYWORDS detected in message text
  - aiTurnCount >= persona.maxTurns
  - AI confidence < persona.confidenceReviewThreshold
  - Tool call: escalate_to_human
  - Agent manually sets conversation.mode = "human"

Process:
  1. conversation.mode = "human"
  2. conversation.aiPaused = true
  3. conversation.aiStatus = "escalated"
  4. conversation.handoffReason = reason
  5. Notify assigned team/agent via SSE/push
  6. Send customer notification message

Resume AI:
  - When agent replies → conversation.aiPaused = true, aiPausedReason = "agent_replied"
  - When customer next messages after agent reply → auto-resume AI
```

### Confidence Scoring
```
Formula (current):
  confidence = best_score × 0.78 + keyword_coverage + spread × 0.12

Where:
  best_score = highest hybrid score from top-k results (0-100)
  keyword_coverage = min(20, len(keywords) × 3)
  spread = best_score - second_best_score

Thresholds:
  >70  → Answer directly
  40-70 → Answer with "may need verification" caveat
  <40  → Ask clarifying question
  <bot.confidenceReviewThreshold → mark for human review (aiStatus = "needs_review")
```

---

## Tools Registry

Located: `src/lib/ai/tools-registry.ts`

Available tools:
- `save_extracted_data` — persist lead/contact data collected during conversation
- `escalate_to_human` — trigger human handoff
- (expandable by registering new tools)

Tool executor context:
```typescript
{
  tenantId: string,
  conversationId: string,
  conversation: ConversationDocument,
  sendSmsCallback: Function  // mock — Twilio/MessageBird not yet wired
}
```

---

## Known Issues & Gaps

| Issue | Severity | Impact |
|---|---|---|
| Dual provider model (AiProvider + AiModel) | HIGH | Confusion, inconsistent behavior |
| In-memory cosine similarity (no Qdrant) | HIGH | O(n) — breaks at >10k chunks |
| Context window fixed at last 10 messages | MEDIUM | No token counting, poor long-conv quality |
| SMS alert is a console.log mock | MEDIUM | No real escalation notification |
| `usedMessages` race condition | MEDIUM | Could over-serve paid quota |
| No streaming responses | MEDIUM | Poor UX for long AI replies |
| No function call result fed back to LLM | LOW | Tool call loop doesn't close properly |

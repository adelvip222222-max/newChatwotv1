# Smart Knowledge Base + Template Seeding + AI Scope Guard Report

## Summary

This update improves onboarding knowledge quality and makes the AI agent more business-focused. The goal is to prevent the bot from drifting into unrelated topics, force it to prioritize the tenant knowledge base even when the knowledge base is still small, and give each onboarding template a useful default knowledge package from day one.

## Implemented Changes

### 1. Default Knowledge Packages for Register Templates

Added a new default industry knowledge module:

- `src/lib/knowledge-default-templates.ts`

It defines baseline knowledge packs for:

- E-commerce
- Medical / clinic
- Real estate
- Tech / SaaS
- General business

Each template now includes multiple default knowledge documents covering roughly half of the initial bot setup needs, including:

- Business scope rules
- Bot behavior boundaries
- Sales handling
- Support handling
- Booking handling
- Pricing/billing safety
- Policies and fallback rules

These documents intentionally avoid fake prices, fake products, fake appointments, or false policies. They provide safe operating rules and structured placeholders until the business owner uploads real data.

### 2. Register Flow Auto-Seeding

Updated:

- `src/components/auth/register-form.tsx`

When the user selects a template during registration, the system now automatically creates default knowledge documents for that selected industry.

The onboarding flow now supports:

- Uploading the Excel template.
- Adding website URL.
- Adding company profile text.
- Adding services/policies text.
- Automatically adding default template knowledge.
- Continuing with default knowledge even if the owner does not upload a file yet.

The previous “skip knowledge” action was changed into a safer behavior: it seeds the default package and continues, instead of leaving the bot with an empty business context.

### 3. Knowledge Base Becomes Active Immediately

Updated:

- `src/lib/knowledge.ts`

The search layer now includes a raw-document fallback.

Why:
Newly added onboarding documents may be in `pending` state while the knowledge worker processes chunks and embeddings. Before this update, the bot might not find anything until the worker finished. Now, if not enough trained chunks exist, the search system also reads `KnowledgeDocument.rawText` as a temporary fallback.

This allows the bot to use the new default knowledge immediately after registration, even before full chunk training completes.

New fallback behavior:

- Search trained chunks first.
- If chunk results are low, search raw knowledge documents.
- Score raw documents using local semantic hash + keyword overlap.
- Return the best available knowledge to the AI prompt.

### 4. Stronger Knowledge Prompt

Updated:

- `src/lib/knowledge.ts`

The knowledge prompt now clearly instructs the AI that:

- Knowledge base is the source of truth.
- Even small/general knowledge must be used.
- The bot must not invent prices, policies, availability, appointments, integrations, or promises.
- If confidence is low, it should ask a focused clarifying question.
- If the customer asks unrelated questions, the bot should politely redirect back to the business scope.

### 5. Stronger Legacy AI Scope Guard

Updated:

- `src/lib/ai.ts`

The legacy AI path now includes stricter business-scope behavior:

- The bot must stay within the business purpose.
- It must use the knowledge base even if partial.
- It must not participate in unrelated topics like politics, entertainment, trivia, coding help, or unrelated debates.
- It should redirect side-topic attempts back to products, services, booking, sales, billing, or support.
- It should not escalate immediately when knowledge confidence is low if any useful knowledge exists.

Important logic change:

Before:
Low confidence knowledge could count as low confidence and push the conversation toward escalation.

Now:
If any knowledge results exist, the bot uses them as the answer boundary and asks a clarification question instead of escalating immediately.

### 6. Stronger Mastra AI Scope Guard

Updated:

- `src/mastra/workflows/ai-reply.workflow.ts`

The Mastra workflow now receives the same business-scope instructions:

- Knowledge base is the truth boundary.
- Use partial knowledge safely.
- Do not invent details.
- Redirect unrelated side topics.
- Ask one focused clarifying question when knowledge is weak.
- Avoid premature human handoff.

The Mastra knowledge search limit now also uses:

- `AI_KB_SEARCH_LIMIT` with default `14`

## Files Changed

- `src/lib/knowledge-default-templates.ts`
- `src/components/auth/register-form.tsx`
- `src/lib/knowledge.ts`
- `src/lib/ai.ts`
- `src/mastra/workflows/ai-reply.workflow.ts`
- `docs/reports/SMART_KB_TEMPLATE_AI_SCOPE_REPORT.md`

## Expected Behavior After This Update

### During registration

When a user selects a template, the system automatically prepares default knowledge data for that industry.

### When the bot answers

The bot should:

- Use the knowledge base first.
- Stay within business context.
- Avoid unrelated side conversations.
- Ask smart clarifying questions when knowledge is incomplete.
- Avoid hallucinating prices, products, policies, or promises.
- Avoid immediate human transfer unless truly needed.

### If the user asks unrelated questions

The bot should respond briefly and redirect back to the business purpose.

Example:

> I’m here to help with this business’s products, services, bookings, sales, billing, or support. Tell me what you need help with and I’ll guide you.

## Verification Notes

A local TypeScript check could not complete in the sandbox because `node_modules` is not installed in this environment, causing dependency resolution errors for packages like `mongoose`, `next`, `bullmq`, and test types. These are environment dependency errors, not necessarily code errors from this patch.

Recommended server verification:

```bash
npm install --legacy-peer-deps --registry=https://registry.npmjs.org/
npm run build
pm2 reload ecosystem.config.js --update-env
```

## Recommended Test Scenarios

1. Register a new tenant and choose the E-commerce template.
2. Continue without uploading a file.
3. Open Knowledge Base and confirm default documents were added.
4. Ask the bot about products/shipping/returns.
5. Ask the bot an unrelated side question.
6. Confirm it redirects back to business scope.
7. Upload a real Excel template and confirm the bot prefers the real uploaded data over the generic defaults.
8. Test Mastra enabled and legacy fallback paths.

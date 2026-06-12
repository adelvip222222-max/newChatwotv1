# AI Knowledge-First Fast Reply and Media Support Report

## Summary

This patch improves the AI bot behavior around knowledge-base grounding, speed, chat cleanliness, first greeting, AI employee presentation, workflow capture, and media messages.

## Main changes

1. **Knowledge-first replies**
   - The AI prompt now explicitly requires answers to be grounded primarily in the tenant/bot knowledge base.
   - Search now considers all available chunks even if old chunks were trained with a different embedding provider.
   - Knowledge search now uses a stronger keyword component and a local fallback vector when embedding dimensions differ.
   - Default confidence behavior is less likely to hand off too early when useful knowledge exists.

2. **Fast first greeting**
   - If the first customer message is only a greeting such as `السلام عليكم`, the system responds without calling the LLM.
   - The greeting uses the tenant/company name when available.
   - The first greeting includes available AI employees/personas with an AI marker.

3. **Remove AI internal notes from chat timeline**
   - `ai_event` records such as `AI Escalation`, `AI Suggestions Updated`, and `AI Summary` no longer appear inside the main message timeline.
   - These events remain available in the insight/side panel data model.

4. **Reply speed**
   - Core routing no longer blocks the AI reply on heavy inbox intelligence analysis.
   - Inbox analysis now runs asynchronously after routing.

5. **Workflow capture**
   - When the conversation looks like a purchase, support request, booking, or order flow, the system creates a structured `Task` once per conversation.
   - Optional notifications are supported through:
     - `AI_WORKFLOW_WEBHOOK_URL`
     - `AI_WORKFLOW_SMS_WEBHOOK_URL`
     - `RESEND_API_KEY` + `EMAIL_FROM`
     - `AI_WORKFLOW_EMAIL_TO`

6. **Media messages**
   - Website widget now supports image attachments as well as voice recordings.
   - Widget API accepts text-only, attachment-only, or mixed messages.
   - AI worker passes attachment summaries to the AI so it can respond properly when the customer sends audio/image/file messages.
   - Telegram, WhatsApp, Facebook, and Instagram adapters now preserve common media attachments where provider payloads include them.

7. **Build fixes**
   - Replaced invalid `lucide-react` imports `Facebook` and `Instagram` with supported Lucide icons.
   - Fixed `/api/realtime/stream` route config to export `runtime` and `dynamic` directly.
   - Replaced Replit package-lock registry URLs with the public npm registry.

## Files changed

- `src/lib/ai.ts`
- `src/lib/knowledge.ts`
- `src/lib/inbox/service.ts`
- `workers/core-routing-worker.ts`
- `workers/ai-worker.ts`
- `src/app/api/widget/message/route.ts`
- `src/app/widget.js/route.ts`
- `src/components/ui/chat-widget.tsx`
- `src/app/dashboard/personas/page.tsx`
- `src/app/dashboard/channels/meta-connect/page.tsx`
- `src/app/api/realtime/stream/route.ts`
- Channel providers for WhatsApp, Facebook, Telegram
- `package-lock.json`

## Required environment variables for full notifications

```env
RESEND_API_KEY=...
EMAIL_FROM="ChatZi <notifications@your-domain.com>"
AI_WORKFLOW_EMAIL_TO="owner@example.com"
AI_WORKFLOW_WEBHOOK_URL="https://your-webhook-url"
AI_WORKFLOW_SMS_WEBHOOK_URL="https://your-sms-webhook-url"
```

## Manual validation checklist

1. Run `npm install` and confirm it no longer requests `package-firewall.replit.local`.
2. Run `npm run build`.
3. Open `/dashboard/channels/meta-connect` and confirm no Facebook/Instagram Lucide import error.
4. Open the chat widget and send `السلام عليكم`.
5. Confirm the bot replies immediately with tenant/company name and AI employee suggestions.
6. Add or retrain knowledge documents, then ask a question that exists in the uploaded files.
7. Confirm the answer is grounded in the KB and not a generic answer.
8. Confirm AI summary/escalation events no longer appear in the center chat timeline.
9. Send a voice note and an image through the widget.
10. Confirm the message is stored with attachments and AI sees a clear attachment summary.
11. Send a purchase/support-like request and confirm a Task is created.

## Notes

This patch keeps the existing queue architecture. It improves latency by removing blocking analysis from the critical path, but provider latency still depends on the selected AI provider and model.

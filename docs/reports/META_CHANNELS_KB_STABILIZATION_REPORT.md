# Meta Channels + Knowledge Base Stabilization Report

## Summary
This patch focuses on the two production issues observed after the latest AI/Realtime changes:

1. Knowledge documents staying in `pending` / `بانتظار`.
2. Facebook Messenger / Meta outbound replies not being delivered reliably after refactors.

## Root Cause Findings

### 1. Knowledge Base pending state
The project already had `workers/knowledge-worker.ts`, but `ecosystem.config.js` did not start it under PM2. As a result, uploaded or manually entered knowledge documents were saved and queued, but no worker consumed the `knowledge-training-queue`. This explains why the UI showed `بانتظار`.

### 2. Messenger / Meta replies
The egress worker selected outbound channels by `{ tenantId, botId, type }`. This is fragile when a tenant has multiple Meta channels, pages, Instagram identities, or a conversation was created from a specific `ChannelIdentity`. The correct outbound channel should be the same channel linked to the conversation identity when available.

## Changes Applied

### Knowledge Base
- Added `worker-knowledge` to `ecosystem.config.js`.
- Added `KNOWLEDGE_WORKER_CONCURRENCY` to the worker environment.
- Added `scripts/requeue-knowledge.ts`.
- Added npm script:
  - `npm run knowledge:requeue`

### Meta / Messenger / WhatsApp / Instagram Outbound Stability
- Updated `workers/egress-worker.ts` to resolve the outbound channel using this priority:
  1. Exact channel from `ChannelIdentity.channelId`.
  2. Fallback to `{ tenantId, botId, type }`.
  3. Final fallback to latest active tenant channel of same provider.

This reduces wrong-channel selection and prevents replies being sent through the wrong Facebook/Instagram/WhatsApp identity.

## Deployment Commands

After pulling this patch on the server:

```bash
npm install
npm run build
pm2 reload ecosystem.config.js --update-env
pm2 list
```

Then requeue pending knowledge documents:

```bash
npm run knowledge:requeue
```

Check worker logs:

```bash
pm2 logs worker-knowledge --lines 80
pm2 logs worker-egress --lines 80
pm2 logs worker-outbound --lines 80
```

## Validation Checklist

1. Open `/dashboard/knowledge`.
2. Add a small custom text document.
3. Confirm it changes from `بانتظار` to `ready` / trained after the worker runs.
4. Send a message to connected Messenger.
5. Confirm inbound message appears in inbox.
6. Confirm AI reply is created.
7. Confirm outbound delivery status changes from queued/sending to sent.
8. If delivery fails, inspect `worker-outbound` logs for Meta API error code.

## Notes

If Messenger still does not reply after this patch, the next things to verify are:

- PM2 workers are all running.
- Page access token is still valid.
- Facebook App permissions include `pages_messaging`, `pages_manage_metadata`, and `pages_show_list`.
- The conversation is inside Meta's allowed messaging window.
- Webhook subscriptions are active for the Page.

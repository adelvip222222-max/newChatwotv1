# Realtime Phase 0 + Phase 1 Implementation Report

**Scope:** Performance hotfix only. This patch does **not** introduce SSE, WebSockets, Socket.io, Pusher, Ably, or a new realtime service. It reduces MongoDB and bandwidth waste in the existing polling path before the later realtime migration.

## 1. Summary

Implemented two targeted improvements:

1. **Phase 0 — Conversation list latest-message hotfix**
   - Removed the dangerous pattern where the legacy conversation list could load all messages for the visible conversations into Node.js memory just to calculate one latest message snippet.
   - The list now primarily uses the denormalized `Conversation.lastMessagePreview` field.
   - Only older conversations missing a preview use a bounded aggregation fallback that returns one latest message per conversation.

2. **Phase 1 — Incremental active-thread polling**
   - The legacy active conversation refresh now uses `?since=<latestMessageCreatedAt>` after initial load.
   - It merges only new messages into the current state and de-duplicates by message id.
   - It avoids overlapping incremental refreshes and prevents stale in-flight requests from writing messages into the wrong conversation after the user switches threads.

## 2. Files Changed

- `src/lib/conversations-data.ts`
- `src/lib/models/message.ts`
- `src/lib/models/conversation.ts`
- `src/app/api/conversations/[id]/messages/route.ts`
- `src/app/dashboard/conversations/InboxClientUI.tsx`
- `docs/reports/REALTIME_PHASE_0_1_REPORT.md`

## 3. Phase 0 — Before / After

### Before

The legacy conversation list loaded messages matching the visible conversation ids and sorted them globally:

```txt
20 visible conversations -> fetch all matching messages -> reduce in Node.js -> discard most documents
```

In large tenants, this could load thousands of unnecessary message documents every few seconds.

### After

The list uses `Conversation.lastMessagePreview` first:

```txt
20 visible conversations -> use lastMessagePreview directly
```

For older conversations without `lastMessagePreview`, the fallback is now:

```txt
missing-preview conversations only -> aggregation -> one latest message per conversation
```

The fallback aggregation selects only the fields needed by the UI:

- `conversationId`
- `content`
- `createdAt`
- `direction`
- `attachments`

## 4. Phase 1 — Before / After

### Before

The legacy inbox message pane refreshed with:

```txt
/api/conversations/:id/messages?limit=120
```

every interval, repeatedly downloading the same 120 messages.

### After

Initial load still fetches the last 120 messages for compatibility. After that, interval refreshes use:

```txt
/api/conversations/:id/messages?limit=250&since=<latestPersistedMessageCreatedAt>
```

When no new messages exist, the API returns:

```json
{ "messages": [] }
```

The frontend then does nothing instead of replacing the full thread.

## 5. MongoDB Indexes Added / Verified

### Message

Verified and preserved the ascending index used by normal chronological reads:

```ts
messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });
```

Added / verified the descending index used by latest-message fallback and initial recent-message loading:

```ts
messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: -1 });
```

### Conversation

Added a sort-supporting index for the legacy conversation list order:

```ts
conversationSchema.index({ tenantId: 1, unreadCount: -1, lastMessageAt: -1, updatedAt: -1 });
```

Existing status/provider/team/agent indexes were preserved.

## 6. API Behavior

`GET /api/conversations/[id]/messages` now validates:

- `limit` must be a finite positive number.
- `since`, when present, must be a valid timestamp.

Invalid values return `400` instead of silently falling back or causing hidden expensive behavior.

`listMessagesForConversation()` now:

- uses ascending sort for incremental `since` reads;
- uses descending sort then reverses for initial latest-message reads;
- preserves oldest-to-newest response ordering for the UI.

## 7. Frontend Safety Improvements

`InboxClientUI.tsx` now:

- calculates the newest persisted message timestamp while ignoring optimistic `temp-*` messages;
- sends `since` only for incremental interval refreshes;
- merges and de-duplicates incoming messages by id;
- preserves message ordering by `createdAt`;
- prevents overlapping incremental polling calls;
- prevents stale in-flight requests from an old conversation from updating the newly selected conversation.

## 8. Backward Compatibility

Preserved:

- initial load shape;
- message response shape;
- conversation list response shape;
- attachment rendering;
- send-message behavior;
- existing polling intervals;
- existing active AI inbox/SSE implementation.

This patch intentionally focuses on the legacy endpoints and UI paths identified as dangerous during the audit.

## 9. Known Limitations

- This is still polling, not true realtime.
- `since` is timestamp-based. Very high-volume conversations could eventually benefit from a compound cursor such as `createdAt + _id`.
- The active AI inbox already has an SSE route; this patch does not expand or harden that SSE system.
- Conversation list polling remains every 9 seconds in the legacy UI, but its database query is now much safer.

## 10. Manual Test Checklist

1. Open `/dashboard/conversations`.
2. Open a conversation with many messages.
3. Confirm the initial request still loads the latest messages.
4. Wait for the polling interval.
5. Confirm subsequent message requests include `since=`.
6. Confirm no-new-message responses are small and return `messages: []`.
7. Send an outbound message and confirm it appears once only.
8. Simulate an inbound message and confirm it merges without duplicates.
9. Switch conversations during polling and confirm old in-flight requests do not overwrite the new thread.
10. Confirm conversation list previews still show correctly.
11. Confirm the app still builds/types after installing dependencies.

## 11. Validation Notes

The patch was applied at source level. Run the project checks in the target environment after installing dependencies:

```bash
npm install
npx tsc --noEmit
npm run lint
```

If the project uses a frozen lockfile workflow, run the equivalent command used by your deployment pipeline instead of modifying the lockfile.

# UI Simplification Report — Messages & Contacts

## Scope

This patch focuses only on the dashboard user experience for:

- `src/app/dashboard/conversations/InboxClientUI.tsx`
- `src/app/dashboard/contacts/page.tsx`

It does not change channel providers, billing, auth, AI workers, queues, or realtime infrastructure.

---

## 1. Messages / Inbox Page

### What changed

- Simplified the inbox visual structure to feel closer to common messenger products.
- Kept the existing three functional areas:
  - conversations list
  - active message thread
  - customer/profile context
- Added a desktop-only customer context panel showing:
  - customer name
  - contact methods
  - current channel
  - unread count
  - latest activity
  - conversation status
- Reduced visual noise in conversation cards.
- Made the composer more compact and pill-shaped.
- Kept mobile behavior intact: list view and thread view still switch on small screens.
- Kept the existing incremental polling performance work intact.

### Files changed

- `src/app/dashboard/conversations/InboxClientUI.tsx`

---

## 2. Contacts Page

### What changed

- Redesigned contacts into a clearer customer directory.
- Added server-side search by:
  - name
  - email
  - phone
  - company
  - tags
- Contact cards now show compact analytics under each contact:
  - total message count
  - conversation count
  - latest activity
  - general status
- Clicking a contact no longer shows the message transcript.
- The selected contact view now shows:
  - contact profile
  - contact methods
  - lifecycle stage
  - general status
  - total messages
  - incoming/outgoing split
  - open conversations
  - channels used
  - latest activity
  - tags when available
- Kept a direct button to open the latest conversation in the Inbox.

### Files changed

- `src/app/dashboard/contacts/page.tsx`

---

## 3. Behavior Notes

- The Contacts page intentionally does not render messages anymore. Messages remain inside the Inbox page.
- The Contacts page uses aggregation for counts instead of loading message content.
- The design remains server-rendered and does not introduce new client-side state or dependencies.
- No new npm packages were added.

---

## 4. Validation

Attempted validation command:

```bash
npm run lint
```

Result:

```txt
next: not found
```

Reason: `node_modules` is not installed in the sandbox environment. The patch did not modify `package.json` or `package-lock.json`.

---

## 5. Manual Test Checklist

1. Open `/dashboard/conversations` on desktop.
2. Confirm the inbox shows conversation list, message thread, and customer context panel.
3. Open `/dashboard/conversations` on mobile.
4. Confirm list/thread navigation still works.
5. Send a message from the composer.
6. Confirm existing attachment and emoji controls still work.
7. Open `/dashboard/contacts`.
8. Search by name, email, phone, or company.
9. Click a contact.
10. Confirm the selected contact shows contact methods and analytics, not message bubbles.
11. Click "Open latest conversation" and confirm it navigates to the inbox thread.

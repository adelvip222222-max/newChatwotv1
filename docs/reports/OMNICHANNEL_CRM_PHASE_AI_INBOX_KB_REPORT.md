# Omnichannel CRM Phase — AI Flexibility, Inbox UX, KB Management, Permissions, Voice

## Scope
This phase was implemented as a safe application-layer update without changing the existing Meta/WhatsApp/Messenger/Instagram provider webhook flow or the current channel connection logic.

## 1. AI bot behavior and routing

### What changed
- The AI handoff behavior is now less aggressive.
- The default repeated-user limit is now two chances instead of one.
- Low knowledge confidence no longer causes immediate human handoff; the bot asks a targeted clarification first and only escalates after the configured clarification chances are exhausted.
- If the assistant repeats itself, it now sends one repair/clarification response before escalating to a human.
- The AI now infers customer intent and can auto-route the conversation to the most relevant AI persona/employee when possible:
  - Sales intent: prices, plans, products, offers, buying, demos.
  - Support intent: issues, errors, bugs, account problems, complaints.
  - Billing intent: invoice, payment, renewal, cancellation, subscription.
  - Booking intent: appointments, reservation, scheduling.

### Files changed
- `src/lib/ai.ts`

### Environment tuning
Recommended production values:

```env
AI_MAX_REPEATED_USER_TURNS=2
AI_MAX_CLARIFICATION_TURNS=2
AI_MAX_AUTO_TURNS=10
```

## 2. Inbox conversations page layout

### What changed
- The top statistics/filter area was compacted to give the conversation list more vertical space.
- The analytics cards were changed into compact chips.
- Filters, status, priority and channel chips take less height.
- Archive and delete actions were added in the conversation header.

### Files changed
- `src/components/inbox/ai-inbox-client.tsx`

## 3. Conversation archive and delete

### What changed
- Archive uses the existing status update flow and sets the conversation to `archived`.
- Delete permanently removes the conversation and related records:
  - messages
  - notes
  - events
  - insights
  - conversation document
- A realtime `conversation.deleted` event is published so other open tabs update automatically.

### Files changed
- `src/lib/inbox/service.ts`
- `src/app/api/inbox/conversations/[id]/route.ts`
- `src/lib/realtime/types.ts`
- `src/lib/realtime/events.ts`
- `src/components/inbox/ai-inbox-client.tsx`

## 4. Super-admin role and forced admin routing

### What changed
- Added explicit `super-admin` role support.
- A user with `role: "super-admin"` is treated as platform super admin.
- A super-admin is forced from `/dashboard` to `/admin` by middleware.
- `/admin` and `/developer` stay protected for platform admins only.
- New workspace registrations default to `admin` as the workspace owner/admin, not platform admin.

### Files changed
- `src/server/permissions/roles.ts`
- `src/lib/models/user.ts`
- `src/lib/auth.ts`
- `src/lib/authz.ts`
- `src/server/auth/guards.ts`
- `src/middleware.ts`
- `src/app/api/auth/register/route.ts`

## 5. Knowledge Base management screen

### What changed
The Knowledge Base dashboard now supports direct management of added knowledge sources:

- Table of all knowledge items.
- Shows type, status, chunk count, updated date and status reason.
- Edit title, URL, tags and raw content.
- Delete knowledge source.
- Retrain a single document.
- Rewrite a knowledge source using AI, preserving facts and marking it for retraining.

### Files changed
- `src/components/dashboard/knowledge-manager.tsx`
- `src/lib/knowledge.ts`
- `src/app/api/knowledge/[id]/route.ts`
- `src/app/api/knowledge/[id]/rewrite/route.ts`

## 6. Register onboarding flow

### What changed
The registration flow is now split into five steps:

1. Registration.
2. Templates / knowledge setup.
3. Mandatory activation step.
4. Channels, skippable.
5. AI employees, skippable.

### Files changed
- `src/components/auth/register-form.tsx`
- `src/app/api/auth/register/route.ts`

## 7. Notification sound

### What changed
- A short notification sound is played when a new incoming realtime message is received.
- The implementation uses the browser Web Audio API and does not require extra packages.
- Browser autoplay rules may require one user interaction before sound can play.

### Files changed
- `src/components/dashboard/realtime-bridge.tsx`

## 8. Voice messages

### What changed
- The conversation composer can now record audio from the browser microphone.
- Audio messages are added as attachments and can be sent with or without text.
- Received or sent audio attachments render with an inline audio player.
- File picker now accepts audio files.

### Files changed
- `src/components/inbox/ai-inbox-client.tsx`

## 9. Channel safety

This phase intentionally avoids changing the working channel providers and webhook processors:

- No provider send/receive logic was changed.
- No Meta OAuth behavior was changed.
- No WhatsApp/Facebook/Instagram webhook contract was changed.
- Changes are restricted to AI policy, inbox UI/actions, knowledge management, permissions, register flow and realtime UI events.

## Validation notes
- A TypeScript syntax check was attempted in the sandbox.
- The sandbox does not have `node_modules`, so full `npm run build` could not be completed there.
- One syntax issue discovered during local checking in `src/lib/knowledge.ts` was fixed.
- Final validation must be run on the server or local machine after dependencies are installed.

## Recommended deployment steps

```bash
npm install --legacy-peer-deps --registry=https://registry.npmjs.org/
npm run build
pm2 reload ecosystem.config.js --update-env
```

## Recommended post-deploy checks

```bash
pm2 list
pm2 logs chatzi-web --lines 80
pm2 logs worker-ingress --lines 80
pm2 logs worker-ai --lines 80
pm2 logs worker-egress --lines 80
```

Then test:

1. Login as `super-admin` and confirm automatic redirect to `/admin`.
2. Login as normal workspace `admin` and confirm access to `/dashboard`.
3. Send a Messenger/WhatsApp message and confirm channel behavior is unchanged.
4. Confirm new message appears in inbox and notification sound plays after a user interaction.
5. Record and send an audio reply from the inbox.
6. Archive and delete a test conversation.
7. Edit/rewrite/retrain a Knowledge Base item.

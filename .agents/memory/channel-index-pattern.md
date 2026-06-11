---
name: Channel unique index pattern
description: How to prevent duplicate channel registrations without blocking multi-channel-per-bot.
---

**Rule:** Channel uniqueness must be enforced per external provider account, NOT per (tenantId, botId, type) compound. The compound unique index blocks legitimate cases like a tenant having two Facebook pages on different bots.

**Why:** The original `{ tenantId, botId, type }` unique index was removed (H1 hotfix) because it prevented valid multi-channel configurations.

**How to apply:** Use five sparse unique indexes on `config.pageId`, `config.instagramBusinessId`, `config.phoneNumberId`, `config.externalChannelId`, `config.botToken` — all with `{ unique: true, sparse: true }`. This prevents duplicate external accounts while allowing multiple channels of the same type.

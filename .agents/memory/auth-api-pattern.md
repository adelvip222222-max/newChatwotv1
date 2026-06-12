---
name: Auth pattern in API routes
description: How to authenticate in Next.js API route handlers in this project.
---

**Rule:** Use `requireAuth()` or `requirePermission(permissions.X)` from `@/server/auth/guards`. The returned session object has `.user.tenantId` and `.user.id`, but TypeScript types say `Property 'user' does not exist on type '{}'` — cast session as `any` to work around this pre-existing type gap.

**Why:** The session type augmentation is incomplete in this project's NextAuth setup. All existing API routes have the same TS2339 error on `session.user`. Runtime works correctly.

**How to apply:**
```typescript
import { requireAuth } from "@/server/auth/guards";
let session: any;
try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
// Now use: session.user.tenantId, session.user.id
```

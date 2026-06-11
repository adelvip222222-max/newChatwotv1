---
name: Schema.Types TS error
description: Schema.Types.ObjectId fails tsc but works at runtime in this project.
---

**Rule:** `Schema.Types.ObjectId` produces `error TS2339: Property 'Types' does not exist on type 'typeof Schema'` under `moduleResolution: "bundler"` in this project's tsconfig. This affects ALL model files (task.ts, contact.ts, channel.ts, and every new model). It is pre-existing and not introduced by new code.

**Why:** The tsconfig uses `moduleResolution: "bundler"` which resolves mongoose types differently. The mongoose package types don't expose `Schema.Types` as a static property in this resolution mode. However, Next.js compiles with SWC/Babel (not tsc), so the runtime is unaffected.

**How to apply:** Accept this TS error in model files as pre-existing. Do NOT try to "fix" it with `import Types from "mongoose"` (that's also wrong). If strict TS compliance is needed in the future, use `import mongoose from "mongoose"; ... type: mongoose.Schema.Types.ObjectId` or declare a module augmentation.

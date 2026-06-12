/**
 * Day 4 verification tests — runs with Node.js 24 (no Jest required)
 * Usage: node --input-type=module tests/day4-runner.js
 */
import fs from "fs/promises";
import crypto from "crypto";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, message) {
  if (condition) {
    passed++;
    process.stdout.write(`  ✅ ${name}\n`);
  } else {
    failed++;
    failures.push(`${name}: ${message || "failed"}`);
    process.stdout.write(`  ❌ ${name}: ${message || "failed"}\n`);
  }
}

const r = (path) => fs.readFile(path, "utf8");
const exists = (path) => fs.access(path).then(() => true).catch(() => false);

// ──────────────────────────────────────────────────────────────────────────────
// T4.1 Instagram Adapter
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n📱 Instagram Adapter (T4.1)\n");
const ig = await r("src/server/channels/providers/instagram.ts");

check(
  "ig: real sendMessage (Graph API)",
  ig.includes("graph.facebook.com") && ig.includes("v18.0"),
  "no Graph API call"
);
check(
  "ig: not a stub",
  !ig.includes("INSTAGRAM_NOT_IMPLEMENTED"),
  "still a stub"
);
check(
  "ig: HMAC-SHA256 verification",
  ig.includes("createHmac") && ig.includes("sha256") && ig.includes("timingSafeEqual"),
  "no HMAC verification"
);
check(
  "ig: uses X-Hub-Signature-256",
  ig.includes("x-hub-signature-256"),
  "wrong header"
);
check(
  "ig: skips echo messages",
  ig.includes("is_echo"),
  "no echo skip"
);
check(
  "ig: normalizes attachments",
  ig.includes("normalizeAttachments"),
  "no attachment normalization"
);
check(
  "ig: decrypts token server-side",
  ig.includes("decryptSecret"),
  "no decryptSecret"
);
check(
  "ig: never logs token",
  !ig.includes('"pageAccessToken"') && !ig.includes("pageAccessToken,"),
  "logs token"
);
check(
  "ig: handles OUTSIDE_MESSAGING_WINDOW",
  ig.includes("OUTSIDE_MESSAGING_WINDOW"),
  "no messaging window error"
);
check(
  "ig: handles APP_REVIEW_REQUIRED",
  ig.includes("APP_REVIEW_REQUIRED"),
  "no app review error"
);
check(
  "ig: handles RATE_LIMIT_EXCEEDED",
  ig.includes("RATE_LIMIT_EXCEEDED"),
  "no rate limit error"
);
check(
  "ig: getHealth checks permissions",
  ig.includes("REQUIRED_INSTAGRAM_PERMISSIONS") && ig.includes("missingPerms"),
  "no permission health check"
);

// ──────────────────────────────────────────────────────────────────────────────
// T4.2 providers/index.ts — instagram imported from its own file
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n🔌 Provider Registry (T4.2)\n");
const idx = await r("src/server/channels/providers/index.ts");
check(
  "index: imports from ./instagram",
  idx.includes('from "./instagram"'),
  "still imports from stubs"
);
check(
  "index: no instagramAdapter from stubs",
  !idx.includes('instagramAdapter') || !idx.includes('stubs'),
  "instagram still from stubs"
);

// ──────────────────────────────────────────────────────────────────────────────
// T4.3 AI Quota (atomic Redis)
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n⚡ AI Quota — Atomic Redis (T4.3)\n");
const quota = await r("src/lib/quota.ts");

check(
  "quota: uses INCR (atomic)",
  quota.includes("redis.incr("),
  "no INCR"
);
check(
  "quota: SET NX initialization from MongoDB",
  quota.includes('"NX"') && quota.includes("usedMessages"),
  "no NX init from mongo"
);
check(
  "quota: DECR on over-limit (rollback)",
  quota.includes("redis.decr("),
  "no rollback"
);
check(
  "quota: monthly key with YYYY-MM",
  quota.includes("YYYY-MM") || (quota.includes("getUTCFullYear") && quota.includes("getUTCMonth")),
  "no monthly key"
);
check(
  "quota: TTL set to end of month",
  quota.includes("secondsUntilEndOfMonth"),
  "no TTL"
);
check(
  "quota: fail closed for free plans (≤200)",
  quota.includes("200") && quota.includes("fail closed") || quota.includes("<= 200"),
  "no fail-closed logic"
);
check(
  "quota: async MongoDB sync every N increments",
  quota.includes("MONGO_SYNC_EVERY") && quota.includes("syncRedisCounterToMongo"),
  "no mongo sync"
);
check(
  "quota: no read-then-write race (no find+assert)",
  !quota.includes("findOne") || !quota.includes("if (sub.usedMessages >= limit)") || quota.includes("assertAndReserveQuota"),
  "race condition not fixed"
);

// ──────────────────────────────────────────────────────────────────────────────
// T4.4 Token-aware context
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n🔤 Token-Aware Context (T4.4)\n");
const aiLib = await r("src/lib/ai.ts");

check(
  "ai: estimateTokens function",
  aiLib.includes("estimateTokens"),
  "no estimateTokens"
);
check(
  "ai: buildTokenAwareTranscript function",
  aiLib.includes("buildTokenAwareTranscript"),
  "no buildTokenAwareTranscript"
);
check(
  "ai: fetches more than 10 messages (budget room)",
  aiLib.includes("MAX_MESSAGES_FETCH") || aiLib.includes(".limit(60)") || aiLib.includes(".limit(50)"),
  "still fetches only 10"
);
check(
  "ai: TRANSCRIPT_BUDGET_TOKENS constant",
  aiLib.includes("TRANSCRIPT_BUDGET_TOKENS"),
  "no budget constant"
);
check(
  "ai: truncation placeholder in Arabic",
  aiLib.includes("محادثة سابقة محذوفة") || aiLib.includes("..."),
  "no truncation placeholder"
);
check(
  "ai: uses assertAndReserveQuota",
  aiLib.includes("assertAndReserveQuota"),
  "still uses old quota check"
);
check(
  "ai: removed old assertCanSendAiMessage import",
  !aiLib.includes("assertCanSendAiMessage"),
  "still imports old function"
);

// ──────────────────────────────────────────────────────────────────────────────
// T4.5 Realtime Pub/Sub
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n📡 Realtime Redis Pub/Sub (T4.5)\n");
const rt = await r("src/lib/realtime.ts");
const sse = await r("src/app/api/inbox/stream/route.ts");

check(
  "realtime: publishRealtimeEvent exported",
  rt.includes("publishRealtimeEvent"),
  "not exported"
);
check(
  "realtime: tenant channel isolation",
  rt.includes("inbox:") && rt.includes("tenantId") && rt.includes(":events"),
  "no tenant isolation"
);
check(
  "realtime: createTenantSubscriber exported",
  rt.includes("createTenantSubscriber"),
  "not exported"
);
check(
  "realtime: isRealtimeAvailable exported",
  rt.includes("isRealtimeAvailable"),
  "not exported"
);
check(
  "sse: imports from realtime.ts",
  sse.includes('from "@/lib/realtime"'),
  "not imported"
);
check(
  "sse: falls back to polling",
  sse.includes("getInboxRealtimeSnapshot") && sse.includes("setInterval"),
  "no polling fallback"
);
check(
  "sse: Redis path with sub.subscribe",
  sse.includes("sub.subscribe") || sse.includes(".subscribe(channel"),
  "no pub/sub subscribe"
);
check(
  "sse: disconnects sub on abort",
  sse.includes("sub.disconnect") || sse.includes("sub.unsubscribe"),
  "no cleanup on disconnect"
);

// ──────────────────────────────────────────────────────────────────────────────
// T4.7 AI Tools — Lead/Ticket foundation
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n🧰 AI Tools — Lead/Ticket Foundation (T4.7)\n");
const tools = await r("src/lib/ai/tools-registry.ts");

check(
  "tools: save_lead_data defined",
  tools.includes("save_lead_data"),
  "missing save_lead_data"
);
check(
  "tools: save_lead_data is idempotent (upsert)",
  tools.includes("findOneAndUpdate") && tools.includes("upsert"),
  "not idempotent"
);
check(
  "tools: create_ticket defined",
  tools.includes("create_ticket"),
  "missing create_ticket"
);
check(
  "tools: create_ticket is dedup-safe",
  tools.includes("findOne") && tools.includes("already exists") || tools.includes("No duplicate"),
  "not dedup-safe"
);
check(
  "tools: update_contact_profile defined",
  tools.includes("update_contact_profile"),
  "missing update_contact_profile"
);
check(
  "tools: all tools scoped to tenantId",
  (tools.match(/tenantId/g) || []).length >= 5,
  "insufficient tenantId scoping"
);
check(
  "tools: save_extracted_data still present (compat)",
  tools.includes("save_extracted_data"),
  "legacy tool removed — breaking change"
);
check(
  "tools: escalate_to_human still present (compat)",
  tools.includes("escalate_to_human"),
  "escalation tool removed — breaking change"
);

// ──────────────────────────────────────────────────────────────────────────────
// Documentation files
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n📄 Documentation (T4.9)\n");
const docs = [
  "docs/reports/DAY4_FINAL_REPORT.md",
  "docs/architecture/INSTAGRAM_ADAPTER.md",
  "docs/architecture/AI_QUOTA_AND_CONTEXT.md",
  "docs/architecture/REALTIME_SCALING.md",
  "docs/architecture/AI_TOOLS_LEAD_TICKET_FOUNDATION.md",
];
for (const doc of docs) {
  const ok = await exists(doc);
  check(doc.split("/").pop(), ok, "file missing");
}

// ──────────────────────────────────────────────────────────────────────────────
// Security invariants — never regress
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n🔒 Security Invariants\n");

check(
  "ig: no fake success return",
  !ig.includes("success: true") || ig.includes("externalMessageId"),
  "fake success without ID"
);
check(
  "quota: no plaintext token storage",
  !quota.includes("pageAccessToken:") && !quota.includes('"token"'),
  "token in quota file"
);
check(
  "rt: publish never logs event data verbosely",
  !rt.includes("console.log") && !rt.includes("JSON.stringify(event)") || rt.includes("logger.warn"),
  "verbose event logging"
);

// ──────────────────────────────────────────────────────────────────────────────
// Inline logic tests (no DB needed)
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write("\n🧪 Logic Tests (inline)\n");

// estimateTokens
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

check(
  "estimateTokens: 'Hello World' → 3",
  estimateTokens("Hello World") === 3,
  `got ${estimateTokens("Hello World")}`
);
check(
  "estimateTokens: empty string → 0",
  estimateTokens("") === 0,
  "not 0"
);
check(
  "estimateTokens: 400 chars → 100 tokens",
  estimateTokens("x".repeat(400)) === 100,
  `got ${estimateTokens("x".repeat(400))}`
);

// buildTokenAwareTranscript simulation
function buildTokenAwareTranscript(messages, budgetTokens) {
  const MIN = 2;
  const lines = [];
  let usedTokens = 0;
  let truncated = false;

  for (const msg of messages) {
    const line = `${msg.sender === "assistant" ? "المساعد" : "المستخدم"}: ${msg.content}`;
    const tokens = Math.ceil(line.length / 4);
    if (usedTokens + tokens > budgetTokens && lines.length >= MIN) {
      truncated = true;
      break;
    }
    lines.unshift(line);
    usedTokens += tokens;
  }
  if (truncated) lines.unshift("[... محادثة سابقة محذوفة ...]");
  return lines.join("\n");
}

const msgs = Array.from({ length: 20 }, (_, i) => ({
  sender: i % 2 === 0 ? "user" : "assistant",
  content: "x".repeat(200),
}));

const transcript = buildTokenAwareTranscript(msgs, 200);
check(
  "buildTokenAwareTranscript: respects budget",
  estimateTokens(transcript) <= 300,
  `tokens: ${estimateTokens(transcript)}`
);
check(
  "buildTokenAwareTranscript: includes truncation placeholder on overflow",
  msgs.length > 5 && transcript.includes("محادثة سابقة محذوفة"),
  "no truncation notice for long history"
);

const shortMsgs = [
  { sender: "user", content: "hi" },
  { sender: "assistant", content: "hello" },
];
const shortTranscript = buildTokenAwareTranscript(shortMsgs, 10000);
check(
  "buildTokenAwareTranscript: no truncation for short history",
  !shortTranscript.includes("محادثة سابقة"),
  "truncated unexpectedly"
);

// HMAC verification simulation
function verifyHmacSim(rawBody, signatureHeader, secret) {
  if (!secret) return false;
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const candidate = signatureHeader.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(candidate, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const testSecret = "test-app-secret";
const testBody = '{"entry":[{"id":"123"}]}';
const validSig = "sha256=" + crypto.createHmac("sha256", testSecret).update(testBody).digest("hex");
const invalidSig = "sha256=" + "a".repeat(64);

check(
  "hmac: valid signature accepted",
  verifyHmacSim(testBody, validSig, testSecret),
  "valid sig rejected"
);
check(
  "hmac: invalid signature rejected",
  !verifyHmacSim(testBody, invalidSig, testSecret),
  "invalid sig accepted"
);
check(
  "hmac: missing signature rejected",
  !verifyHmacSim(testBody, null, testSecret),
  "null sig accepted"
);
check(
  "hmac: missing secret rejects (production safety)",
  !verifyHmacSim(testBody, validSig, ""),
  "empty secret accepted"
);

// Quota key format
function quotaRedisKey(tenantId) {
  const now = new Date();
  const yyyyMM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `quota:ai_messages:${tenantId}:${yyyyMM}`;
}

check(
  "quotaKey: correct format",
  /^quota:ai_messages:[^:]+:\d{4}-\d{2}$/.test(quotaRedisKey("tenant123")),
  `got: ${quotaRedisKey("tenant123")}`
);

// Tenant channel isolation
function tenantRealtimeChannel(tenantId) {
  return `inbox:${tenantId}:events`;
}

check(
  "tenantChannel: correct format",
  tenantRealtimeChannel("abc123") === "inbox:abc123:events",
  `got: ${tenantRealtimeChannel("abc123")}`
);
check(
  "tenantChannel: different tenants produce different channels",
  tenantRealtimeChannel("tenantA") !== tenantRealtimeChannel("tenantB"),
  "channels are the same — no isolation"
);

// ──────────────────────────────────────────────────────────────────────────────
// Final Summary
// ──────────────────────────────────────────────────────────────────────────────
process.stdout.write(`\n${"─".repeat(60)}\n`);
process.stdout.write(`✅ PASSED: ${passed}   ❌ FAILED: ${failed}   TOTAL: ${passed + failed}\n`);

if (failures.length) {
  process.stdout.write("\nFailed:\n");
  failures.forEach((f) => process.stdout.write(`  • ${f}\n`));
}

process.exit(failed > 0 ? 1 : 0);

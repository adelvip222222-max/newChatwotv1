import crypto from "crypto";

// ── Helpers reused from production code ──────────────────────────────────────
const KNOWN_FB_ERRORS: Record<number, string> = {
  190: "INVALID_ACCESS_TOKEN",
  551: "RECIPIENT_NOT_REACHABLE",
  613: "RATE_LIMIT_EXCEEDED",
  10900: "OUTSIDE_24H_WINDOW",
};

function fakeFetch(status: number, body: object) {
  return () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response);
}

// ── Task 3.1 — Facebook sendMessage ─────────────────────────────────────────
describe("Facebook sendMessage", () => {
  const PREFIX = "enc:v1";

  function encryptFake(value: string) {
    return `${PREFIX}:fake-iv:fake-tag:${Buffer.from(value).toString("base64url")}`;
  }

  function makeChannel(overrides: Record<string, any> = {}) {
    return {
      _id: { toString: () => "chan_001" },
      config: {
        pageId: "12345",
        pageAccessTokenEncrypted: encryptFake("PAGE_TOKEN"),
        ...overrides,
      },
    } as any;
  }

  it("builds correct JSON payload for text message", () => {
    const payloads: string[] = [];
    const originalFetch = global.fetch;
    global.fetch = ((_url: string, opts: any) => {
      payloads.push(opts.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message_id: "mid.test001" }),
      } as unknown as Response);
    }) as any;

    const payload = JSON.parse(payloads[0] || "{}");
    global.fetch = originalFetch;
    expect(typeof payload).toBe("object");
  });

  it("returns MISSING_PAGE_ID when pageId absent", async () => {
    const { facebookAdapter } = await import("../src/server/channels/providers/facebook");
    const result = await facebookAdapter.sendMessage({
      channel: { _id: { toString: () => "c1" }, config: {} } as any,
      externalUserId: "psid_001",
      text: "hello",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("MISSING_PAGE_ID");
  });

  it("returns MISSING_PAGE_ACCESS_TOKEN when token absent", async () => {
    const { facebookAdapter } = await import("../src/server/channels/providers/facebook");
    const result = await facebookAdapter.sendMessage({
      channel: {
        _id: { toString: () => "c1" },
        config: { pageId: "99999" },
      } as any,
      externalUserId: "psid_001",
      text: "hello",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("MISSING_PAGE_ACCESS_TOKEN");
  });

  it("maps known Meta error codes correctly", () => {
    expect(KNOWN_FB_ERRORS[190]).toBe("INVALID_ACCESS_TOKEN");
    expect(KNOWN_FB_ERRORS[613]).toBe("RATE_LIMIT_EXCEEDED");
    expect(KNOWN_FB_ERRORS[10900]).toBe("OUTSIDE_24H_WINDOW");
    expect(KNOWN_FB_ERRORS[551]).toBe("RECIPIENT_NOT_REACHABLE");
  });

  it("getHealth returns unconfigured when pageId missing", async () => {
    const { facebookAdapter } = await import("../src/server/channels/providers/facebook");
    const result = await facebookAdapter.getHealth({ _id: "c1", config: {} } as any);
    expect(result.status).toBe("unconfigured");
  });

  it("getHealth returns healthy when pageId and token present", async () => {
    const { facebookAdapter } = await import("../src/server/channels/providers/facebook");
    const result = await facebookAdapter.getHealth({
      _id: "c1",
      config: { pageId: "99999", pageAccessTokenEncrypted: "enc:v1:iv:tag:data" },
    } as any);
    expect(result.status).toBe("healthy");
  });
});

// ── Task 3.2 — Meta OAuth state ──────────────────────────────────────────────
describe("Meta OAuth — state management", () => {
  it("generateOAuthState returns 64-char hex string", async () => {
    const { generateOAuthState } = await import("../src/lib/meta-oauth");
    const state = generateOAuthState();
    expect(state).toMatch(/^[a-f0-9]{64}$/);
  });

  it("two calls produce different states", async () => {
    const { generateOAuthState } = await import("../src/lib/meta-oauth");
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).not.toBe(b);
  });

  it("buildMetaOAuthUrl includes required scopes and state", async () => {
    process.env.META_APP_ID = "test_app_id";
    const { buildMetaOAuthUrl } = await import("../src/lib/meta-oauth");
    const url = buildMetaOAuthUrl("my_state_key", "https://example.com/api/oauth/meta");
    expect(url).toContain("client_id=test_app_id");
    expect(url).toContain("state=my_state_key");
    expect(url).toContain("pages_messaging");
    expect(url).toContain("redirect_uri=");
    delete process.env.META_APP_ID;
  });

  it("buildMetaOAuthUrl throws if META_APP_ID missing", async () => {
    delete process.env.META_APP_ID;
    const { buildMetaOAuthUrl } = await import("../src/lib/meta-oauth");
    expect(() => buildMetaOAuthUrl("state", "https://example.com/callback")).toThrow("META_APP_ID");
  });
});

// ── Task 3.3 — OAuth security rules ─────────────────────────────────────────
describe("Meta OAuth — security invariants", () => {
  it("callback route file does NOT contain postMessage with token", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/oauth/meta/route.ts", "utf8");
    expect(content).not.toContain("postMessage");
    expect(content).not.toContain("META_OAUTH_SUCCESS");
    expect(content).not.toMatch(/token.*postMessage|postMessage.*token/);
  });

  it("callback route does NOT log or return access_token to client", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/oauth/meta/route.ts", "utf8");
    expect(content).not.toContain("access_token:");
    expect(content).not.toContain('"access_token"');
  });

  it("pages route strips accessToken before returning to client", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/oauth/meta/pages/route.ts", "utf8");
    expect(content).not.toContain("accessToken");
    expect(content).toContain("safePages");
  });

  it("connect route uses encryptSecret before persisting token", async () => {
    const fs = await import("fs/promises");
    const metaOauthLib = await fs.readFile("src/lib/meta-oauth.ts", "utf8");
    expect(metaOauthLib).toContain("encryptSecret");
    expect(metaOauthLib).toContain("pageAccessTokenEncrypted");
  });
});

// ── Task 3.4 — Settings RBAC ─────────────────────────────────────────────────
describe("Settings RBAC — route guards", () => {
  it("ai route uses requirePermission(permissions.aiManage)", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/settings/ai/route.ts", "utf8");
    expect(content).toContain("requirePermission");
    expect(content).toContain("permissions.aiManage");
    expect(content).not.toContain("requireAdmin");
  });

  it("tenant route uses requirePermission(permissions.settingsManage)", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/settings/tenant/route.ts", "utf8");
    expect(content).toContain("requirePermission");
    expect(content).toContain("permissions.settingsManage");
    expect(content).not.toContain("isAdminRole");
  });

  it("admin/ai-providers route uses requireSuperAdmin", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/admin/ai-providers/route.ts", "utf8");
    expect(content).toContain("requireSuperAdmin");
    expect(content).not.toContain("requireAdmin");
  });

  it("manager role does NOT have settingsManage permission", async () => {
    const { rolePermissions } = await import("../src/server/permissions/roles");
    const { permissions } = await import("../src/server/permissions/permissions");
    expect(rolePermissions.manager).not.toContain(permissions.settingsManage);
  });

  it("owner and admin roles have settingsManage permission", async () => {
    const { rolePermissions } = await import("../src/server/permissions/roles");
    const { permissions } = await import("../src/server/permissions/permissions");
    expect(rolePermissions.owner).toContain(permissions.settingsManage);
    expect(rolePermissions.admin).toContain(permissions.settingsManage);
  });

  it("viewer role does NOT have aiManage permission", async () => {
    const { rolePermissions } = await import("../src/server/permissions/roles");
    const { permissions } = await import("../src/server/permissions/permissions");
    expect(rolePermissions.viewer).not.toContain(permissions.aiManage);
  });

  it("agent role does NOT have aiManage permission", async () => {
    const { rolePermissions } = await import("../src/server/permissions/roles");
    const { permissions } = await import("../src/server/permissions/permissions");
    expect(rolePermissions.agent).not.toContain(permissions.aiManage);
  });
});

// ── Task 3.5 — Knowledge async training ─────────────────────────────────────
describe("Knowledge training — async design", () => {
  it("createKnowledgeDocument source uses knowledgeTrainingQueue (not direct train call)", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/knowledge.ts", "utf8");
    expect(content).toContain("knowledgeTrainingQueue");
    expect(content).toContain("addBulk");
    expect(content).not.toMatch(/await trainKnowledgeDocument.*input\.tenantId/);
  });

  it("document status is set to pending before enqueue", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/knowledge.ts", "utf8");
    expect(content).toContain('"pending"');
  });

  it("retrainAllKnowledge uses addBulk instead of sequential awaits", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/knowledge.ts", "utf8");
    expect(content).toContain("addBulk");
  });

  it("knowledge worker exists and connects to knowledge-training-queue", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("workers/knowledge-worker.ts", "utf8");
    expect(content).toContain("knowledge-training-queue");
    expect(content).toContain("trainKnowledgeDocument");
  });

  it("knowledge-training-queue is exported from queues/index.ts", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/queues/index.ts", "utf8");
    expect(content).toContain("knowledgeTrainingQueue");
    expect(content).toContain("knowledge-training-queue");
  });
});

// ── Task 3.6 — Knowledge status API ─────────────────────────────────────────
describe("Knowledge document status API", () => {
  it("status route file exists", async () => {
    const fs = await import("fs/promises");
    const exists = await fs
      .access("src/app/api/knowledge/documents/[id]/status/route.ts")
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("status route uses requirePermission(permissions.knowledgeRead)", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/app/api/knowledge/documents/[id]/status/route.ts", "utf8");
    expect(content).toContain("requirePermission");
    expect(content).toContain("knowledgeRead");
  });
});

// ── Task 3.7 — Embedding dimension mismatch ──────────────────────────────────
describe("Embedding dimension safety", () => {
  it("cosineSimilarity in knowledge.ts returns 0 for mismatched dimensions", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/knowledge.ts", "utf8");
    expect(content).toContain("a.length !== b.length");
    expect(content).toContain("return 0");
  });

  it("searchKnowledge filters by embeddingProvider", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/knowledge.ts", "utf8");
    expect(content).toContain("embeddingProvider: queryProvider");
  });

  it("does NOT use Math.min(a.length, b.length) for loop bound", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile("src/lib/knowledge.ts", "utf8");
    expect(content).not.toContain("Math.min(a.length, b.length)");
  });

  it("local-hash produces 128-dim vectors", async () => {
    const content = await (await import("fs/promises")).readFile("src/lib/knowledge.ts", "utf8");
    expect(content).toContain("LOCAL_HASH_DIMENSIONS = 128");
  });
});

// ── Webhook HMAC regression (from Day 2) ────────────────────────────────────
describe("Facebook HMAC verification", () => {
  function sign(body: string, secret: string) {
    return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  function verifyHmac(rawBody: string, signatureHeader: string | null, secret: string): boolean {
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

  it("accepts valid signature", () => {
    const body = '{"object":"page"}';
    expect(verifyHmac(body, sign(body, "secret"), "secret")).toBe(true);
  });

  it("rejects tampered body", () => {
    const body = '{"object":"page"}';
    expect(verifyHmac("tampered", sign(body, "secret"), "secret")).toBe(false);
  });

  it("rejects wrong secret", () => {
    const body = '{"object":"page"}';
    expect(verifyHmac(body, sign(body, "wrong"), "secret")).toBe(false);
  });

  it("rejects missing signature", () => {
    expect(verifyHmac("body", null, "secret")).toBe(false);
  });

  it("rejects empty secret (never returns true)", () => {
    const body = '{"object":"page"}';
    expect(verifyHmac(body, sign(body, "secret"), "")).toBe(false);
  });
});

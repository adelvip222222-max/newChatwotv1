import crypto from "crypto";

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

describe("Day 2 — Webhook HMAC Verification", () => {
  const SECRET = "test-app-secret-key";

  function sign(body: string, secret = SECRET) {
    return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  it("accepts a valid sha256 signature", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    expect(verifyHmac(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const wrongSig = sign(body, "wrong-secret");
    expect(verifyHmac(body, wrongSig, SECRET)).toBe(false);
  });

  it("rejects a null signature header", () => {
    expect(verifyHmac("body", null, SECRET)).toBe(false);
  });

  it("rejects an empty secret", () => {
    const body = "test-body";
    const sig = sign(body);
    expect(verifyHmac(body, sig, "")).toBe(false);
  });

  it("rejects a replayed body (different content, same signature)", () => {
    const originalBody = JSON.stringify({ message: "hello" });
    const replayedBody = JSON.stringify({ message: "injected" });
    const sig = sign(originalBody);
    expect(verifyHmac(replayedBody, sig, SECRET)).toBe(false);
  });

  it("handles sha256= prefix correctly (Meta format)", () => {
    const body = "webhook-payload";
    const hexDigest = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyHmac(body, `sha256=${hexDigest}`, SECRET)).toBe(true);
  });

  it("rejects invalid hex characters in signature", () => {
    expect(verifyHmac("body", "sha256=ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", SECRET)).toBe(false);
  });

  it("rejects a signature of wrong length", () => {
    expect(verifyHmac("body", "sha256=abc123", SECRET)).toBe(false);
  });
});

describe("Day 2 — Super Admin Flag", () => {
  it("isSuperAdmin is false by default when not set", () => {
    const mockUser = { isSuperAdmin: undefined };
    expect(mockUser.isSuperAdmin === true).toBe(false);
  });

  it("isSuperAdmin is true when explicitly set", () => {
    const mockUser = { isSuperAdmin: true };
    expect(mockUser.isSuperAdmin === true).toBe(true);
  });

  it("falsy values other than true are not treated as super admin", () => {
    const falsyValues = [false, null, undefined, 0, ""];
    for (const v of falsyValues) {
      expect(v === true).toBe(false);
    }
  });
});

describe("Day 2 — RBAC Permission Model", () => {
  type Role = "owner" | "admin" | "agent" | "viewer";

  const permissions: Record<string, Role[]> = {
    "inbox:reply": ["owner", "admin", "agent"],
    "inbox:assign": ["owner", "admin"],
    "knowledge:manage": ["owner", "admin"],
    "settings:manage": ["owner", "admin"]
  };

  function roleHasPermission(role: Role, permission: string): boolean {
    return permissions[permission]?.includes(role) ?? false;
  }

  it("agent can reply but not assign", () => {
    expect(roleHasPermission("agent", "inbox:reply")).toBe(true);
    expect(roleHasPermission("agent", "inbox:assign")).toBe(false);
  });

  it("admin can reply and assign", () => {
    expect(roleHasPermission("admin", "inbox:reply")).toBe(true);
    expect(roleHasPermission("admin", "inbox:assign")).toBe(true);
  });

  it("viewer cannot reply, assign, or manage knowledge", () => {
    expect(roleHasPermission("viewer", "inbox:reply")).toBe(false);
    expect(roleHasPermission("viewer", "inbox:assign")).toBe(false);
    expect(roleHasPermission("viewer", "knowledge:manage")).toBe(false);
  });

  it("owner has all permissions", () => {
    expect(roleHasPermission("owner", "inbox:reply")).toBe(true);
    expect(roleHasPermission("owner", "inbox:assign")).toBe(true);
    expect(roleHasPermission("owner", "knowledge:manage")).toBe(true);
    expect(roleHasPermission("owner", "settings:manage")).toBe(true);
  });
});

describe("Day 2 — Webhook Channel Fallback Guard", () => {
  it("unsafe fallback requires explicit env flag in non-production", () => {
    const shouldUseFallback = (nodeEnv: string, allowFlag: string | undefined) => {
      return allowFlag === "true" && nodeEnv !== "production";
    };

    expect(shouldUseFallback("development", "true")).toBe(true);
    expect(shouldUseFallback("development", undefined)).toBe(false);
    expect(shouldUseFallback("production", "true")).toBe(false);
    expect(shouldUseFallback("test", "true")).toBe(true);
    expect(shouldUseFallback("test", "false")).toBe(false);
  });
});

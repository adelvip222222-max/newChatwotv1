import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const isProduction = process.env.NODE_ENV === "production";
export { checkRateLimit };

export async function assertTenantAccess(tenantId: string) {
  const session = await getCurrentSession();
  if (!session?.user?.tenantId || session.user.tenantId !== tenantId) {
    throw new Error("Unauthorized tenant access.");
  }
  return session;
}

export function assertObjectIdLike(value: string, label = "id") {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
  options: { maxBytes?: number } = {}
): Promise<z.infer<T>> {
  const maxBytes = options.maxBytes ?? 64 * 1024;
  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new Error("Request body is too large.");
  }

  return schema.parse(JSON.parse(rawBody));
}

export function safeJsonError(error: unknown, fallback = "Request failed.", status = 400) {
  const message = error instanceof Error && !isProduction ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

export function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifySha256Hmac(rawBody: string, signatureHeader: string | null, secret?: string | null) {
  if (!secret) return !isProduction;
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const candidates = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .map((part) => part.replace(/^sha256=/i, ""));

  return candidates.some((candidate) => /^[a-f0-9]{64}$/i.test(candidate) && timingSafeEqualText(candidate, expected));
}

export function verifyBearerSecret(request: Request, secret?: string | null) {
  if (!secret) return !isProduction;
  const header = request.headers.get("authorization") || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return Boolean(token && timingSafeEqualText(token, secret));
}

export function requireConfiguredSecret(value: string | undefined, name: string) {
  if (!value && isProduction) {
    throw new Error(`${name} is not configured.`);
  }
  return value || "";
}

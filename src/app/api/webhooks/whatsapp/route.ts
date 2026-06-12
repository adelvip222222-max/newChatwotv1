import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectIdLike, checkRateLimit, getClientIp, safeJsonError, verifySha256Hmac } from "@/lib/api-security";
import { enqueueInboundWebhook } from "@/server/channels/webhookIngress";

const payloadSchema = z.record(z.unknown());

export async function POST(req: Request) {
  try {
    checkRateLimit(`wa-webhook:${getClientIp(req)}`, { limit: 120, windowMs: 60_000 });

    const signature = req.headers.get("x-hub-signature-256");
    const rawBody = await req.text();

    if (Buffer.byteLength(rawBody, "utf8") > 256 * 1024) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    if (!verifySha256Hmac(rawBody, signature, process.env.WEBHOOK_SECRET || process.env.META_APP_SECRET)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = payloadSchema.parse(JSON.parse(rawBody));
    const url = new URL(req.url);
    const tenantId = String(url.searchParams.get("tenantId") || payload.tenantId || "");
    assertObjectIdLike(tenantId, "tenantId");

    const result = await enqueueInboundWebhook({
      provider: "whatsapp",
      request: req,
      payload,
      tenantId
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return safeJsonError(error, "Webhook processing failed.", 400);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectIdLike, checkRateLimit, getClientIp, safeJsonError, verifyBearerSecret, verifySha256Hmac } from "@/lib/api-security";
import { connectToDatabase } from "@/lib/mongodb";
import { Channel } from "@/lib/models";
import { logWebhook } from "@/lib/channel-service";
import { enqueueInboundWebhook } from "@/server/channels/webhookIngress";

const schema = z.object({
  tenantId: z.string().min(1),
  botId: z.string().min(1),
  userId: z.string().min(1).max(180),
  message: z.string().trim().min(1).max(4000),
  eventId: z.string().optional(),
  messageId: z.string().optional()
});

export async function POST(request: Request) {
  let payload: unknown = null;

  try {
    checkRateLimit(`custom-webhook:${getClientIp(request)}`, { limit: 120, windowMs: 60_000 });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    payload = JSON.parse(rawBody);
    const body = schema.parse(payload);
    const metadata = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : undefined;
    assertObjectIdLike(body.tenantId, "tenantId");
    assertObjectIdLike(body.botId, "botId");

    await connectToDatabase();
    const channel = await Channel.findOne({
      tenantId: body.tenantId,
      botId: body.botId,
      type: "webhook",
      isActive: true
    });

    if (!channel) throw new Error("Webhook channel is not active for this bot.");

    const signingSecret = String(channel.config?.signingSecret || "");
    const hasValidBearer = verifyBearerSecret(request, signingSecret);
    const hasValidSignature = verifySha256Hmac(rawBody, request.headers.get("x-chatzi-signature") || request.headers.get("x-webhook-signature"), signingSecret);
    if (!hasValidBearer && !hasValidSignature) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await logWebhook({
      channel: "webhook",
      payload,
      tenantId: body.tenantId,
      botId: body.botId
    });

    const result = await enqueueInboundWebhook({
      provider: "webhook",
      request,
      tenantId: body.tenantId,
      channelId: channel._id.toString(),
      payload: {
        ...metadata,
        eventId: body.eventId || body.messageId,
        messageId: body.messageId || body.eventId,
        userId: body.userId,
        message: body.message
      }
    });

    await logWebhook({
      channel: "webhook",
      payload,
      status: "success",
      tenantId: body.tenantId,
      botId: body.botId
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ ok: true, queued: true, traceId: result.traceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    await logWebhook({ channel: "webhook", payload, status: "error", error: message }).catch(() => null);
    return safeJsonError(error, "Webhook error.", 400);
  }
}

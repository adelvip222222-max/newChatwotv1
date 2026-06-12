import crypto from "crypto";
import { Channel, WebhookEvent } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";
import { defaultJobOptions, ingressQueue, makeQueueJobId } from "@/lib/queues";
import { logger } from "@/lib/logger";
import { getAdapter } from "./registry";
import { initializeAdapters } from "./providers";
import type { ChannelProvider } from "./types";

initializeAdapters();

type EnqueueWebhookInput = {
  provider: ChannelProvider;
  request: Request;
  payload: any;
  rawBody?: string;
  channelId?: string;
  tenantId?: string;
  externalEventId?: string;
  traceId?: string;
};

export function createTraceId(prefix = "trace") {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
}

export function serializeHeaders(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

export function extractExternalEventId(provider: ChannelProvider, payload: any) {
  if (provider === "telegram") return payload?.update_id ? String(payload.update_id) : "";

  if (provider === "whatsapp") {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    return String(value?.messages?.[0]?.id || value?.statuses?.[0]?.id || payload?.eventId || payload?.messageId || "");
  }

  if (provider === "facebook" || provider === "instagram") {
    const messaging = payload?.entry?.[0]?.messaging?.[0];
    return String(messaging?.message?.mid || messaging?.postback?.mid || payload?.eventId || "");
  }

  if (provider === "website" || provider === "webhook" || provider === "api") {
    return String(payload?.eventId || payload?.id || payload?.messageId || "");
  }

  return String(payload?.eventId || payload?.id || payload?.messageId || "");
}

export async function enqueueInboundWebhook(input: EnqueueWebhookInput) {
  await connectToDatabase();

  const traceId = input.traceId || createTraceId(input.provider);
  const externalEventId = input.externalEventId || extractExternalEventId(input.provider, input.payload) || createPayloadHash(input.payload);
  const channel = await resolveInboundChannel(input);

  if (!channel && !input.tenantId) {
    return { ok: false, status: 404, error: "Channel not found or inactive", traceId };
  }

  if (channel) {
    const adapter = getAdapter(input.provider);
    const isValid = await adapter.verifyWebhook(input.request, channel, input.rawBody);
    if (!isValid) return { ok: false, status: 403, error: "Invalid webhook signature", traceId };
  }

  const tenantId = String(channel?.tenantId || input.tenantId || "");
  const channelId = channel?._id?.toString() || input.channelId;
  const jobId = makeQueueJobId(input.provider, externalEventId);

  try {
    const event = await WebhookEvent.findOneAndUpdate(
      { provider: input.provider, externalEventId },
      {
        $setOnInsert: {
          tenantId,
          channelId,
          provider: input.provider,
          externalEventId,
          eventType: "message",
          status: "received",
          rawPayload: input.payload,
          metadata: { traceId }
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (event.status !== "received" || event.metadata?.traceId !== traceId) {
      logger.info("webhook.duplicate", { provider: input.provider, externalEventId, tenantId, traceId });
      return { ok: true, duplicate: true, status: 200, traceId, externalEventId };
    }
  } catch (error: any) {
    if (error?.code === 11000) {
      logger.info("webhook.duplicate", { provider: input.provider, externalEventId, tenantId, traceId });
      return { ok: true, duplicate: true, status: 200, traceId, externalEventId };
    }
    throw error;
  }

  await ingressQueue.add(
    "process-inbound-webhook",
    {
      tenantId,
      provider: input.provider,
      channelId,
      externalEventId,
      rawPayload: input.payload,
      rawHeaders: serializeHeaders(input.request),
      traceId
    },
    {
      ...defaultJobOptions,
      jobId
    }
  );

  logger.info("webhook.enqueued", { provider: input.provider, externalEventId, tenantId, channelId, traceId });
  return { ok: true, duplicate: false, status: 200, traceId, externalEventId };
}

async function resolveInboundChannel({ provider, channelId, request, payload, tenantId }: EnqueueWebhookInput) {
  if (channelId) {
    return Channel.findOne({ _id: channelId, ...(tenantId ? { tenantId } : {}), type: provider, isActive: true });
  }

  const providerSpecificQuery = buildProviderChannelQuery(provider, request, payload);
  if (providerSpecificQuery) {
    const matched = await Channel.findOne({ type: provider, isActive: true, ...providerSpecificQuery });
    if (matched) return matched;
  }

  if (tenantId) {
    return Channel.findOne({ tenantId, type: provider, isActive: true });
  }

  if (process.env.ALLOW_UNSAFE_CHANNEL_FALLBACK === "true" && process.env.NODE_ENV !== "production") {
    const candidates = await Channel.find({ type: provider, isActive: true }).limit(2);
    if (candidates.length === 1) {
      logger.warn("webhook.unsafe_channel_fallback_used", { provider });
      return candidates[0];
    }
  }

  logger.warn("webhook.channel_not_resolved", { provider });
  return null;
}

function buildProviderChannelQuery(provider: ChannelProvider, request: Request, payload: any) {
  if (provider === "telegram") {
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    return secret ? { "config.webhookSecret": secret } : null;
  }

  if (provider === "whatsapp") {
    const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    return phoneNumberId ? { "config.phoneNumberId": phoneNumberId } : null;
  }

  if (provider === "facebook") {
    const pageId = payload?.entry?.[0]?.id;
    return pageId ? { "config.pageId": pageId } : null;
  }

  if (provider === "instagram") {
    const instagramBusinessId = payload?.entry?.[0]?.id;
    return instagramBusinessId ? { "config.instagramBusinessId": instagramBusinessId } : null;
  }

  return null;
}

function createPayloadHash(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

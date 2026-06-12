import crypto from "crypto";
import { ChannelDocument } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { ProviderAdapter, NormalizedAttachment, NormalizedIncomingMessage, SendMessageParams } from "../types";

const META_GRAPH_VERSION = "v18.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

function resolveAppSecret(channel?: ChannelDocument): string {
  const perChannel = channel?.config?.appSecret as string | undefined;
  if (perChannel) return perChannel;
  return process.env.META_APP_SECRET || "";
}

function verifyHmac(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const candidate = signatureHeader.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(candidate, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}


function normalizeFacebookAttachments(attachments?: any[]): NormalizedAttachment[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((attachment: any): NormalizedAttachment | null => {
    const type = attachment?.type as string | undefined;
    const url = attachment?.payload?.url as string | undefined;
    if (!url) return null;
    let normalizedType: NormalizedAttachment["type"] = "other";
    if (type === "image") normalizedType = "image";
    else if (type === "audio") normalizedType = "audio";
    else if (type === "video") normalizedType = "video";
    else if (type === "file") normalizedType = "document";
    return { type: normalizedType, url, name: attachment?.title || type || "attachment" };
  }).filter((item): item is NormalizedAttachment => item !== null);
}

function facebookText(message: any, postback: any) {
  return message?.text || postback?.title || (message?.attachments?.length ? "أرسل العميل مرفقًا." : "");
}

const KNOWN_FB_ERRORS: Record<number, string> = {
  190: "INVALID_ACCESS_TOKEN",
  200: "PERMISSION_ERROR",
  551: "RECIPIENT_NOT_REACHABLE",
  613: "RATE_LIMIT_EXCEEDED",
  10: "APP_NOT_SUBSCRIBED",
  100: "INVALID_PARAMETER",
  10900: "OUTSIDE_24H_WINDOW",
  10901: "OUTSIDE_24H_WINDOW",
};

export const facebookAdapter: ProviderAdapter = {
  provider: "facebook",

  async verifyWebhook(request: Request, channel?: ChannelDocument, rawBody?: string): Promise<boolean> {
    const body = rawBody ?? "";
    const signature = request.headers.get("x-hub-signature-256");
    const secret = resolveAppSecret(channel);
    const valid = verifyHmac(body, signature, secret);
    if (!valid) {
      logger.warn("facebook.webhook_signature_invalid", {
        channelId: channel?._id?.toString(),
        hasSignature: Boolean(signature),
        hasSecret: Boolean(secret),
      });
    }
    return valid;
  },

  async normalizeIncoming(payload: any, _channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]> {
    const messages: NormalizedIncomingMessage[] = [];
    for (const entry of payload.entry || []) {
      for (const item of entry.messaging || []) {
        const mid = item.message?.mid || item.postback?.mid || `${entry.id}:${item.timestamp}`;
        if (!item.sender?.id || (!item.message && !item.postback)) continue;
        messages.push({
          provider: "facebook",
          externalEventId: String(mid),
          externalUserId: String(item.sender.id),
          externalThreadId: String(item.recipient?.id || entry.id || ""),
          externalMessageId: String(mid),
          text: facebookText(item.message, item.postback),
          attachments: normalizeFacebookAttachments(item.message?.attachments),
          customer: {},
          timestamp: item.timestamp ? new Date(Number(item.timestamp)) : new Date(),
          raw: item,
        });
      }
    }
    return messages;
  },

  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }> {
    const config = params.channel?.config as Record<string, any> | undefined;
    const pageId = config?.pageId as string | undefined;
    const encryptedToken = config?.pageAccessTokenEncrypted || config?.pageAccessToken as string | undefined;

    if (!pageId) {
      logger.error("facebook.send_missing_page_id", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "MISSING_PAGE_ID" };
    }

    if (!encryptedToken) {
      logger.error("facebook.send_missing_page_access_token", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "MISSING_PAGE_ACCESS_TOKEN" };
    }

    const pageAccessToken = decryptSecret(encryptedToken);
    if (!pageAccessToken) {
      logger.error("facebook.send_decrypt_failed", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "PAGE_ACCESS_TOKEN_DECRYPT_FAILED" };
    }

    const url = `${META_GRAPH_BASE}/me/messages`;
    const body = JSON.stringify({
      recipient: { id: params.externalUserId },
      message: { text: params.text },
      messaging_type: "RESPONSE",
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pageAccessToken}`,
        },
        body,
      });
    } catch (networkError) {
      logger.error("facebook.send_network_error", {
        channelId: params.channel?._id?.toString(),
        error: networkError instanceof Error ? networkError.message : "network_error",
      });
      return { success: false, error: "NETWORK_ERROR" };
    }

    const json = await response.json().catch(() => ({})) as Record<string, any>;

    if (!response.ok) {
      const errCode = json?.error?.code as number | undefined;
      const errorType = errCode ? (KNOWN_FB_ERRORS[errCode] || `FACEBOOK_ERROR_${errCode}`) : "FACEBOOK_API_ERROR";

      logger.error("facebook.send_api_error", {
        channelId: params.channel?._id?.toString(),
        errorType,
        httpStatus: response.status,
        fbErrorCode: errCode,
      });
      return { success: false, error: errorType };
    }

    const externalMessageId = json?.message_id as string | undefined;
    logger.info("facebook.send_ok", {
      channelId: params.channel?._id?.toString(),
      externalMessageId,
    });
    return { success: true, externalMessageId };
  },

  async parseDeliveryStatus(payload: any): Promise<{ externalMessageId: string; status: string; error?: any } | null> {
    for (const entry of payload.entry || []) {
      for (const item of entry.messaging || []) {
        if (item.delivery?.mids?.length) {
          return { externalMessageId: String(item.delivery.mids[0]), status: "delivered" };
        }
        if (item.read && item.message?.mid) {
          return { externalMessageId: String(item.message.mid), status: "read" };
        }
      }
    }
    return null;
  },

  async getHealth(channel: ChannelDocument): Promise<{ status: "healthy" | "error" | "unconfigured"; message?: string }> {
    const config = channel?.config as Record<string, any> | undefined;
    if (!config?.pageId) return { status: "unconfigured", message: "pageId missing" };
    const tokenExists = !!(config.pageAccessTokenEncrypted || config.pageAccessToken);
    if (!tokenExists) return { status: "unconfigured", message: "pageAccessToken missing" };
    return { status: "healthy" };
  },
};

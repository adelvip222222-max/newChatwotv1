import crypto from "crypto";
import { ChannelDocument } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { ProviderAdapter, NormalizedIncomingMessage, NormalizedAttachment, SendMessageParams } from "../types";

const META_GRAPH_VERSION = "v18.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const REQUIRED_INSTAGRAM_PERMISSIONS = ["instagram_manage_messages", "instagram_basic", "pages_show_list"];

function resolveAppSecret(channel?: ChannelDocument): string {
  const config = channel?.config as Record<string, any> | undefined;
  if (config?.appSecretEncrypted) {
    const decrypted = decryptSecret(config.appSecretEncrypted as string);
    if (decrypted) return decrypted;
  }
  if (config?.appSecret) return config.appSecret as string;
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

function normalizeAttachments(attachments?: any[]): NormalizedAttachment[] {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((a: any): NormalizedAttachment | null => {
      const type = a?.type as string | undefined;
      const payload = a?.payload as Record<string, any> | undefined;
      const url = payload?.url as string | undefined;
      if (!url) return null;
      let normalizedType: NormalizedAttachment["type"] = "other";
      if (type === "image") normalizedType = "image";
      else if (type === "video") normalizedType = "video";
      else if (type === "audio") normalizedType = "audio";
      else if (type === "file") normalizedType = "document";
      return { type: normalizedType, url };
    })
    .filter((a): a is NormalizedAttachment => a !== null);
}

const KNOWN_INSTAGRAM_ERRORS: Record<number, string> = {
  190: "INVALID_ACCESS_TOKEN",
  200: "PERMISSION_ERROR",
  551: "RECIPIENT_NOT_REACHABLE",
  613: "RATE_LIMIT_EXCEEDED",
  10: "APP_NOT_SUBSCRIBED",
  100: "INVALID_PARAMETER",
  10900: "OUTSIDE_MESSAGING_WINDOW",
  10901: "OUTSIDE_MESSAGING_WINDOW",
  10902: "APP_REVIEW_REQUIRED",
  10903: "NOT_INSTAGRAM_PRO_ACCOUNT",
  10904: "INSTAGRAM_NOT_LINKED_TO_PAGE",
  10800: "UNSUPPORTED_ATTACHMENT_TYPE",
};

export const instagramAdapter: ProviderAdapter = {
  provider: "instagram",

  async verifyWebhook(request: Request, channel?: ChannelDocument, rawBody?: string): Promise<boolean> {
    const body = rawBody ?? "";
    const signature = request.headers.get("x-hub-signature-256");
    const secret = resolveAppSecret(channel);
    const valid = verifyHmac(body, signature, secret);
    if (!valid) {
      logger.warn("instagram.webhook_signature_invalid", {
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
        if (!item.sender?.id || !item.message) continue;

        const msg = item.message as Record<string, any>;
        if (msg.is_echo) continue;

        const mid = msg.mid || `${entry.id}:${item.timestamp}`;

        const attachments = normalizeAttachments(msg.attachments);

        messages.push({
          provider: "instagram",
          externalEventId: String(mid),
          externalUserId: String(item.sender.id),
          externalThreadId: String(item.recipient?.id || entry.id || ""),
          externalMessageId: String(mid),
          text: msg.text || "",
          attachments,
          customer: {
            username: undefined,
            name: undefined,
          },
          timestamp: item.timestamp ? new Date(Number(item.timestamp)) : new Date(),
          raw: item,
        });
      }
    }
    return messages;
  },

  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }> {
    const config = params.channel?.config as Record<string, any> | undefined;
    const instagramBusinessId = config?.instagramBusinessId as string | undefined;
    const encryptedToken = config?.pageAccessTokenEncrypted as string | undefined;

    if (!instagramBusinessId) {
      logger.error("instagram.send_missing_business_id", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "MISSING_INSTAGRAM_BUSINESS_ID" };
    }

    if (!encryptedToken) {
      logger.error("instagram.send_missing_token", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "MISSING_PAGE_ACCESS_TOKEN" };
    }

    const pageAccessToken = decryptSecret(encryptedToken);
    if (!pageAccessToken) {
      logger.error("instagram.send_decrypt_failed", { channelId: params.channel?._id?.toString() });
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
      logger.error("instagram.send_network_error", {
        channelId: params.channel?._id?.toString(),
        error: networkError instanceof Error ? networkError.message : "network_error",
      });
      return { success: false, error: "NETWORK_ERROR" };
    }

    const json = await response.json().catch(() => ({})) as Record<string, any>;

    if (!response.ok) {
      const errCode = json?.error?.code as number | undefined;
      const errorType = errCode ? (KNOWN_INSTAGRAM_ERRORS[errCode] || `INSTAGRAM_ERROR_${errCode}`) : "INSTAGRAM_API_ERROR";

      logger.error("instagram.send_api_error", {
        channelId: params.channel?._id?.toString(),
        errorType,
        httpStatus: response.status,
        igErrorCode: errCode,
      });
      return { success: false, error: errorType };
    }

    const externalMessageId = json?.message_id as string | undefined;
    logger.info("instagram.send_ok", {
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
    if (!config?.instagramBusinessId) return { status: "unconfigured", message: "instagramBusinessId missing" };
    const tokenExists = !!(config.pageAccessTokenEncrypted);
    if (!tokenExists) return { status: "unconfigured", message: "pageAccessToken missing" };

    const permissions = (config.permissions as string[] | undefined) || [];
    const missingPerms = REQUIRED_INSTAGRAM_PERMISSIONS.filter(p => !permissions.includes(p));
    if (missingPerms.length > 0) {
      return {
        status: "error",
        message: `Missing permissions: ${missingPerms.join(", ")}. App Review may be required.`,
      };
    }

    return { status: "healthy" };
  },
};

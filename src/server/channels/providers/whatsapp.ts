import crypto from "crypto";
import { ChannelDocument } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { ProviderAdapter, NormalizedAttachment, NormalizedIncomingMessage, SendMessageParams } from "../types";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;


function normalizeWhatsAppAttachments(message: any): NormalizedAttachment[] {
  const attachments: NormalizedAttachment[] = [];
  const mediaTypes: Array<NormalizedAttachment["type"]> = ["image", "audio", "video", "document"];
  for (const type of mediaTypes) {
    const media = message?.[type];
    if (!media) continue;
    const mediaId = media.id ? String(media.id) : "";
    attachments.push({
      type,
      url: media.link || (mediaId ? `meta://media/${mediaId}` : ""),
      name: media.filename || `${type}-${mediaId || Date.now()}`,
      mimeType: media.mime_type
    });
  }
  return attachments.filter((attachment) => Boolean(attachment.url));
}

function textFromWhatsAppMessage(message: any, interactiveReplyTitle?: string, interactiveReplyId?: string) {
  return message.text?.body
    || message.button?.text
    || interactiveReplyTitle
    || interactiveReplyId
    || message.image?.caption
    || message.video?.caption
    || message.document?.caption
    || (message.audio || message.voice ? "أرسل العميل رسالة صوتية." : "")
    || (message.image ? "أرسل العميل صورة." : "")
    || (message.document ? "أرسل العميل مستندًا." : "")
    || "";
}

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

export const whatsappAdapter: ProviderAdapter = {
  provider: "whatsapp",

  async verifyWebhook(request: Request, channel?: ChannelDocument, rawBody?: string): Promise<boolean> {
    const body = rawBody ?? "";
    const signature = request.headers.get("x-hub-signature-256");
    const secret = resolveAppSecret(channel);
    const valid = verifyHmac(body, signature, secret);
    if (!valid) {
      logger.warn("whatsapp.webhook_signature_invalid", {
        channelId: channel?._id?.toString(),
        hasSignature: Boolean(signature),
        hasSecret: Boolean(secret)
      });
    }
    return valid;
  },

  async normalizeIncoming(payload: any, channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]> {
    const messages: NormalizedIncomingMessage[] = [];
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contact = value.contacts?.[0] || {};
        for (const message of value.messages || []) {
          const interactiveReplyId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;
          const interactiveReplyTitle = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
          messages.push({
            provider: "whatsapp",
            externalEventId: String(message.id),
            externalUserId: String(message.from),
            externalMessageId: String(message.id),
            text: textFromWhatsAppMessage(message, interactiveReplyTitle, interactiveReplyId),
            attachments: normalizeWhatsAppAttachments(message),
            customer: {
              name: contact.profile?.name,
              phone: message.from
            },
            timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
            raw: message
          });
        }
      }
    }
    return messages;
  },

  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }> {
    const config = params.channel?.config as Record<string, any> | undefined;
    const phoneNumberId = config?.phoneNumberId as string | undefined;
    const encryptedToken = config?.accessToken as string | undefined;

    if (!phoneNumberId) {
      logger.error("whatsapp.send_missing_phone_number_id", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "MISSING_PHONE_NUMBER_ID" };
    }

    if (!encryptedToken) {
      logger.error("whatsapp.send_missing_access_token", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "MISSING_ACCESS_TOKEN" };
    }

    const accessToken = decryptSecret(encryptedToken);
    if (!accessToken) {
      logger.error("whatsapp.send_decrypt_failed", { channelId: params.channel?._id?.toString() });
      return { success: false, error: "ACCESS_TOKEN_DECRYPT_FAILED" };
    }

    const url = `${META_GRAPH_BASE}/${phoneNumberId}/messages`;
    const body = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.externalUserId,
      type: "text",
      text: { preview_url: false, body: params.text }
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body
      });
    } catch (networkError) {
      logger.error("whatsapp.send_network_error", {
        channelId: params.channel?._id?.toString(),
        error: networkError instanceof Error ? networkError.message : "network_error"
      });
      return { success: false, error: "NETWORK_ERROR" };
    }

    const json = await response.json().catch(() => ({})) as Record<string, any>;

    if (!response.ok) {
      const errCode = json?.error?.code;
      const errMsg = json?.error?.message || "META_API_ERROR";

      const knownErrors: Record<number, string> = {
        190: "INVALID_ACCESS_TOKEN",
        131026: "RECIPIENT_OUTSIDE_24H_WINDOW",
        131056: "PAIR_RATE_LIMIT_HIT",
        100: "INVALID_PARAMETER"
      };

      const errorType = errCode ? (knownErrors[errCode] || `META_ERROR_${errCode}`) : errMsg;
      logger.error("whatsapp.send_api_error", {
        channelId: params.channel?._id?.toString(),
        errorType,
        httpStatus: response.status
      });
      return { success: false, error: errorType };
    }

    const externalMessageId = json?.messages?.[0]?.id as string | undefined;
    logger.info("whatsapp.send_ok", {
      channelId: params.channel?._id?.toString(),
      externalMessageId
    });
    return { success: true, externalMessageId };
  },

  async parseDeliveryStatus(payload: any): Promise<{ externalMessageId: string; status: string; error?: any } | null> {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const statuses = change.value?.statuses || [];
        for (const status of statuses) {
          if (status.id && status.status) {
            return {
              externalMessageId: String(status.id),
              status: status.status,
              error: status.errors?.[0]
            };
          }
        }
      }
    }
    return null;
  },

  async getHealth(channel: ChannelDocument): Promise<{ status: "healthy" | "error" | "unconfigured"; message?: string }> {
    const config = channel?.config as Record<string, any> | undefined;
    if (!config?.phoneNumberId || !config?.accessToken) {
      return { status: "unconfigured", message: "phoneNumberId or accessToken missing" };
    }
    return { status: "healthy" };
  }
};

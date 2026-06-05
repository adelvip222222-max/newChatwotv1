import { Channel, WebhookLog } from "@/lib/models";
import { generateAiReply } from "@/lib/ai";

export async function findActiveChannel(type: string, query: Record<string, unknown> = {}) {
  return Channel.findOne({
    type,
    isActive: true,
    ...query
  });
}

export async function logWebhook(input: {
  channel: string;
  payload: unknown;
  status?: "received" | "success" | "error";
  error?: string;
  tenantId?: string;
  botId?: string;
}) {
  return WebhookLog.create({
    channel: input.channel,
    payload: input.payload,
    status: input.status || "received",
    error: input.error || "",
    tenantId: input.tenantId,
    botId: input.botId
  });
}

export async function createChannelReply(options: {
  type: string;
  tenantId: string;
  botId: string;
  externalUserId: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return generateAiReply({
    tenantId: options.tenantId,
    botId: options.botId,
    externalUserId: options.externalUserId,
    message: options.message,
    channel: options.type,
    metadata: options.metadata
  });
}

export async function sendTelegramMessage(chatId: string | number, text: string, token?: string) {
  const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("توكن Telegram غير مضبوط.");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!response.ok) {
    throw new Error(`تعذر إرسال رد Telegram: ${await response.text()}`);
  }
}

export async function sendWhatsappMessage(to: string, text: string, token?: string, phoneNumberId?: string) {
  const accessToken = token || process.env.WHATSAPP_TOKEN;
  const senderPhoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !senderPhoneNumberId) {
    throw new Error("WHATSAPP_TOKEN أو WHATSAPP_PHONE_NUMBER_ID غير مضبوط.");
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${senderPhoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    })
  });

  if (!response.ok) {
    throw new Error(`تعذر إرسال رد WhatsApp: ${await response.text()}`);
  }
}

export async function sendFacebookMessage(recipientId: string, text: string, token?: string) {
  const pageToken = token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageToken) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN غير مضبوط.");

  const response = await fetch(`https://graph.facebook.com/v20.0/me/messages?access_token=${pageToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });

  if (!response.ok) {
    throw new Error(`تعذر إرسال رد Messenger: ${await response.text()}`);
  }
}

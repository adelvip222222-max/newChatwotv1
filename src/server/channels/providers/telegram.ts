import { ChannelDocument } from "@/lib/models";
import { decryptSecret } from "@/lib/crypto";
import { ProviderAdapter, NormalizedIncomingMessage, SendMessageParams } from "../types";

function resolveTelegramToken(channel: ChannelDocument) {
  const encrypted = channel.config?.botTokenEncrypted;
  const decrypted = decryptSecret(typeof encrypted === "string" ? encrypted : "");
  return decrypted || process.env.TELEGRAM_BOT_TOKEN || "";
}

export const telegramAdapter: ProviderAdapter = {
  provider: "telegram",

  async verifyWebhook(request: Request, channel?: ChannelDocument): Promise<boolean> {
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!channel || !channel.config || !channel.config.webhookSecret) {
      return process.env.NODE_ENV !== "production";
    }
    return secret === channel.config.webhookSecret;
  },

  async normalizeIncoming(payload: any, channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]> {
    if (!payload.message) return [];
    
    const msg = payload.message;
    return [{
      provider: "telegram",
      externalEventId: payload.update_id.toString(),
      externalUserId: msg.chat.id.toString(),
      externalMessageId: msg.message_id.toString(),
      text: msg.text || "",
      customer: {
        name: `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim(),
        username: msg.from.username,
      },
      timestamp: new Date(msg.date * 1000),
      raw: payload
    }];
  },

  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }> {
    const token = resolveTelegramToken(params.channel);
    if (!token) {
      return { success: false, error: "Bot token not configured" };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: params.externalUserId,
          text: params.text
        })
      });
      const data = await response.json();
      if (data.ok) {
        return { success: true, externalMessageId: data.result.message_id.toString() };
      }
      return { success: false, error: data.description };
    } catch (error) {
      return { success: false, error };
    }
  },

  async parseDeliveryStatus(payload: any) {
    return null; // Telegram doesn't send delivery receipts by default
  },

  async getHealth(channel: ChannelDocument) {
    if (!channel.config || !channel.config.botTokenEncrypted) return { status: "unconfigured" };
    return { status: "healthy" };
  }
};

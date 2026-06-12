import { ChannelDocument } from "@/lib/models";
import { ProviderAdapter, NormalizedIncomingMessage, SendMessageParams } from "../types";

export const instagramAdapter: ProviderAdapter = {
  provider: "instagram",
  async verifyWebhook(_request: Request, _channel?: ChannelDocument, _rawBody?: string) { return false; },
  async normalizeIncoming(_payload: any, _channel?: ChannelDocument) { return []; },
  async sendMessage(_params: SendMessageParams) { return { success: false, error: "INSTAGRAM_NOT_IMPLEMENTED" }; },
  async parseDeliveryStatus(_payload: any) { return null; },
  async getHealth(_channel: ChannelDocument) { return { status: "unconfigured" as const, message: "Instagram adapter not yet implemented" }; }
};

export const emailAdapter: ProviderAdapter = {
  provider: "email",
  async verifyWebhook(_request: Request, _channel?: ChannelDocument, _rawBody?: string) { return false; },
  async normalizeIncoming(_payload: any, _channel?: ChannelDocument) { return []; },
  async sendMessage(_params: SendMessageParams) { return { success: false, error: "EMAIL_NOT_IMPLEMENTED" }; },
  async parseDeliveryStatus(_payload: any) { return null; },
  async getHealth(_channel: ChannelDocument) { return { status: "unconfigured" as const, message: "Email adapter not yet implemented" }; }
};

export const apiAdapter: ProviderAdapter = {
  provider: "api",
  async verifyWebhook(_request: Request, _channel?: ChannelDocument, _rawBody?: string) { return true; },
  async normalizeIncoming(_payload: any, _channel?: ChannelDocument) { return []; },
  async sendMessage(_params: SendMessageParams) { return { success: false, error: "API_NOT_IMPLEMENTED" }; },
  async parseDeliveryStatus(_payload: any) { return null; },
  async getHealth(_channel: ChannelDocument) { return { status: "unconfigured" as const, message: "API adapter not yet implemented" }; }
};

export const webhookAdapter: ProviderAdapter = {
  provider: "webhook",
  async verifyWebhook(_request: Request, _channel?: ChannelDocument, _rawBody?: string) { return true; },
  async normalizeIncoming(payload: any, _channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]> {
    return [{
      provider: "webhook",
      externalEventId: String(payload.eventId || payload.id || payload.messageId || Date.now()),
      externalUserId: String(payload.userId),
      externalMessageId: String(payload.messageId || payload.eventId || payload.id || Date.now()),
      text: String(payload.message || payload.text || ""),
      customer: { name: String(payload.name || "Webhook User") },
      timestamp: new Date(),
      raw: payload
    }];
  },
  async sendMessage(_params: SendMessageParams) { return { success: true, externalMessageId: `webhook-${Date.now()}` }; },
  async parseDeliveryStatus(_payload: any) { return null; },
  async getHealth(_channel: ChannelDocument) { return { status: "healthy" as const }; }
};

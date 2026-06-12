import { ChannelDocument } from "@/lib/models";
import { ProviderAdapter, NormalizedIncomingMessage, SendMessageParams } from "../types";

export const websiteAdapter: ProviderAdapter = {
  provider: "website",

  async verifyWebhook(request: Request, channel?: ChannelDocument): Promise<boolean> {
    return true; 
  },

  async normalizeIncoming(payload: any, channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]> {
    return [{
      provider: "website",
      externalEventId: payload.id || Date.now().toString(),
      externalUserId: payload.userId,
      externalMessageId: payload.messageId || Date.now().toString(),
      text: payload.text || "",
      attachments: payload.attachments || [],
      customer: {
        name: payload.name || "Website Visitor",
      },
      timestamp: new Date(),
      raw: payload
    }];
  },

  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }> {
    // For website widget, messages are usually pulled by the client via polling or websockets.
    // We just return success.
    return { success: true, externalMessageId: `web-${Date.now()}` };
  },

  async parseDeliveryStatus(payload: any) {
    return null; 
  },

  async getHealth(channel: ChannelDocument) {
    return { status: "healthy" };
  }
};

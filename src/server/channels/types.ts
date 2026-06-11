import { ChannelDocument } from "@/lib/models";

export type ChannelProvider = "website" | "telegram" | "whatsapp" | "facebook" | "instagram" | "email" | "api" | "webhook";

export interface NormalizedAttachment {
  type: "image" | "video" | "audio" | "document" | "other";
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

export interface NormalizedIncomingMessage {
  provider: ChannelProvider;
  externalEventId: string;
  externalUserId: string;
  externalThreadId?: string;
  externalMessageId: string;
  text?: string;
  attachments?: NormalizedAttachment[];
  customer: {
    name?: string;
    username?: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    locale?: string;
  };
  timestamp: Date;
  raw: unknown;
}

export interface SendMessageParams {
  channel: ChannelDocument;
  externalUserId: string;
  externalThreadId?: string;
  text: string;
  attachments?: NormalizedAttachment[];
}

export interface ProviderAdapter {
  provider: ChannelProvider;
  /**
   * Verify the incoming webhook request.
   * rawBody must be provided for HMAC-based verification (WhatsApp, Facebook) so the body
   * can be verified before it is parsed — call request.text() in the route and pass it here.
   */
  verifyWebhook(request: Request, channel?: ChannelDocument, rawBody?: string): Promise<boolean>;
  normalizeIncoming(payload: any, channel?: ChannelDocument): Promise<NormalizedIncomingMessage[]>;
  sendMessage(params: SendMessageParams): Promise<{ success: boolean; externalMessageId?: string; error?: any }>;
  parseDeliveryStatus(payload: any): Promise<{ externalMessageId: string; status: string; error?: any } | null>;
  getHealth(channel: ChannelDocument): Promise<{ status: "healthy" | "error" | "unconfigured"; message?: string }>;
}

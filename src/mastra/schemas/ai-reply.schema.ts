import { z } from "zod";

export const aiReplyInputSchema = z.object({
  tenantId: z.string().min(1),
  botId: z.string().min(1),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  externalUserId: z.string().min(1),
  channel: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  traceId: z.string().optional(),
});

export const aiReplyOutputSchema = z.object({
  generated: z.boolean(),
  action: z.enum(["reply", "handoff", "skip", "fallback"]),
  reply: z.string().optional(),
  messageId: z.string().optional(),
  conversationId: z.string().optional(),
  confidence: z.number().nullable().optional(),
  reason: z.string().optional(),
  providerUsed: z.string().optional(),
  modelUsed: z.string().optional(),
});

export type AiReplyInput = z.infer<typeof aiReplyInputSchema>;
export type AiReplyOutput = z.infer<typeof aiReplyOutputSchema>;


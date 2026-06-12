const INTERNAL_TERMS = [
  "documentId",
  "tenantId",
  "botId",
  "workflow",
  "tool",
  "chunk",
  "system prompt",
  "source:",
  "faq",
];

export type ReplyValidationResult = {
  valid: boolean;
  reason?: string;
};

export function validateCustomerReply(reply: string): ReplyValidationResult {
  const trimmed = reply.trim();
  if (!trimmed) {
    return { valid: false, reason: "empty_reply" };
  }

  const lowerReply = trimmed.toLowerCase();
  const leakedTerm = INTERNAL_TERMS.find((term) =>
    lowerReply.includes(term.toLowerCase())
  );

  if (leakedTerm) {
    return { valid: false, reason: `internal_term:${leakedTerm}` };
  }

  return { valid: true };
}


import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  aiReplyInputSchema,
  aiReplyOutputSchema,
} from "@/mastra/schemas/ai-reply.schema";

const contractStep = createStep({
  id: "ai-reply-contract",
  description:
    "Typed contract for production AI reply orchestration. The first rollout uses the adapter in src/lib/ai/mastra-orchestrator.ts.",
  inputSchema: aiReplyInputSchema,
  outputSchema: aiReplyOutputSchema,
  execute: async ({ inputData }) => ({
    generated: false,
    action: "skip" as const,
    conversationId: inputData.conversationId,
    reason: "registered_contract_only",
  }),
});

export const aiReplyWorkflow = createWorkflow({
  id: "ai-reply-workflow",
  inputSchema: aiReplyInputSchema,
  outputSchema: aiReplyOutputSchema,
})
  .then(contractStep)
  .commit();


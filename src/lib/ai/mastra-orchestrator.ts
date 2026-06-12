import { mastra } from "@/mastra";
import type { GenerateReplyInput } from "@/lib/ai";

export async function generateAiReplyWithMastra(input: GenerateReplyInput) {
  const workflow = mastra.getWorkflow("aiReplyWorkflow");
  const run = await workflow.createRun({
    resourceId: `${input.tenantId}:${input.externalUserId}`,
  });

  const result = await run.start({ inputData: input });

  if (result.status !== "success") {
    throw new Error(
      result.status === "failed"
        ? result.error?.message || "Mastra workflow failed."
        : `Mastra workflow ended with status: ${result.status}`
    );
  }

  return {
    reply: result.result.reply || "",
    conversationId: result.result.conversationId || input.conversationId || "",
    confidence: result.result.confidence ?? null,
    messageId: result.result.messageId,
    action: result.result.action,
  };
}

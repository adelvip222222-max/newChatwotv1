import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Types } from "mongoose";
import { searchKnowledge } from "@/lib/knowledge";

const searchKnowledgeInputSchema = z.object({
  tenantId: z.string().min(1),
  botId: z.string().min(1),
  question: z.string().min(1),
  limit: z.number().int().min(1).max(10).default(6),
});

const searchKnowledgeOutputSchema = z.object({
  confidence: z.number(),
  intent: z.string(),
  keywords: z.array(z.string()),
  results: z.array(
    z.object({
      text: z.string(),
      score: z.number(),
      sourceTitle: z.string(),
      sourceUrl: z.string().optional(),
    })
  ),
});

export const searchKnowledgeTool = createTool({
  id: "search-knowledge",
  description:
    "Search the tenant-isolated knowledge base for customer support context.",
  inputSchema: searchKnowledgeInputSchema,
  outputSchema: searchKnowledgeOutputSchema,
  execute: async (input) => {
    if (
      !Types.ObjectId.isValid(input.tenantId) ||
      !Types.ObjectId.isValid(input.botId)
    ) {
      throw new Error("Invalid tenant or bot identifier.");
    }

    const knowledge = await searchKnowledge({
      tenantId: input.tenantId,
      botId: input.botId,
      question: input.question,
      limit: input.limit,
    });

    return {
      confidence: knowledge.confidence,
      intent: knowledge.intent,
      keywords: knowledge.keywords,
      results: knowledge.results.map((result) => ({
        text: result.text,
        score: result.score,
        sourceTitle: result.sourceTitle,
        sourceUrl: result.sourceUrl || undefined,
      })),
    };
  },
});


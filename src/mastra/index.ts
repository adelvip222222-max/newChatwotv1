import "server-only";

import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { customerSupportAgent } from "@/mastra/agents/customer-support.agent";
import { aiReplyWorkflow } from "@/mastra/workflows/ai-reply.workflow";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "chatzi-mastra-storage",
    url: process.env.MASTRA_STORAGE_URL || "file:./mastra.db",
  }),
  agents: {
    customerSupportAgent,
  },
  workflows: {
    aiReplyWorkflow,
  },
});


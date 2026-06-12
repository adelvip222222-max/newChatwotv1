import "server-only";

import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { MongoDBStore } from "@mastra/mongodb";
import { customerSupportAgent } from "@/mastra/agents/customer-support.agent";
import { aiReplyWorkflow } from "@/mastra/workflows/ai-reply.workflow";

const storage = process.env.MONGODB_URI
  ? new MongoDBStore({
      id: "chatzi-mastra-storage",
      uri: process.env.MONGODB_URI,
      dbName: process.env.MASTRA_MONGODB_DB_NAME || "chatzi_mastra",
    })
  : new LibSQLStore({
      id: "chatzi-mastra-storage",
      url: process.env.MASTRA_STORAGE_URL || "file:/tmp/chatzi-mastra.db",
    });

export const mastra = new Mastra({
  storage,
  agents: {
    customerSupportAgent,
  },
  workflows: {
    aiReplyWorkflow,
  },
});


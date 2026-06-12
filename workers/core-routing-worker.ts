import { Worker } from "bullmq";
import { connectToDatabase } from "../src/lib/mongodb";
import { Bot, Conversation, Message } from "../src/lib/models";
import { aiJobOptions, aiProcessingQueue, makeQueueJobId } from "../src/lib/queues";
import { createRedisConnection } from "../src/lib/redis-connection";
import { recordFailedJob } from "../src/lib/job-monitoring";
import { startWorkerHeartbeat } from "../src/lib/worker-heartbeat";
import { logger } from "../src/lib/logger";
import { refreshConversationIntelligence } from "../src/lib/inbox/ai-copilot";

const workerName = "worker-core-routing";
const connection = createRedisConnection(workerName);

startWorkerHeartbeat(workerName);

export const coreRoutingWorker = new Worker(
  "core-routing-queue",
  async (job) => {
    await connectToDatabase();
    const { tenantId, conversationId, messageId, channelId, provider, traceId } = job.data;

    logger.info("job.started", { queueName: "core-routing-queue", jobId: job.id, tenantId, conversationId, messageId, traceId });

    const [conversation, message] = await Promise.all([
      Conversation.findOne({ _id: conversationId, tenantId }),
      Message.findOne({ _id: messageId, tenantId })
    ]);

    if (!conversation || !message) throw new Error("Conversation or message not found");
    if (message.direction !== "incoming" || message.sender !== "user") return { routed: false, reason: "not_customer_message" };

    if (conversation.status === "closed" || conversation.status === "resolved") {
      return { routed: false, reason: "conversation_closed" };
    }

    // Do not block the customer reply on heavy inbox analysis. Reply speed comes first.
    // The analysis is refreshed asynchronously and its AI events are kept out of the chat timeline.
    void refreshConversationIntelligence({
      tenantId,
      conversationId,
      force: true
    }).catch((error) => {
      logger.warn("ai_inbox.insight_failed", {
        tenantId,
        conversationId,
        messageId,
        traceId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    const insight = null;
    const freshConversation = await Conversation.findOne({ _id: conversationId, tenantId });
    if (!freshConversation) throw new Error("Conversation not found after AI insight");

    if (freshConversation.mode === "human" || freshConversation.aiPaused) {
      return { routed: false, reason: "human_or_ai_paused" };
    }

    if ((insight as any)?.needsHuman) {
      const metadata = freshConversation.metadata && typeof freshConversation.metadata === "object" ? freshConversation.metadata : {};
      freshConversation.metadata = {
        ...metadata,
        aiPolicy: {
          ...(metadata as any).aiPolicy,
          insightNeedsHuman: true,
          insightNeedsHumanAt: new Date().toISOString()
        }
      };
    }

    let effectiveBotId = freshConversation.botId?.toString();
    if (!effectiveBotId) {
      const fallbackBot = await Bot.findOne({ tenantId, isActive: true }).sort({ createdAt: 1 }).select("_id").lean();
      if (!fallbackBot?._id) {
        return { routed: false, reason: "no_active_bot" };
      }
      effectiveBotId = fallbackBot._id.toString();
      freshConversation.botId = fallbackBot._id as any;
    }

    freshConversation.mode = freshConversation.mode || "ai";
    freshConversation.aiStatus = freshConversation.aiStatus || "active";
    await freshConversation.save();

    await aiProcessingQueue.add(
      "generate-ai-reply",
      {
        tenantId,
        conversationId,
        messageId,
        botId: effectiveBotId,
        channelId,
        contactId: freshConversation.contactId?.toString(),
        provider,
        traceId
      },
      {
        ...aiJobOptions,
        jobId: makeQueueJobId("ai", messageId)
      }
    );

    logger.info("message.routed_to_ai", { tenantId, conversationId, messageId, traceId });
    return { routed: true, target: "ai" };
  },
  { connection: connection as any, concurrency: Number(process.env.CORE_ROUTING_WORKER_CONCURRENCY || 10) }
);

coreRoutingWorker.on("failed", (job, error) => {
  void recordFailedJob("core-routing-queue", job, error);
});

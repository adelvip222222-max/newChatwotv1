import { Worker } from "bullmq";
import { connectToDatabase } from "../src/lib/mongodb";
import { Conversation, Message } from "../src/lib/models";
import { egressQueue, defaultJobOptions, makeQueueJobId } from "../src/lib/queues";
import { createRedisConnection } from "../src/lib/redis-connection";
import { recordFailedJob } from "../src/lib/job-monitoring";
import { startWorkerHeartbeat } from "../src/lib/worker-heartbeat";
import { logger } from "../src/lib/logger";
import { generateAiReply } from "../src/lib/ai";

const workerName = "worker-ai";
const connection = createRedisConnection(workerName);

startWorkerHeartbeat(workerName);

export const aiWorker = new Worker(
  "ai-processing-queue",
  async (job) => {
    await connectToDatabase();
    const { tenantId, conversationId, messageId, botId, provider, traceId } = job.data;
    logger.info("job.started", { queueName: "ai-processing-queue", jobId: job.id, tenantId, conversationId, messageId, traceId });

    const [conversation, message] = await Promise.all([
      Conversation.findOne({ _id: conversationId, tenantId, botId }),
      Message.findOne({ _id: messageId, tenantId, conversationId })
    ]);

    if (!conversation || !message) throw new Error("Conversation or message not found");
    if (conversation.mode === "human" || conversation.aiPaused || conversation.status === "closed") {
      return { generated: false, reason: "ai_paused" };
    }

    const result = await generateAiReply({
      tenantId,
      botId,
      conversationId,
      externalUserId: conversation.externalUserId,
      channel: provider || conversation.provider || conversation.channel,
      message: message.content,
      metadata: { traceId, sourceMessageId: messageId }
    });

    if (!result.reply || !result.messageId) {
      return { generated: false, reason: "empty_reply" };
    }

    await egressQueue.add(
      "prepare-outbound",
      {
        tenantId,
        conversationId,
        messageId: result.messageId,
        provider: provider || conversation.provider || conversation.channel,
        traceId
      },
      {
        ...defaultJobOptions,
        jobId: makeQueueJobId("egress", result.messageId)
      }
    );

    logger.info("ai.reply_generated", { tenantId, conversationId, messageId: result.messageId, traceId });
    return { generated: true, messageId: result.messageId };
  },
  { connection: connection as any, concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 3) }
);

aiWorker.on("failed", (job, error) => {
  void recordFailedJob("ai-processing-queue", job, error);
});

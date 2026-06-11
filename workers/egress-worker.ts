import { Worker } from "bullmq";
import { connectToDatabase } from "../src/lib/mongodb";
import { Channel, Conversation, Message } from "../src/lib/models";
import { createRedisConnection } from "../src/lib/redis-connection";
import { recordFailedJob } from "../src/lib/job-monitoring";
import { startWorkerHeartbeat } from "../src/lib/worker-heartbeat";
import { logger } from "../src/lib/logger";
import { queueOutboundMessage } from "../src/server/channels/outboundQueue";

const workerName = "worker-egress";
const connection = createRedisConnection(workerName);

startWorkerHeartbeat(workerName);

export const egressWorker = new Worker(
  "egress-queue",
  async (job) => {
    await connectToDatabase();
    const { tenantId, conversationId, messageId, provider, traceId } = job.data;
    logger.info("job.started", { queueName: "egress-queue", jobId: job.id, tenantId, conversationId, messageId, traceId });

    const [conversation, message] = await Promise.all([
      Conversation.findOne({ _id: conversationId, tenantId }),
      Message.findOne({ _id: messageId, tenantId, conversationId })
    ]);

    if (!conversation || !message) throw new Error("Conversation or outbound message not found");

    const channelProvider = provider || conversation.provider || conversation.channel;
    if (["website", "webhook", "api"].includes(channelProvider)) {
      await Message.updateOne({ _id: message._id, tenantId }, { $set: { deliveryStatus: "sent" } });
      return { queued: false, reason: "internal_channel" };
    }

    const channel = await Channel.findOne({
      tenantId,
      botId: conversation.botId,
      type: channelProvider,
      isActive: true
    });

    if (!channel) throw new Error("Outbound channel not found");

    const result = await queueOutboundMessage({
      tenantId,
      messageId: message._id,
      conversationId: conversation._id,
      channelId: channel._id,
      provider: channelProvider,
      text: message.content,
      attachments: message.attachments || [],
      externalUserId: conversation.externalUserId,
      externalThreadId: conversation.externalThreadId
    });

    logger.info("egress.outbound_queued", { tenantId, conversationId, messageId, provider: channelProvider, traceId, enqueued: result.enqueued });
    return { queued: result.enqueued };
  },
  { connection: connection as any, concurrency: Number(process.env.EGRESS_WORKER_CONCURRENCY || 10) }
);

egressWorker.on("failed", (job, error) => {
  void recordFailedJob("egress-queue", job, error);
});

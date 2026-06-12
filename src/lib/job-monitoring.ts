import type { Job } from "bullmq";
import { connectToDatabase } from "@/lib/mongodb";
import { FailedJob } from "@/lib/models";
import { logger } from "@/lib/logger";

export async function recordFailedJob(queueName: string, job: Job | undefined, error: unknown) {
  const data = (job?.data || {}) as Record<string, any>;
  const reason = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack || "" : "";

  logger.error("job.failed", {
    queueName,
    jobId: job?.id,
    jobName: job?.name,
    tenantId: data.tenantId,
    provider: data.provider,
    conversationId: data.conversationId,
    messageId: data.messageId,
    traceId: data.traceId,
    reason
  });

  try {
    await connectToDatabase();
    await FailedJob.create({
      tenantId: data.tenantId,
      queueName,
      jobName: job?.name || "unknown",
      jobId: job?.id,
      provider: data.provider,
      channelId: data.channelId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      externalMessageId: data.externalMessageId,
      traceId: data.traceId,
      attemptsMade: job?.attemptsMade || 0,
      reason,
      stack,
      payload: data
    });
  } catch (monitoringError) {
    logger.error("job.failed.monitoring_error", {
      queueName,
      jobId: job?.id,
      reason: monitoringError instanceof Error ? monitoringError.message : String(monitoringError)
    });
  }
}

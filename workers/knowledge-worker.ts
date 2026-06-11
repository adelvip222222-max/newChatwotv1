import { Worker } from "bullmq";
import { createRedisConnection } from "../src/lib/redis-connection";
import { recordFailedJob } from "../src/lib/job-monitoring";
import { startWorkerHeartbeat } from "../src/lib/worker-heartbeat";
import { logger } from "../src/lib/logger";
import { trainKnowledgeDocument } from "../src/lib/knowledge";

const workerName = "worker-knowledge";
const connection = createRedisConnection(workerName);

startWorkerHeartbeat(workerName);

export const knowledgeWorker = new Worker(
  "knowledge-training-queue",
  async (job) => {
    const { documentId, tenantId } = job.data as { documentId: string; tenantId: string };
    logger.info("knowledge.job_started", { jobId: job.id, documentId, tenantId });
    await trainKnowledgeDocument(documentId, tenantId);
    logger.info("knowledge.job_completed", { jobId: job.id, documentId, tenantId });
  },
  {
    connection: connection as any,
    concurrency: Number(process.env.KNOWLEDGE_WORKER_CONCURRENCY || 2),
  }
);

knowledgeWorker.on("failed", (job, error) => {
  void recordFailedJob("knowledge-training-queue", job, error);
  logger.error("knowledge.job_failed", {
    jobId: job?.id,
    documentId: job?.data?.documentId,
    error: error.message,
  });
});

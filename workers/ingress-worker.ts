import { Worker } from "bullmq";
import { createRedisConnection } from "../src/lib/redis-connection";
import { recordFailedJob } from "../src/lib/job-monitoring";
import { startWorkerHeartbeat } from "../src/lib/worker-heartbeat";
import { logger } from "../src/lib/logger";
import { processIngressJob } from "../src/server/channels/ingressProcessor";

const workerName = "worker-ingress";
const connection = createRedisConnection(workerName);

startWorkerHeartbeat(workerName);

export const ingressWorker = new Worker(
  "ingress-queue",
  async (job) => {
    logger.info("job.started", { queueName: "ingress-queue", jobId: job.id, traceId: job.data?.traceId });
    const result = await processIngressJob(job.data);
    logger.info("job.completed", { queueName: "ingress-queue", jobId: job.id, traceId: job.data?.traceId, result });
    return result;
  },
  { connection: connection as any, concurrency: Number(process.env.INGRESS_WORKER_CONCURRENCY || 10) }
);

ingressWorker.on("failed", (job, error) => {
  void recordFailedJob("ingress-queue", job, error);
});

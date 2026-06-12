import { JobsOptions, Queue } from 'bullmq';
import { redis } from '../redis';

const connection = redis;
const isBuild = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build';

export const ingressQueue = isBuild ? null as any : new Queue('ingress-queue', { connection: connection as any });
export const coreRoutingQueue = isBuild ? null as any : new Queue('core-routing-queue', { connection: connection as any });
export const aiProcessingQueue = isBuild ? null as any : new Queue('ai-processing-queue', { connection: connection as any });
export const egressQueue = isBuild ? null as any : new Queue('egress-queue', { connection: connection as any });
export const knowledgeTrainingQueue = isBuild ? null as any : new Queue('knowledge-training-queue', { connection: connection as any });

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
  removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 }
};

export const aiJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
  removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 }
};

export function makeQueueJobId(...parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]/g, "_"))
    .join("__")
    .slice(0, 180);
}
